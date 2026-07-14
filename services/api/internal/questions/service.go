package questions

import (
	"context"
	"errors"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abc-exam/api/internal/parser"
)

var (
	ErrExamSetNotFound  = errors.New("exam set not found")
	ErrExamSetInUse     = errors.New("exam set is in use by exams or study materials")
	ErrQuestionNotFound = errors.New("question not found")
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

// Categories

func (s *Service) ListExamSets(ctx context.Context) ([]ExamSet, error) {
	rows, err := s.db.Query(ctx,
		`SELECT es.id, es.name, es.description, COUNT(q.id) AS question_count
		 FROM exam_sets es
		 LEFT JOIN questions q ON q.exam_set_id = es.id AND q.active = true
		 GROUP BY es.id, es.name, es.description
		 ORDER BY es.name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var sets []ExamSet
	for rows.Next() {
		var c ExamSet
		if err := rows.Scan(&c.ID, &c.Name, &c.Description, &c.QuestionCount); err != nil {
			return nil, err
		}
		sets = append(sets, c)
	}
	return sets, nil
}

func (s *Service) GetExamSet(ctx context.Context, id string) (*ExamSet, error) {
	var c ExamSet
	err := s.db.QueryRow(ctx,
		`SELECT es.id, es.name, es.description, COUNT(q.id) AS question_count
		 FROM exam_sets es
		 LEFT JOIN questions q ON q.exam_set_id = es.id AND q.active = true
		 WHERE es.id = $1
		 GROUP BY es.id, es.name, es.description`,
		id,
	).Scan(&c.ID, &c.Name, &c.Description, &c.QuestionCount)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrExamSetNotFound
	}
	return &c, err
}

func (s *Service) CreateExamSet(ctx context.Context, req CreateExamSetRequest) (*ExamSet, error) {
	var c ExamSet
	err := s.db.QueryRow(ctx,
		`INSERT INTO exam_sets (name, description)
		 VALUES ($1, $2)
		 RETURNING id, name, description`,
		req.Name, req.Description,
	).Scan(&c.ID, &c.Name, &c.Description)
	if err != nil {
		return nil, err
	}
	return &c, nil
}

func (s *Service) UpdateExamSet(ctx context.Context, id string, req UpdateExamSetRequest) (*ExamSet, error) {
	var c ExamSet
	err := s.db.QueryRow(ctx,
		`UPDATE exam_sets
		 SET name = COALESCE(NULLIF($2, ''), name),
		     description = COALESCE(NULLIF($3, ''), description)
		 WHERE id = $1
		 RETURNING id, name, description`,
		id, req.Name, req.Description,
	).Scan(&c.ID, &c.Name, &c.Description)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrExamSetNotFound
	}
	return &c, err
}

func (s *Service) DeleteExamSet(ctx context.Context, id string) error {
	var usedBy struct {
		Exams     int `db:"exams"`
		Materials int `db:"materials"`
	}
	err := s.db.QueryRow(ctx,
		`SELECT
			(SELECT COUNT(*) FROM exams WHERE exam_set_id = $1),
			(SELECT COUNT(*) FROM study_materials WHERE exam_set_id = $1)`,
		id,
	).Scan(&usedBy.Exams, &usedBy.Materials)
	if err != nil {
		return err
	}
	if usedBy.Exams > 0 || usedBy.Materials > 0 {
		return fmt.Errorf("%w: %d exam(s) and %d study material(s)", ErrExamSetInUse, usedBy.Exams, usedBy.Materials)
	}

	_, err = s.db.Exec(ctx, `DELETE FROM questions WHERE exam_set_id = $1`, id)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `UPDATE pdf_uploads SET exam_set_id = NULL WHERE exam_set_id = $1`, id)
	if err != nil {
		return err
	}

	res, err := s.db.Exec(ctx, `DELETE FROM exam_sets WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrExamSetNotFound
	}
	return nil
}

// Questions

func (s *Service) ListQuestions(ctx context.Context, f ListFilter) ([]Question, int, error) {
	if f.Limit == 0 {
		f.Limit = 50
	}
	if f.Page == 0 {
		f.Page = 1
	}
	offset := (f.Page - 1) * f.Limit

	args := []interface{}{}
	where := "WHERE q.active = true"
	idx := 1

	if f.ExamSetID != "" {
		where += fmt.Sprintf(" AND q.exam_set_id = $%d", idx)
		args = append(args, f.ExamSetID)
		idx++
	}
	if f.Difficulty != "" {
		where += fmt.Sprintf(" AND q.difficulty = $%d", idx)
		args = append(args, f.Difficulty)
		idx++
	}

	countArgs := make([]interface{}, len(args))
	copy(countArgs, args)

	var total int
	if err := s.db.QueryRow(ctx,
		fmt.Sprintf(`SELECT COUNT(*) FROM questions q %s`, where), countArgs...,
	).Scan(&total); err != nil {
		return nil, 0, err
	}

	args = append(args, f.Limit, offset)
	rows, err := s.db.Query(ctx,
		fmt.Sprintf(`SELECT q.id, q.exam_set_id, q.question_text,
		              q.option_a, q.option_b, q.option_c, q.option_d,
		              q.correct_option, q.explanation, q.difficulty, q.active, q.created_at
		             FROM questions q %s
		             ORDER BY q.created_at DESC
		             LIMIT $%d OFFSET $%d`, where, idx, idx+1),
		args...,
	)
	if err != nil {
		return nil, 0, err
	}
	defer rows.Close()

	var qs []Question
	for rows.Next() {
		var q Question
		if err := rows.Scan(&q.ID, &q.ExamSetID, &q.QuestionText,
			&q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD,
			&q.CorrectOption, &q.Explanation, &q.Difficulty, &q.Active, &q.CreatedAt,
		); err != nil {
			return nil, 0, err
		}
		qs = append(qs, q)
	}
	return qs, total, nil
}

func (s *Service) GetQuestion(ctx context.Context, id string) (*Question, error) {
	var q Question
	err := s.db.QueryRow(ctx,
		`SELECT id, exam_set_id, question_text,
		        option_a, option_b, option_c, option_d,
		        correct_option, explanation, difficulty, active, created_at
		 FROM questions WHERE id = $1`, id,
	).Scan(&q.ID, &q.ExamSetID, &q.QuestionText,
		&q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD,
		&q.CorrectOption, &q.Explanation, &q.Difficulty, &q.Active, &q.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrQuestionNotFound
	}
	return &q, err
}

func (s *Service) CreateQuestion(ctx context.Context, req CreateQuestionRequest) (*Question, error) {
	if req.Difficulty == "" {
		req.Difficulty = "medium"
	}
	var q Question
	err := s.db.QueryRow(ctx,
		`INSERT INTO questions (exam_set_id, question_text, option_a, option_b, option_c, option_d,
		                        correct_option, explanation, difficulty)
		 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
		 RETURNING id, exam_set_id, question_text, option_a, option_b, option_c, option_d,
		           correct_option, explanation, difficulty, active, created_at`,
		req.ExamSetID, req.QuestionText, req.OptionA, req.OptionB, req.OptionC, req.OptionD,
		req.CorrectOption, req.Explanation, req.Difficulty,
	).Scan(&q.ID, &q.ExamSetID, &q.QuestionText,
		&q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD,
		&q.CorrectOption, &q.Explanation, &q.Difficulty, &q.Active, &q.CreatedAt)
	return &q, err
}

func (s *Service) BulkCreateQuestions(ctx context.Context, reqs []CreateQuestionRequest) (int, error) {
	if len(reqs) == 0 {
		return 0, nil
	}
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback(ctx)

	count := 0
	for _, req := range reqs {
		if req.Difficulty == "" {
			req.Difficulty = "medium"
		}
		_, err := tx.Exec(ctx,
			`INSERT INTO questions (exam_set_id, question_text, option_a, option_b, option_c, option_d,
			                        correct_option, explanation, difficulty)
			 VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			req.ExamSetID, req.QuestionText, req.OptionA, req.OptionB, req.OptionC, req.OptionD,
			req.CorrectOption, req.Explanation, req.Difficulty,
		)
		if err != nil {
			return count, fmt.Errorf("question %d insert error: %w", count+1, err)
		}
		count++
	}
	return count, tx.Commit(ctx)
}

func (s *Service) UpdateQuestion(ctx context.Context, id string, req UpdateQuestionRequest) (*Question, error) {
	existing, err := s.GetQuestion(ctx, id)
	if err != nil {
		return nil, err
	}

	if req.ExamSetID != nil {
		existing.ExamSetID = *req.ExamSetID
	}
	if req.QuestionText != nil {
		existing.QuestionText = *req.QuestionText
	}
	if req.OptionA != nil {
		existing.OptionA = *req.OptionA
	}
	if req.OptionB != nil {
		existing.OptionB = *req.OptionB
	}
	if req.OptionC != nil {
		existing.OptionC = *req.OptionC
	}
	if req.OptionD != nil {
		existing.OptionD = *req.OptionD
	}
	if req.CorrectOption != nil {
		existing.CorrectOption = *req.CorrectOption
	}
	if req.Explanation != nil {
		existing.Explanation = *req.Explanation
	}
	if req.Difficulty != nil {
		existing.Difficulty = *req.Difficulty
	}
	if req.Active != nil {
		existing.Active = *req.Active
	}

	_, err = s.db.Exec(ctx,
		`UPDATE questions SET
		   exam_set_id=$1, question_text=$2, option_a=$3, option_b=$4, option_c=$5, option_d=$6,
		   correct_option=$7, explanation=$8, difficulty=$9, active=$10
		 WHERE id=$11`,
		existing.ExamSetID, existing.QuestionText, existing.OptionA, existing.OptionB, existing.OptionC, existing.OptionD,
		existing.CorrectOption, existing.Explanation, existing.Difficulty, existing.Active, id,
	)
	if err != nil {
		return nil, err
	}
	return existing, nil
}

func (s *Service) DeleteQuestion(ctx context.Context, id string) error {
	res, err := s.db.Exec(ctx, `UPDATE questions SET active = false WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrQuestionNotFound
	}
	return nil
}

// BulkImportFromParsed publishes parsed questions to a category.
func (s *Service) BulkImportFromParsed(ctx context.Context, parsed []parser.ParsedQuestion, examSetID, uploadID string) (int, error) {
	reqs := make([]CreateQuestionRequest, 0, len(parsed))
	for _, p := range parsed {
		reqs = append(reqs, CreateQuestionRequest{
			ExamSetID:     examSetID,
			QuestionText:  p.QuestionText,
			OptionA:       p.OptionA,
			OptionB:       p.OptionB,
			OptionC:       p.OptionC,
			OptionD:       p.OptionD,
			CorrectOption: p.CorrectOption,
			Explanation:   p.Explanation,
			Difficulty:    "medium",
		})
	}

	count, err := s.BulkCreateQuestions(ctx, reqs)
	if err != nil {
		return count, err
	}

	if uploadID != "" {
		_, _ = s.db.Exec(ctx,
			`UPDATE pdf_uploads SET
			   parse_status = 'published',
			   questions_published = $1,
			   parsed_at = NOW()
			 WHERE id = $2`,
			count, uploadID,
		)
	}

	_ = uuid.New()
	return count, nil
}
