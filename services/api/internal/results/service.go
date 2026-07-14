package results

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var ErrAttemptNotFound = errors.New("attempt not found")
var ErrNotOwner = errors.New("access denied")

type QuestionReview struct {
	Position      int    `json:"position"`
	QuestionText  string `json:"question_text"`
	OptionA       string `json:"option_a"`
	OptionB       string `json:"option_b"`
	OptionC       string `json:"option_c"`
	OptionD       string `json:"option_d"`
	CorrectOption string `json:"correct_option"`
	YourAnswer    string `json:"your_answer"`
	IsCorrect     bool   `json:"is_correct"`
	Explanation   string `json:"explanation"`
}

type Result struct {
	AttemptID        string           `json:"attempt_id"`
	ExamID           string           `json:"exam_id"`
	ExamTitle        string           `json:"exam_title"`
	UserID           string           `json:"user_id"`
	Status           string           `json:"status"`
	Score            float64          `json:"score"`
	RawScore         float64          `json:"raw_score"`
	TotalMarks       float64          `json:"total_marks"`
	Passed           bool             `json:"passed"`
	TotalQuestions   int              `json:"total_questions"`
	CorrectAnswers   int              `json:"correct_answers"`
	WrongAnswers     int              `json:"wrong_answers"`
	Unattempted      int              `json:"unattempted"`
	MarksPerQuestion float64          `json:"marks_per_question"`
	NegativeMarking  bool             `json:"negative_marking"`
	NegativePenalty  float64          `json:"negative_penalty"`
	TimeTakenSec     *int             `json:"time_taken_sec,omitempty"`
	Review           []QuestionReview `json:"review,omitempty"`
}

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// GetResult returns scored result for a completed attempt.
// includeReview=true also returns per-question breakdown.
func (s *Service) GetResult(ctx context.Context, attemptID, userID string, includeReview bool) (*Result, error) {
	var r Result
	var answersRaw, questionIDsRaw []byte

	err := s.db.QueryRow(ctx,
		`SELECT ea.id, ea.exam_id, e.title, ea.user_id,
		        ea.status::TEXT, ea.score,
		        COALESCE(ea.raw_score, ea.score), COALESCE(ea.total_marks, ea.total_questions::NUMERIC),
		        ea.passed,
		        ea.total_questions, ea.correct_answers,
		        e.marks_per_question, e.negative_marking, e.negative_penalty,
		        ea.answers, ea.question_ids
		 FROM exam_attempts ea
		 JOIN exams e ON e.id = ea.exam_id
		 WHERE ea.id = $1`, attemptID,
	).Scan(
		&r.AttemptID, &r.ExamID, &r.ExamTitle, &r.UserID,
		&r.Status, &r.Score,
		&r.RawScore, &r.TotalMarks,
		&r.Passed,
		&r.TotalQuestions, &r.CorrectAnswers,
		&r.MarksPerQuestion, &r.NegativeMarking, &r.NegativePenalty,
		&answersRaw, &questionIDsRaw,
	)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAttemptNotFound
	}
	if err != nil {
		return nil, err
	}

	if r.UserID != userID {
		return nil, ErrNotOwner
	}

	if r.Status == "in_progress" {
		return nil, errors.New("exam is still in progress")
	}

	correct := r.CorrectAnswers
	r.WrongAnswers = 0
	r.Unattempted = 0

	var answers map[string]string
	_ = json.Unmarshal(answersRaw, &answers)
	var questionIDs []string
	_ = json.Unmarshal(questionIDsRaw, &questionIDs)

	attempted := len(answers)
	r.Unattempted = r.TotalQuestions - attempted
	r.WrongAnswers = attempted - correct

	if !includeReview || len(questionIDs) == 0 {
		return &r, nil
	}

	// Fetch full question details for review
	rows, err := s.db.Query(ctx,
		`SELECT id, question_text, option_a, option_b, option_c, option_d,
		        correct_option, explanation
		 FROM questions WHERE id = ANY($1)`, questionIDs)
	if err != nil {
		return &r, nil // return result without review on error
	}
	defer rows.Close()

	type qRow struct {
		ID, Text, A, B, C, D, Correct, Explanation string
	}
	qMap := map[string]qRow{}
	for rows.Next() {
		var q qRow
		rows.Scan(&q.ID, &q.Text, &q.A, &q.B, &q.C, &q.D, &q.Correct, &q.Explanation)
		qMap[q.ID] = q
	}

	review := make([]QuestionReview, 0, len(questionIDs))
	for i, qID := range questionIDs {
		q, ok := qMap[qID]
		if !ok {
			continue
		}
		yourAnswer := answers[qID]
		review = append(review, QuestionReview{
			Position:      i + 1,
			QuestionText:  q.Text,
			OptionA:       q.A,
			OptionB:       q.B,
			OptionC:       q.C,
			OptionD:       q.D,
			CorrectOption: q.Correct,
			YourAnswer:    yourAnswer,
			IsCorrect:     yourAnswer == q.Correct,
			Explanation:   q.Explanation,
		})
	}
	r.Review = review
	return &r, nil
}

// ListMyResults returns a summary of all completed attempts for a user.
func (s *Service) ListMyResults(ctx context.Context, userID string) ([]*Result, error) {
	rows, err := s.db.Query(ctx,
		`SELECT ea.id, ea.exam_id, e.title, ea.user_id,
		        ea.status::TEXT, ea.score, ea.passed,
		        ea.total_questions, ea.correct_answers
		 FROM exam_attempts ea
		 JOIN exams e ON e.id = ea.exam_id
		 WHERE ea.user_id = $1 AND ea.status::TEXT IN ('graded','timed_out')
		 ORDER BY ea.submitted_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var list []*Result
	for rows.Next() {
		var r Result
		if err := rows.Scan(
			&r.AttemptID, &r.ExamID, &r.ExamTitle, &r.UserID,
			&r.Status, &r.Score, &r.Passed,
			&r.TotalQuestions, &r.CorrectAnswers,
		); err != nil {
			return nil, err
		}
		list = append(list, &r)
	}
	return list, nil
}
