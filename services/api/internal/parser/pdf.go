package parser

import (
	"bytes"
	"fmt"
	"io"
	"regexp"
	"strings"

	"github.com/pdfcpu/pdfcpu/pkg/api"
	"github.com/pdfcpu/pdfcpu/pkg/pdfcpu/model"
)

// extractPDFText uses pdfcpu to extract plain text from a digitally typed PDF.
// It reads all pages and concatenates their text content via ExtractContent callback.
func extractPDFText(data []byte) (string, error) {
	conf := model.NewDefaultConfiguration()
	conf.ValidationMode = model.ValidationRelaxed

	r := bytes.NewReader(data)
	var sb strings.Builder

	err := api.ExtractContent(r, nil, func(reader io.Reader, pageNum int) error {
		content, err := io.ReadAll(reader)
		if err != nil {
			return nil // skip page on error
		}
		sb.WriteString(extractTextFromContentStream(string(content)))
		sb.WriteString(" ")
		return nil
	}, conf)
	if err != nil {
		return "", fmt.Errorf("pdfcpu extract error: %w", err)
	}

	text := sb.String()
	text = regexp.MustCompile(`\s{2,}`).ReplaceAllString(text, " ")
	return strings.TrimSpace(text), nil
}

// extractTextFromContentStream parses PDF content stream operators to get text.
// Handles: (text)Tj  [(text)]TJ  (text) Tj patterns.
var (
	reTj  = regexp.MustCompile(`\(([^)]*)\)\s*Tj`)
	reTJ  = regexp.MustCompile(`\[([^\]]*)\]\s*TJ`)
	reStr = regexp.MustCompile(`\(([^)]*)\)`)
)

func extractTextFromContentStream(stream string) string {
	var sb strings.Builder

	// Extract (text)Tj
	for _, m := range reTj.FindAllStringSubmatch(stream, -1) {
		sb.WriteString(decodePDFString(m[1]))
		sb.WriteString(" ")
	}

	// Extract [(text1)(text2)...]TJ
	for _, m := range reTJ.FindAllStringSubmatch(stream, -1) {
		for _, sm := range reStr.FindAllStringSubmatch(m[1], -1) {
			sb.WriteString(decodePDFString(sm[1]))
		}
		sb.WriteString(" ")
	}

	return sb.String()
}

// decodePDFString handles basic PDF string escape sequences.
func decodePDFString(s string) string {
	s = strings.ReplaceAll(s, `\n`, "\n")
	s = strings.ReplaceAll(s, `\r`, "\r")
	s = strings.ReplaceAll(s, `\t`, "\t")
	s = strings.ReplaceAll(s, `\\`, `\`)
	s = strings.ReplaceAll(s, `\(`, "(")
	s = strings.ReplaceAll(s, `\)`, ")")
	return s
}
