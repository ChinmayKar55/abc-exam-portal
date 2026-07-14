package exam

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math/rand"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
)

const attemptKeyPrefix = "exam:attempt:"
const attemptAnswersSuffix = ":answers"
const attemptTTLBuffer = 5 * time.Minute // extra grace after timer expires

var (
	ErrExamNotFound        = errors.New("exam not found")
	ErrAttemptNotFound     = errors.New("attempt not found")
	ErrAlreadyInProgress   = errors.New("you already have an active attempt for this exam")
	ErrAttemptExpired      = errors.New("exam time has expired")
	ErrAttemptNotActive    = errors.New("attempt is not in progress")
	ErrNoPlanAccess        = errors.New("active plan required to take exams")
)

type Service struct {
	db  *pgxpool.Pool
	rdb *redis.Client
}

func NewService(db *pgxpool.Pool, rdb *redis.Client) *Service {
	return &Service{db: db, rdb: rdb}
}

// loadSources fetches question bank sources for a list of exam IDs.
func (s *Service) loadSources(ctx context.Context, examIDs []string) (map[string][]ExamSource, error) {
	if len(examIDs) == 0 {
		return map[string][]ExamSource{}, nil
	}
	rows, err := s.db.Query(ctx,
		`SELECT eqs.exam_id, eqs.bank_id, es.name, eqs.question_count, eqs.pinned_question_ids
		 FROM exam_question_sources eqs
		 JOIN exam_sets es ON es.id = eqs.bank_id
		 WHERE eqs.exam_id = ANY($1)
		 ORDER BY es.name`, examIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string][]ExamSource{}
	for rows.Next() {
		var examID string
		var src ExamSource
		src.PinnedQuestionIDs = []string{} // ensure non-nil so empty UUID[] scans as [] not nil
		if err := rows.Scan(&examID, &src.BankID, &src.BankName, &src.QuestionCount, &src.PinnedQuestionIDs); err != nil {
			return nil, err
		}
		if src.PinnedQuestionIDs == nil {
			src.PinnedQuestionIDs = []string{}
		}
		out[examID] = append(out[examID], src)
	}
	return out, nil
}

// setSources replaces all exam_question_sources rows for an exam and updates total_questions.
func (s *Service) setSources(ctx context.Context, examID string, sources []ExamSource) error {
	_, err := s.db.Exec(ctx, `DELETE FROM exam_question_sources WHERE exam_id = $1`, examID)
	if err != nil {
		return err
	}
	total := 0
	for _, src := range sources {
		if src.BankID == "" || src.QuestionCount <= 0 {
			continue
		}
		pinned := src.PinnedQuestionIDs
		if pinned == nil {
			pinned = []string{}
		}
		_, err := s.db.Exec(ctx,
			`INSERT INTO exam_question_sources (exam_id, bank_id, question_count, pinned_question_ids)
			 VALUES ($1, $2, $3, $4)
			 ON CONFLICT (exam_id, bank_id) DO UPDATE
			   SET question_count = $3, pinned_question_ids = $4`,
			examID, src.BankID, src.QuestionCount, pinned)
		if err != nil {
			return err
		}
		total += src.QuestionCount
	}
	_, err = s.db.Exec(ctx, `UPDATE exams SET total_questions = $1 WHERE id = $2`, total, examID)
	return err
}

