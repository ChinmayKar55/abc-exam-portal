package exam

import (
	"encoding/json"
	"time"
)

// ExamSource represents one question bank's contribution to an exam.
type ExamSource struct {
	BankID             string   `json:"bank_id"`
	BankName           string   `json:"bank_name"`
	QuestionCount      int      `json:"question_count"`
	PinnedQuestionIDs  []string `json:"pinned_question_ids"` // empty = random selection; always serialized so frontend can distinguish
}

// Exam definition (admin-created)
type Exam struct {
	ID                string       `json:"id"`
	Title             string       `json:"title"`
	Description       string       `json:"description"`
	ExamType          string       `json:"exam_type"`
	TotalQuestions    int          `json:"total_questions"` // computed: SUM of sources
	DurationMinutes   int          `json:"duration_minutes"`
	PassMarkPct       float64      `json:"pass_mark_pct"`
	MarksPerQuestion  float64      `json:"marks_per_question"`
	NegativeMarking   bool         `json:"negative_marking"`
	NegativePenalty   float64      `json:"negative_penalty"`
	Shuffle           bool         `json:"shuffle"`
	Status            string       `json:"status"` // draft | active | archived
	Sources           []ExamSource `json:"sources"`
	CreatedAt         time.Time    `json:"created_at"`
}

// ShuffledQuestion is what the student sees (no correct_option)
type ShuffledQuestion struct {
	ID           string `json:"id"`
	QuestionText string `json:"question_text"`
	OptionA      string `json:"option_a"`
	OptionB      string `json:"option_b"`
	OptionC      string `json:"option_c"`
	OptionD      string `json:"option_d"`
	Position     int    `json:"position"`
}

// AttemptState is stored in Redis during an active exam
type AttemptState struct {
	AttemptID   string            `json:"attempt_id"`
	UserID      string            `json:"user_id"`
	ExamID      string            `json:"exam_id"`
	StartedAt   time.Time         `json:"started_at"`
	ExpiresAt   time.Time         `json:"expires_at"`
	Answers     map[string]string `json:"answers"`      // questionID -> "A"|"B"|"C"|"D"
	QuestionIDs []string          `json:"question_ids"` // shuffled order
}

// Attempt row in DB
type Attempt struct {
	ID              string     `json:"id"`
	UserID          string     `json:"user_id"`
	ExamID          string     `json:"exam_id"`
	Status          string     `json:"status"` // in_progress | submitted | timed_out | graded
	StartedAt       time.Time  `json:"started_at"`
	SubmittedAt     *time.Time `json:"submitted_at,omitempty"`
	Score           *float64   `json:"score,omitempty"`
	RawScore        *float64   `json:"raw_score,omitempty"`
	TotalMarks      *float64   `json:"total_marks,omitempty"`
	Passed          *bool      `json:"passed,omitempty"`
	TotalQuestions  int        `json:"total_questions"`
	CorrectAnswers  *int       `json:"correct_answers,omitempty"`
	WrongAnswers    *int       `json:"wrong_answers,omitempty"`
	ViolationCount  int        `json:"violation_count"`
	IsFlagged       bool       `json:"is_flagged"`
	WebcamEnabled   bool       `json:"webcam_enabled"`
}

// ProctoringEvent is a single violation logged from the client.
type ProctoringEvent struct {
	Type     string                 `json:"type"`     // matches exam_event_type values
	Severity string                 `json:"severity"` // "warn" | "critical"
	Meta     map[string]interface{} `json:"meta,omitempty"`
}

// ProctoringViolationRow is returned by admin queries.
type ProctoringViolationRow struct {
	ID         string    `json:"id"`
	EventType  string    `json:"event_type"`
	Severity   string    `json:"severity"`
	OccurredAt time.Time `json:"occurred_at"`
	Meta       []byte    `json:"meta"`
}

// Request/response types
type CreateExamRequest struct {
	Title            string       `json:"title"`
	Description      string       `json:"description"`
	ExamType         string       `json:"exam_type"`
	DurationMinutes  int          `json:"duration_minutes"`
	PassMarkPct      float64      `json:"pass_mark_pct"`
	MarksPerQuestion float64      `json:"marks_per_question"`
	NegativeMarking  bool         `json:"negative_marking"`
	NegativePenalty  float64      `json:"negative_penalty"`
	Shuffle          bool         `json:"shuffle"`
	Status           string       `json:"status"` // draft | active; defaults to draft
	Sources          []ExamSource `json:"sources"`
}

type UpdateExamRequest struct {
	Title            string       `json:"title,omitempty"`
	Description      string       `json:"description,omitempty"`
	ExamType         string       `json:"exam_type,omitempty"`
	DurationMinutes  int          `json:"duration_minutes,omitempty"`
	PassMarkPct      float64      `json:"pass_mark_pct,omitempty"`
	MarksPerQuestion float64      `json:"marks_per_question,omitempty"`
	NegativeMarking  *bool        `json:"negative_marking"`
	NegativePenalty  float64      `json:"negative_penalty,omitempty"`
	Shuffle          *bool        `json:"shuffle"`
	Status           string       `json:"status,omitempty"` // draft | active | archived
	Sources          []ExamSource `json:"sources,omitempty"`
}

type SaveAnswerRequest struct {
	QuestionID string `json:"question_id"`
	Answer     string `json:"answer"` // "A"|"B"|"C"|"D"|"" (empty = clear)
}

type StartResponse struct {
	AttemptID        string             `json:"attempt_id"`
	ExamID           string             `json:"exam_id"`
	ExamTitle        string             `json:"exam_title"`
	DurationMinutes  int                `json:"duration_minutes"`
	ExpiresAt        time.Time          `json:"expires_at"`
	Questions        []ShuffledQuestion `json:"questions"`
	SavedAnswers     map[string]string  `json:"saved_answers"`
	MarksPerQuestion float64            `json:"marks_per_question"`
	NegativeMarking  bool               `json:"negative_marking"`
	NegativePenalty  float64            `json:"negative_penalty"`
}

// WSMessage is sent/received over the WebSocket connection
type WSMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload,omitempty"`
}
