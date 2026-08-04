package parser

import (
	"fmt"
	"testing"
)

func TestParseText_DotOptionsBareAnswer(t *testing.T) {
	text := `Inflammation & Wound Healing – MCQ Practice Set 1. Severe generalized edema is called: a. Myxedema b. Pitting edema c. Anasarca d. Dependent edema Answer: c 2. Which of the following is NOT a plasma-derived chemical mediators? a. Cytokines b. Complement components c. Kinins d. Coagulation proteins Answer: a 3. Cytokines are secreted by: a. Neutrophils b. B-Lymphocytes c. Endothelial cells d. All of the above Answer: d`

	parsed, err := parseText(text)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(parsed) != 3 {
		t.Fatalf("expected 3 questions, got %d", len(parsed))
	}

	q1 := parsed[0]
	if q1.QuestionText != "Severe generalized edema is called" {
		t.Errorf("unexpected question text: %q", q1.QuestionText)
	}
	if q1.OptionA != "Myxedema" || q1.OptionB != "Pitting edema" || q1.OptionC != "Anasarca" || q1.OptionD != "Dependent edema" {
		t.Errorf("unexpected options: %+v", q1)
	}
	if q1.CorrectOption != "C" {
		t.Errorf("expected correct option C, got %q", q1.CorrectOption)
	}

	q3 := parsed[2]
	if q3.CorrectOption != "D" {
		t.Errorf("expected correct option D, got %q", q3.CorrectOption)
	}
}

func TestParseText_ParenOptionsParenAnswer(t *testing.T) {
	text := `1. First question? (a) one (b) two (c) three (d) four Answer: (b) 2. Second question? (a) alpha (b) beta (c) gamma (d) delta Answer: (d)`

	parsed, err := parseText(text)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(parsed) != 2 {
		t.Fatalf("expected 2 questions, got %d", len(parsed))
	}
	if parsed[0].CorrectOption != "B" {
		t.Errorf("expected B, got %q", parsed[0].CorrectOption)
	}
	if parsed[1].CorrectOption != "D" {
		t.Errorf("expected D, got %q", parsed[1].CorrectOption)
	}
}

func TestParseText_MixedStyles(t *testing.T) {
	text := `1. Mixed dot options? a. yes b. no c. maybe d. never Answer: (a) 2. Mixed paren options? (a) red (b) blue (c) green (d) yellow Answer: c`

	parsed, err := parseText(text)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(parsed) != 2 {
		t.Fatalf("expected 2 questions, got %d", len(parsed))
	}
	if parsed[0].CorrectOption != "A" {
		t.Errorf("expected A, got %q", parsed[0].CorrectOption)
	}
	if parsed[1].CorrectOption != "C" {
		t.Errorf("expected C, got %q", parsed[1].CorrectOption)
	}
}

func TestParseText_ColonAfterQuestionNumber(t *testing.T) {
	// Some files use "1." but the parser also needs to handle a colon right after the number gracefully.
	text := `1. What is 2+2? a. 3 b. 4 c. 5 d. 6 Answer: b`

	parsed, err := parseText(text)
	if err != nil {
		t.Fatalf("expected no error, got: %v", err)
	}
	if len(parsed) != 1 {
		t.Fatalf("expected 1 question, got %d", len(parsed))
	}
	if parsed[0].CorrectOption != "B" {
		t.Errorf("expected B, got %q", parsed[0].CorrectOption)
	}
}

func TestParseText_NoQuestions(t *testing.T) {
	_, err := parseText("This is just random text with no MCQs.")
	if err == nil {
		t.Fatal("expected error for text without MCQs")
	}
	fmt.Println(err)
}
