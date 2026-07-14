package parser

import (
	"archive/zip"
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"path/filepath"
	"regexp"
	"strings"
)

// ParsedQuestion is the output type of the MCQ parser.
type ParsedQuestion struct {
	QuestionText  string `json:"question_text"`
	OptionA       string `json:"option_a"`
	OptionB       string `json:"option_b"`
	OptionC       string `json:"option_c"`
	OptionD       string `json:"option_d"`
	CorrectOption string `json:"correct_option"`
	Explanation   string `json:"explanation"`
}

// MCQ format (from sample):
//
//   {N}. {question text}: (a) option (b) option (c) option (d) option Answer: ({letter})
//
// Options may span across text segments in the XML so we work on normalized plain text.

var (
	reQuestion = regexp.MustCompile(
		`(?i)\d+\.\s+(.+?)\s*\(a\)\s*(.+?)\s*\(b\)\s*(.+?)\s*\(c\)\s*(.+?)\s*\(d\)\s*(.+?)\s+Answer\s*:\s*\(([abcd])\)`,
	)
)

// ParseFile dispatches to the appropriate parser based on file extension.
func ParseFile(filename string, data []byte) ([]ParsedQuestion, error) {
	ext := strings.ToLower(filepath.Ext(filename))
	switch ext {
	case ".docx":
		return ParseDOCX(data)
	case ".pdf":
		return ParsePDF(data)
	default:
		return nil, fmt.Errorf("unsupported file type: %s", ext)
	}
}

// ParseDOCX extracts plain text from word/document.xml and runs the regex parser.
func ParseDOCX(data []byte) ([]ParsedQuestion, error) {
	r, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("not a valid docx: %w", err)
	}

	var docXML []byte
	for _, f := range r.File {
		if f.Name == "word/document.xml" {
			rc, err := f.Open()
			if err != nil {
				return nil, err
			}
			docXML, err = io.ReadAll(rc)
			rc.Close()
			if err != nil {
				return nil, err
			}
			break
		}
	}
	if docXML == nil {
		return nil, fmt.Errorf("word/document.xml not found in docx")
	}

	text := extractTextFromWordXML(docXML)
	return parseText(text)
}

// ParsePDF extracts text using pdfcpu content streams and runs the regex parser.
func ParsePDF(data []byte) ([]ParsedQuestion, error) {
	text, err := extractTextFromPDF(data)
	if err != nil {
		return nil, fmt.Errorf("pdf text extraction: %w", err)
	}
	return parseText(text)
}

// extractTextFromWordXML walks the XML paragraph/run structure and builds
// normalized text, preserving paragraph breaks as spaces.
func extractTextFromWordXML(xmlData []byte) string {
	type xmlToken struct {
		name  string
		value string
	}

	decoder := xml.NewDecoder(bytes.NewReader(xmlData))
	var sb strings.Builder
	inParagraph := false
	_ = inParagraph

	for {
		tok, err := decoder.Token()
		if err != nil {
			break
		}
		switch t := tok.(type) {
		case xml.StartElement:
			if t.Name.Local == "p" {
				sb.WriteString(" ")
			}
		case xml.CharData:
			sb.Write(t)
		}
	}

	// Normalise whitespace
	text := sb.String()
	text = strings.ReplaceAll(text, "\t", " ")
	text = strings.ReplaceAll(text, "\r\n", " ")
	text = strings.ReplaceAll(text, "\n", " ")
	text = regexp.MustCompile(`\s{2,}`).ReplaceAllString(text, " ")
	return strings.TrimSpace(text)
}

// extractTextFromPDF uses pdfcpu to extract plain text per page.
func extractTextFromPDF(data []byte) (string, error) {
	// pdfcpu v0.x API: extract page content as plain strings
	// We use the lower-level approach: write to temp and use pdfcpu's ExtractText
	// For now use a simpler approach: read raw content streams for text operators
	// This works for digitally typed PDFs (no OCR needed).
	text, err := extractPDFText(data)
	if err != nil {
		return "", err
	}
	return text, nil
}

// parseText runs the regex parser against normalised text and returns parsed questions.
func parseText(text string) ([]ParsedQuestion, error) {
	matches := reQuestion.FindAllStringSubmatch(text, -1)
	if len(matches) == 0 {
		return nil, fmt.Errorf("no MCQ questions found — check file format")
	}

	parsed := make([]ParsedQuestion, 0, len(matches))
	for _, m := range matches {
		answer := strings.ToUpper(strings.TrimSpace(m[6]))
		q := ParsedQuestion{
			QuestionText:  clean(m[1]),
			OptionA:       clean(m[2]),
			OptionB:       clean(m[3]),
			OptionC:       clean(m[4]),
			OptionD:       clean(m[5]),
			CorrectOption: answer,
		}
		parsed = append(parsed, q)
	}
	return parsed, nil
}

// reLeadingGarbage matches everything up to and including the last chapter/section
// heading pattern that appears before the real question text in the first question.
// e.g. "...1207–1354 1. ANATOMY & PHYSIOLOGY Multiple Choice Questions 1. Oxygen enters..."
// We strip anything before a standalone sentence-starting phrase by finding the last
// occurrence of a digit+dot+space that introduces an option-bearing question.
var reCleanPrefix = regexp.MustCompile(`^.*?\d+[\.\-–]\d+\s+\d+\.\s+[A-Z &]+[A-Z]\s+Multiple Choice Questions\s+\d+\.\s+`)

func clean(s string) string {
	s = strings.TrimSpace(s)
	// Strip chapter/TOC prefixes (only present in the very first question)
	if reCleanPrefix.MatchString(s) {
		loc := reCleanPrefix.FindStringIndex(s)
		if loc != nil {
			s = s[loc[1]:]
		}
	}
	// Remove trailing colon from question text (formatting artifact)
	s = strings.TrimSuffix(s, ":")
	return strings.TrimSpace(s)
}