// ListExams returns published exams, optionally filtered by exam_type.
func (s *Service) ListExams(ctx context.Context, examType string) ([]Exam, error) {
	q := `SELECT e.id, e.title, e.description, e.exam_type,
	             e.total_questions, e.duration_minutes, e.pass_mark_pct,
	             e.marks_per_question, e.negative_marking, e.negative_penalty,
	             e.shuffle, e.status::TEXT, e.created_at
	      FROM exams e
	      WHERE e.status = 'active'::exam_status`
	args := []interface{}{}
	if examType != "" {
		q += " AND e.exam_type = $1"
		args = append(args, examType)
	}
	q += " ORDER BY e.created_at DESC"

	rows, err := s.db.Query(ctx, q, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exams []Exam
	var ids []string
	for rows.Next() {
		var e Exam
		if err := rows.Scan(&e.ID, &e.Title, &e.Description, &e.ExamType,
			&e.TotalQuestions, &e.DurationMinutes, &e.PassMarkPct,
			&e.MarksPerQuestion, &e.NegativeMarking, &e.NegativePenalty,
			&e.Shuffle, &e.Status, &e.CreatedAt); err != nil {
			return nil, err
		}
		exams = append(exams, e)
		ids = append(ids, e.ID)
	}
	srcMap, err := s.loadSources(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range exams {
		exams[i].Sources = srcMap[exams[i].ID]
	}
	return exams, nil
}

// ListAllExams returns all exams regardless of status (admin use).
func (s *Service) ListAllExams(ctx context.Context) ([]Exam, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, title, description, exam_type,
		        total_questions, duration_minutes, pass_mark_pct,
		        marks_per_question, negative_marking, negative_penalty,
		        shuffle, status::TEXT, created_at
		 FROM exams ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var exams []Exam
	var ids []string
	for rows.Next() {
		var e Exam
		if err := rows.Scan(&e.ID, &e.Title, &e.Description, &e.ExamType,
			&e.TotalQuestions, &e.DurationMinutes, &e.PassMarkPct,
			&e.MarksPerQuestion, &e.NegativeMarking, &e.NegativePenalty,
			&e.Shuffle, &e.Status, &e.CreatedAt); err != nil {
			return nil, err
		}
		exams = append(exams, e)
		ids = append(ids, e.ID)
	}
	srcMap, err := s.loadSources(ctx, ids)
	if err != nil {
		return nil, err
	}
	for i := range exams {
		exams[i].Sources = srcMap[exams[i].ID]
	}
	return exams, nil
}

// GetExam returns a single exam by ID (all statuses, for admin too).
func (s *Service) GetExam(ctx context.Context, id string) (*Exam, error) {
	var e Exam
	err := s.db.QueryRow(ctx,
		`SELECT id, title, description, exam_type,
		        total_questions, duration_minutes, pass_mark_pct,
		        marks_per_question, negative_marking, negative_penalty,
		        shuffle, status::TEXT, created_at
		 FROM exams WHERE id = $1`, id,
	).Scan(&e.ID, &e.Title, &e.Description, &e.ExamType,
		&e.TotalQuestions, &e.DurationMinutes, &e.PassMarkPct,
		&e.MarksPerQuestion, &e.NegativeMarking, &e.NegativePenalty,
		&e.Shuffle, &e.Status, &e.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrExamNotFound
	}
	if err != nil {
		return nil, err
	}
	srcMap, err := s.loadSources(ctx, []string{e.ID})
	if err != nil {
		return nil, err
	}
	e.Sources = srcMap[e.ID]
	return &e, nil
}

// CreateExam creates a new exam (admin only).
func (s *Service) CreateExam(ctx context.Context, req CreateExamRequest) (*Exam, error) {
	if req.ExamType == "" {
		req.ExamType = "mock"
	}
	if req.PassMarkPct == 0 {
		req.PassMarkPct = 40
	}
	if req.MarksPerQuestion == 0 {
		req.MarksPerQuestion = 1.0
	}
	if req.NegativePenalty == 0 {
		req.NegativePenalty = 0.25
	}
	initStatus := req.Status
	if initStatus != "active" && initStatus != "archived" {
		initStatus = "draft"
	}
	var e Exam
	err := s.db.QueryRow(ctx,
		`INSERT INTO exams (title, description, exam_type, total_questions, duration_minutes, pass_mark_pct,
		                   marks_per_question, negative_marking, negative_penalty, shuffle, status)
		 VALUES ($1,$2,$3::exam_type,0,$4,$5,$6,$7,$8,$9,$10::exam_status)
		 RETURNING id, title, description, exam_type,
		           total_questions, duration_minutes, pass_mark_pct,
		           marks_per_question, negative_marking, negative_penalty,
		           shuffle, status::TEXT, created_at`,
		req.Title, req.Description, req.ExamType,
		req.DurationMinutes, req.PassMarkPct,
		req.MarksPerQuestion, req.NegativeMarking, req.NegativePenalty,
		req.Shuffle, initStatus,
	).Scan(&e.ID, &e.Title, &e.Description, &e.ExamType,
		&e.TotalQuestions, &e.DurationMinutes, &e.PassMarkPct,
		&e.MarksPerQuestion, &e.NegativeMarking, &e.NegativePenalty,
		&e.Shuffle, &e.Status, &e.CreatedAt)
	if err != nil {
		return nil, err
	}
	if err := s.setSources(ctx, e.ID, req.Sources); err != nil {
		return nil, err
	}
	srcMap, _ := s.loadSources(ctx, []string{e.ID})
	e.Sources = srcMap[e.ID]
	e.TotalQuestions = 0
	for _, src := range e.Sources {
		e.TotalQuestions += src.QuestionCount
	}
	return &e, nil
}

func (s *Service) UpdateExam(ctx context.Context, id string, req UpdateExamRequest) (*Exam, error) {
	var e Exam
	err := s.db.QueryRow(ctx,
		`UPDATE exams
		 SET title = COALESCE(NULLIF($2, ''), title),
		     description = COALESCE(NULLIF($3, ''), description),
		     exam_type = COALESCE(NULLIF($4, ''), exam_type),
		     duration_minutes = COALESCE(NULLIF($5, 0), duration_minutes),
		     pass_mark_pct = COALESCE(NULLIF($6, 0.0), pass_mark_pct),
		     marks_per_question = COALESCE(NULLIF($7, 0.0), marks_per_question),
		     negative_marking = COALESCE($8, negative_marking),
		     negative_penalty = COALESCE(NULLIF($9, 0.0), negative_penalty),
		     shuffle = COALESCE($10, shuffle),
		     status = CASE WHEN $11 != '' THEN $11::exam_status ELSE status END
		 WHERE id = $1
		 RETURNING id, title, description, exam_type,
		           total_questions, duration_minutes, pass_mark_pct,
		           marks_per_question, negative_marking, negative_penalty,
		           shuffle, status::TEXT, created_at`,
		id, req.Title, req.Description, req.ExamType,
		req.DurationMinutes, req.PassMarkPct,
		req.MarksPerQuestion, req.NegativeMarking, req.NegativePenalty,
		req.Shuffle, req.Status,
	).Scan(&e.ID, &e.Title, &e.Description, &e.ExamType,
		&e.TotalQuestions, &e.DurationMinutes, &e.PassMarkPct,
		&e.MarksPerQuestion, &e.NegativeMarking, &e.NegativePenalty,
		&e.Shuffle, &e.Status, &e.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrExamNotFound
	}
	if err != nil {
		return nil, err
	}
	if len(req.Sources) > 0 {
		if err := s.setSources(ctx, e.ID, req.Sources); err != nil {
			return nil, err
		}
	}
	srcMap, _ := s.loadSources(ctx, []string{e.ID})
	e.Sources = srcMap[e.ID]
	e.TotalQuestions = 0
	for _, src := range e.Sources {
		e.TotalQuestions += src.QuestionCount
	}
	return &e, nil
}

// DeleteExam removes an exam and its sources (admin only).
func (s *Service) DeleteExam(ctx context.Context, id string) error {
	res, err := s.db.Exec(ctx, `DELETE FROM exams WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrExamNotFound
	}
	return nil
}

// PublishExam sets an exam to published status (admin only).
func (s *Service) PublishExam(ctx context.Context, id string) error {
	res, err := s.db.Exec(ctx, `UPDATE exams SET status='active'::exam_status WHERE id=$1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrExamNotFound
	}
	return nil
}

// StartAttempt begins a new exam attempt for a user.
func (s *Service) StartAttempt(ctx context.Context, userID, examID string) (*StartResponse, error) {
	// Verify active plan includes this exam
	var hasAccess bool
	_ = s.db.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM user_plans up
			JOIN plan_exams pe ON pe.plan_id = up.plan_id
			WHERE up.user_id=$1 AND up.active=true AND pe.exam_id=$2
		)`, userID, examID,
	).Scan(&hasAccess)
	if !hasAccess {
		return nil, ErrNoPlanAccess
	}

	exam, err := s.GetExam(ctx, examID)
	if err != nil {
		return nil, err
	}

	// Check for existing active attempt
	var existingID string
	err = s.db.QueryRow(ctx,
		`SELECT id FROM exam_attempts WHERE user_id=$1 AND exam_id=$2 AND status='in_progress'::attempt_status`,
		userID, examID,
	).Scan(&existingID)
	if err == nil {
		// Resume from Redis state
		return s.resumeAttempt(ctx, existingID, exam)
	}

	// Pick questions from each source bank
	type rawQ struct {
		ID                             string
		QuestionText                   string
		OptionA, OptionB, OptionC, OptionD string
	}
	var rawQs []rawQ
	seenIDs := map[string]bool{}
	for _, src := range exam.Sources {
		if src.QuestionCount <= 0 {
			continue
		}
		var bankRows interface{ Next() bool; Scan(...any) error; Close() }
		var err error
		if len(src.PinnedQuestionIDs) > 0 {
			// Use the exact pinned IDs — order preserved, no randomness
			bankRows, err = s.db.Query(ctx,
				`SELECT id, question_text, option_a, option_b, option_c, option_d
				 FROM questions
				 WHERE id = ANY($1) AND active = true`,
				src.PinnedQuestionIDs)
		} else {
			// Random selection from the bank
			bankRows, err = s.db.Query(ctx,
				`SELECT id, question_text, option_a, option_b, option_c, option_d
				 FROM questions
				 WHERE exam_set_id = $1 AND active = true
				 ORDER BY RANDOM()
				 LIMIT $2`,
				src.BankID, src.QuestionCount)
		}
		if err != nil {
			return nil, err
		}
		for bankRows.Next() {
			var q rawQ
			if err := bankRows.Scan(&q.ID, &q.QuestionText, &q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD); err != nil {
				bankRows.Close()
				return nil, err
			}
			if !seenIDs[q.ID] {
				seenIDs[q.ID] = true
				rawQs = append(rawQs, q)
			}
		}
		bankRows.Close()
	}
	if len(rawQs) == 0 {
		return nil, fmt.Errorf("no questions available in the question banks for this exam")
	}

	// Shuffle if enabled
	if exam.Shuffle {
		rand.Shuffle(len(rawQs), func(i, j int) { rawQs[i], rawQs[j] = rawQs[j], rawQs[i] })
	}

	attemptID := uuid.New().String()
	now := time.Now()
	expiresAt := now.Add(time.Duration(exam.DurationMinutes) * time.Minute)

	// Persist attempt in DB
	_, err = s.db.Exec(ctx,
		`INSERT INTO exam_attempts (id, user_id, exam_id, status, started_at, total_questions)
		 VALUES ($1,$2,$3,'in_progress'::attempt_status,$4,$5)`,
		attemptID, userID, examID, now, len(rawQs),
	)
	if err != nil {
		return nil, err
	}

	// Build question IDs list and Redis state
	qIDs := make([]string, len(rawQs))
	shuffled := make([]ShuffledQuestion, len(rawQs))
	for i, q := range rawQs {
		qIDs[i] = q.ID
		shuffled[i] = ShuffledQuestion{
			ID: q.ID, QuestionText: q.QuestionText,
			OptionA: q.OptionA, OptionB: q.OptionB, OptionC: q.OptionC, OptionD: q.OptionD,
			Position: i + 1,
		}
	}

	state := AttemptState{
		AttemptID:   attemptID,
		UserID:      userID,
		ExamID:      examID,
		StartedAt:   now,
		ExpiresAt:   expiresAt,
		Answers:     map[string]string{},
		QuestionIDs: qIDs,
	}
	stateJSON, _ := json.Marshal(state)
	ttl := time.Until(expiresAt) + attemptTTLBuffer
	s.rdb.Set(ctx, s.attemptKey(attemptID), stateJSON, ttl)

	return &StartResponse{
		AttemptID:        attemptID,
		ExamID:           examID,
		ExamTitle:        exam.Title,
		DurationMinutes:  exam.DurationMinutes,
		ExpiresAt:        expiresAt,
		Questions:        shuffled,
		SavedAnswers:     map[string]string{},
		MarksPerQuestion: exam.MarksPerQuestion,
		NegativeMarking:  exam.NegativeMarking,
		NegativePenalty:  exam.NegativePenalty,
	}, nil
}

// resumeAttempt loads an in-progress attempt from Redis.
func (s *Service) resumeAttempt(ctx context.Context, attemptID string, exam *Exam) (*StartResponse, error) {
	state, err := s.loadState(ctx, attemptID)
	if err != nil {
		return nil, ErrAttemptNotFound
	}

	if time.Now().After(state.ExpiresAt) {
		go s.AutoSubmit(context.Background(), attemptID)
		return nil, ErrAttemptExpired
	}

	// Reload question details for the saved order
	shuffled, err := s.loadShuffledQuestions(ctx, state.QuestionIDs)
	if err != nil {
		return nil, err
	}

	return &StartResponse{
		AttemptID:        attemptID,
		ExamID:           exam.ID,
		ExamTitle:        exam.Title,
		DurationMinutes:  exam.DurationMinutes,
		ExpiresAt:        state.ExpiresAt,
		Questions:        shuffled,
		SavedAnswers:     state.Answers,
		MarksPerQuestion: exam.MarksPerQuestion,
		NegativeMarking:  exam.NegativeMarking,
		NegativePenalty:  exam.NegativePenalty,
	}, nil
}

// SaveAnswer atomically updates a single answer in the Redis attempt state.
func (s *Service) SaveAnswer(ctx context.Context, attemptID, userID, questionID, answer string) error {
	state, err := s.loadState(ctx, attemptID)
	if err != nil {
		return ErrAttemptNotFound
	}
	if state.UserID != userID {
		return ErrAttemptNotFound
	}
	if time.Now().After(state.ExpiresAt) {
		go s.AutoSubmit(context.Background(), attemptID)
		return ErrAttemptExpired
	}

	// Preserve answers from attempts that started before hash-based storage.
	if err := s.migrateAnswers(ctx, attemptID, state.Answers); err != nil {
		return err
	}

	key := s.answersKey(attemptID)
	ttl := time.Until(state.ExpiresAt) + attemptTTLBuffer

	pipe := s.rdb.Pipeline()
	if answer == "" {
		pipe.HDel(ctx, key, questionID)
	} else {
		pipe.HSet(ctx, key, questionID, answer)
	}
	// Keep both keys alive until after expiry so an answer save also refreshes the attempt.
	pipe.Expire(ctx, s.attemptKey(attemptID), ttl)
	pipe.Expire(ctx, key, ttl)
	_, err = pipe.Exec(ctx)
	return err
}

// Submit finalises the attempt, grades it, and persists to DB.
func (s *Service) Submit(ctx context.Context, attemptID, userID string) (*Attempt, error) {
	state, err := s.loadState(ctx, attemptID)
	if err != nil {
		// Already submitted / Redis expired — check DB
		return s.getAttemptFromDB(ctx, attemptID)
	}
	if state.UserID != userID {
		return nil, ErrAttemptNotFound
	}
	return s.grade(ctx, state)
}

// AutoSubmit is called by the timer goroutine when the attempt expires.
func (s *Service) AutoSubmit(ctx context.Context, attemptID string) {
	state, err := s.loadState(ctx, attemptID)
	if err != nil {
		return
	}
	if _, err := s.grade(ctx, state); err != nil {
		log.Error().Err(err).Str("attempt_id", attemptID).Msg("AutoSubmit grading failed")
	}
}

// StartExpiredAttemptPoller runs a background worker that periodically scans
// Redis for attempts whose ExpiresAt has passed and auto-submits them.
// This catches timed-out attempts for users who disconnected or after a server restart.
func (s *Service) StartExpiredAttemptPoller(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = 30 * time.Second
	}
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := s.pollExpiredAttempts(ctx); err != nil {
					log.Warn().Err(err).Msg("expired attempt poller error")
				}
			}
		}
	}()
}

func (s *Service) pollExpiredAttempts(ctx context.Context) error {
	var cursor uint64
	for {
		keys, nextCursor, err := s.rdb.Scan(ctx, cursor, attemptKeyPrefix+"*", 100).Result()
		if err != nil {
			return err
		}
		for _, key := range keys {
			if strings.HasSuffix(key, attemptAnswersSuffix) {
				continue
			}
			attemptID := strings.TrimPrefix(key, attemptKeyPrefix)
			state, err := s.loadState(ctx, attemptID)
			if err != nil {
				continue
			}
			if time.Now().After(state.ExpiresAt) {
				go s.AutoSubmit(context.Background(), attemptID)
			}
		}
		cursor = nextCursor
		if cursor == 0 {
			break
		}
	}
	return nil
}

// grade scores the attempt and writes results to DB.
func (s *Service) grade(ctx context.Context, state *AttemptState) (*Attempt, error) {
	// Fetch correct answers for the attempt's question set
	if len(state.QuestionIDs) == 0 {
		return nil, fmt.Errorf("no questions in attempt state")
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, correct_option FROM questions WHERE id = ANY($1)`,
		state.QuestionIDs,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	correctMap := map[string]string{}
	for rows.Next() {
		var qID, correct string
		rows.Scan(&qID, &correct)
		correctMap[qID] = correct
	}

	correct := 0
	wrong := 0
	for qID, ans := range state.Answers {
		if ans == "" {
			continue // unattempted
		}
		if correctMap[qID] == ans {
			correct++
		} else {
			wrong++
		}
	}

	total := len(state.QuestionIDs)

	// Load exam marking scheme
	var passMark, marksPerQ, negPenalty float64
	var negMarking bool
	_ = s.db.QueryRow(ctx,
		`SELECT pass_mark_pct, marks_per_question, negative_marking, negative_penalty FROM exams WHERE id=$1`,
		state.ExamID,
	).Scan(&passMark, &marksPerQ, &negMarking, &negPenalty)
	if marksPerQ == 0 {
		marksPerQ = 1.0
	}

	// Raw score = correct * marks_per_question - wrong * penalty (floor at 0)
	totalMarks := float64(total) * marksPerQ
	rawScore := float64(correct)*marksPerQ
	if negMarking {
		rawScore -= float64(wrong) * negPenalty
	}
	if rawScore < 0 {
		rawScore = 0
	}

	// Percentage score (for pass/fail threshold)
	score := 0.0
	if totalMarks > 0 {
		score = rawScore / totalMarks * 100
	}
	passed := score >= passMark

	now := time.Now()
	answersJSON, _ := json.Marshal(state.Answers)
	questionIDsJSON, _ := json.Marshal(state.QuestionIDs)

	submitStatus := "graded"
	if time.Now().After(state.ExpiresAt) {
		submitStatus = "timed_out"
	}

	cmdTag, err := s.db.Exec(ctx,
		`UPDATE exam_attempts
		 SET status=$1::attempt_status, submitted_at=$2, score=$3, passed=$4,
		     correct_answers=$5, wrong_answers=$6, raw_score=$7, total_marks=$8,
		     answers=$9, question_ids=$10
		 WHERE id=$11 AND status='in_progress'::attempt_status`,
		submitStatus, now, score, passed, correct, wrong, rawScore, totalMarks,
		answersJSON, questionIDsJSON, state.AttemptID,
	)
	if err != nil {
		return nil, err
	}
	if cmdTag.RowsAffected() == 0 {
		// Another submission already finalised this attempt; return the persisted result.
		return s.getAttemptFromDB(ctx, state.AttemptID)
	}

	// Remove from Redis
	s.rdb.Del(ctx, s.attemptKey(state.AttemptID), s.answersKey(state.AttemptID))

	attempt := &Attempt{
		ID:             state.AttemptID,
		UserID:         state.UserID,
		ExamID:         state.ExamID,
		Status:         submitStatus,
		StartedAt:      state.StartedAt,
		SubmittedAt:    &now,
		Score:          &score,
		RawScore:       &rawScore,
		TotalMarks:     &totalMarks,
		Passed:         &passed,
		TotalQuestions: total,
		CorrectAnswers: &correct,
		WrongAnswers:   &wrong,
	}

	// Record exam event
	go func() {
		evtPayload, _ := json.Marshal(map[string]interface{}{
			"score": score, "passed": passed, "correct": correct, "wrong": wrong,
			"raw_score": rawScore, "total_marks": totalMarks, "total": total,
		})
		_, _ = s.db.Exec(context.Background(),
			`INSERT INTO exam_events (attempt_id, event_type, payload)
			 VALUES ($1, 'submitted', $2)`,
			state.AttemptID, evtPayload,
		)
	}()

	return attempt, nil
}

// GetMyAttempts returns all attempts for a user.
func (s *Service) GetMyAttempts(ctx context.Context, userID string) ([]Attempt, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, user_id, exam_id, status::TEXT, started_at, submitted_at,
		        score, passed, total_questions, correct_answers
		 FROM exam_attempts WHERE user_id=$1 ORDER BY started_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var attempts []Attempt
	for rows.Next() {
		var a Attempt
		if err := rows.Scan(&a.ID, &a.UserID, &a.ExamID, &a.Status, &a.StartedAt, &a.SubmittedAt,
			&a.Score, &a.Passed, &a.TotalQuestions, &a.CorrectAnswers); err != nil {
			return nil, err
		}
		attempts = append(attempts, a)
	}
	return attempts, nil
}

func (s *Service) attemptKey(attemptID string) string {
	return attemptKeyPrefix + attemptID
}

func (s *Service) answersKey(attemptID string) string {
	return attemptKeyPrefix + attemptID + attemptAnswersSuffix
}

// loadState fetches attempt state from Redis and merges atomic answer updates.
func (s *Service) loadState(ctx context.Context, attemptID string) (*AttemptState, error) {
	raw, err := s.rdb.Get(ctx, s.attemptKey(attemptID)).Bytes()
	if err != nil {
		return nil, ErrAttemptNotFound
	}
	var state AttemptState
	if err := json.Unmarshal(raw, &state); err != nil {
		return nil, err
	}
	if state.Answers == nil {
		state.Answers = map[string]string{}
	}

	// Atomic answers hash takes precedence over the legacy JSON blob.
	answers, err := s.rdb.HGetAll(ctx, s.answersKey(attemptID)).Result()
	if err != nil {
		return nil, err
	}
	if len(answers) > 0 {
		state.Answers = answers
	}
	return &state, nil
}

// migrateAnswers copies any answers stored in the legacy JSON blob into the
// atomic Redis Hash once. This preserves in-progress attempts that started
// before the hash-based storage was introduced.
func (s *Service) migrateAnswers(ctx context.Context, attemptID string, answers map[string]string) error {
	if len(answers) == 0 {
		return nil
	}
	key := s.answersKey(attemptID)
	exists, err := s.rdb.Exists(ctx, key).Result()
	if err != nil {
		return err
	}
	if exists > 0 {
		return nil
	}
	pairs := make([]string, 0, len(answers)*2)
	for qid, ans := range answers {
		pairs = append(pairs, qid, ans)
	}
	return s.rdb.HMSet(ctx, key, pairs).Err()
}

func (s *Service) getAttemptFromDB(ctx context.Context, attemptID string) (*Attempt, error) {
	var a Attempt
	err := s.db.QueryRow(ctx,
		`SELECT id, user_id, exam_id, status::TEXT, started_at, submitted_at,
		        score, raw_score, total_marks, passed,
		        total_questions, correct_answers, wrong_answers,
		        violation_count, is_flagged, webcam_enabled
		 FROM exam_attempts WHERE id=$1`, attemptID,
	).Scan(&a.ID, &a.UserID, &a.ExamID, &a.Status, &a.StartedAt, &a.SubmittedAt,
		&a.Score, &a.RawScore, &a.TotalMarks, &a.Passed,
		&a.TotalQuestions, &a.CorrectAnswers, &a.WrongAnswers,
		&a.ViolationCount, &a.IsFlagged, &a.WebcamEnabled)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrAttemptNotFound
	}
	return &a, err
}

