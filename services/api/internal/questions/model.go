package questions

import "time"

type ExamSet struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	QuestionCount int  `json:"question_count,omitempty"`
}

type Question struct {
	ID            string    `json:"id"`
	ExamSetID     string    `json:"exam_set_id"`
	QuestionText  string    `json:"question_text"`
	OptionA       string    `json:"option_a"`
	OptionB       string    `json:"option_b"`
	OptionC       string    `json:"option_c"`
	OptionD       string    `json:"option_d"`
	CorrectOption string    `json:"correct_option,omitempty"`
	Explanation   string    `json:"explanation,omitempty"`
	Difficulty    string    `json:"difficulty"`
	Active        bool      `json:"active"`
	CreatedAt     time.Time `json:"created_at"`
}

type CreateQuestionRequest struct {
	ExamSetID     string `json:"exam_set_id"`
	QuestionText  string `json:"question_text"`
	OptionA       string `json:"option_a"`
	OptionB       string `json:"option_b"`
	OptionC       string `json:"option_c"`
	OptionD       string `json:"option_d"`
	CorrectOption string `json:"correct_option"`
	Explanation   string `json:"explanation"`
	Difficulty    string `json:"difficulty"`
}

type UpdateQuestionRequest struct {
	ExamSetID     *string `json:"exam_set_id,omitempty"`
	QuestionText  *string `json:"question_text"`
	OptionA       *string `json:"option_a"`
	OptionB       *string `json:"option_b"`
	OptionC       *string `json:"option_c"`
	OptionD       *string `json:"option_d"`
	CorrectOption *string `json:"correct_option"`
	Explanation   *string `json:"explanation"`
	Difficulty    *string `json:"difficulty"`
	Active        *bool   `json:"active"`
}

type CreateExamSetRequest struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

type UpdateExamSetRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
}

type ListFilter struct {
	ExamSetID  string
	Difficulty string
	Page       int
	Limit      int
}