// LogProctoringEvent records a single proctoring violation and updates attempt counters.
func (s *Service) LogProctoringEvent(ctx context.Context, attemptID, userID string, evt ProctoringEvent) error {
	metaJSON, _ := json.Marshal(evt.Meta)
	if metaJSON == nil {
		metaJSON = []byte("{}")
	}
	// Insert event
	_, err := s.db.Exec(ctx,
		`INSERT INTO exam_events (attempt_id, user_id, event_type, payload)
		 VALUES ($1, $2, $3::exam_event_type, $4)`,
		attemptID, userID, evt.Type,
		json.RawMessage(append([]byte(`{"severity":"`+evt.Severity+`","meta":`), append(metaJSON, '}')...)),
	)
	if err != nil {
		return err
	}
	// For critical severity: bump violation count and flag if threshold reached
	if evt.Severity == "critical" {
		_, err = s.db.Exec(ctx,
			`UPDATE exam_attempts
			 SET violation_count = violation_count + 1,
			     is_flagged = (violation_count + 1 >= 3)
			 WHERE id = $1 AND status = 'in_progress'::attempt_status`,
			attemptID)
	}
	return err
}

// GetViolations returns all proctoring events for an attempt (admin use).
func (s *Service) GetViolations(ctx context.Context, attemptID string) ([]ProctoringViolationRow, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, event_type::TEXT, payload->>'severity', occurred_at
		 FROM exam_events
		 WHERE attempt_id = $1
		   AND event_type::TEXT NOT IN ('session_start','question_viewed','answer_saved','manual_submit','auto_submit','reconnect')
		 ORDER BY occurred_at ASC`,
		attemptID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []ProctoringViolationRow
	for rows.Next() {
		var r ProctoringViolationRow
		var sev *string
		if err := rows.Scan(&r.ID, &r.EventType, &sev, &r.OccurredAt); err != nil {
			return nil, err
		}
		if sev != nil {
			r.Severity = *sev
		}
		out = append(out, r)
	}
	return out, nil
}

func (s *Service) loadShuffledQuestions(ctx context.Context, qIDs []string) ([]ShuffledQuestion, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, question_text, option_a, option_b, option_c, option_d
		 FROM questions WHERE id = ANY($1)`, qIDs)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	qMap := map[string]ShuffledQuestion{}
	for rows.Next() {
		var q ShuffledQuestion
		rows.Scan(&q.ID, &q.QuestionText, &q.OptionA, &q.OptionB, &q.OptionC, &q.OptionD)
		qMap[q.ID] = q
	}

	result := make([]ShuffledQuestion, 0, len(qIDs))
	for i, id := range qIDs {
		if q, ok := qMap[id]; ok {
			q.Position = i + 1
			result = append(result, q)
		}
	}
	return result, nil
}
