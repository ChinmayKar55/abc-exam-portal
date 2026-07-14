package questions

import (
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abc-exam/api/internal/auth"
	"github.com/abc-exam/api/internal/parser"
)


type Handler struct {
	svc *Service
	db  *pgxpool.Pool
}

func NewHandler(svc *Service, db *pgxpool.Pool) *Handler {
	return &Handler{svc: svc, db: db}
}

func (h *Handler) ListExamSets(c *fiber.Ctx) error {
	sets, err := h.svc.ListExamSets(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": sets})
}

func (h *Handler) GetExamSet(c *fiber.Ctx) error {
	es, err := h.svc.GetExamSet(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, ErrExamSetNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": es})
}

func (h *Handler) CreateExamSet(c *fiber.Ctx) error {
	var req CreateExamSetRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.Name) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	es, err := h.svc.CreateExamSet(c.Context(), req)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": es})
}

func (h *Handler) UpdateExamSet(c *fiber.Ctx) error {
	var req UpdateExamSetRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	es, err := h.svc.UpdateExamSet(c.Context(), c.Params("id"), req)
	if err != nil {
		if errors.Is(err, ErrExamSetNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": es})
}

func (h *Handler) DeleteExamSet(c *fiber.Ctx) error {
	if err := h.svc.DeleteExamSet(c.Context(), c.Params("id")); err != nil {
		if errors.Is(err, ErrExamSetNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		if errors.Is(err, ErrExamSetInUse) {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "exam set deleted"})
}

func (h *Handler) ListQuestions(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	f := ListFilter{
		ExamSetID: c.Query("exam_set_id"),
		Difficulty: c.Query("difficulty"),
		Page:       page,
		Limit:      limit,
	}
	qs, total, err := h.svc.ListQuestions(c.Context(), f)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    qs,
		"meta":    fiber.Map{"total": total, "page": page, "limit": limit},
	})
}

func (h *Handler) GetQuestion(c *fiber.Ctx) error {
	q, err := h.svc.GetQuestion(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, ErrQuestionNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": q})
}

func (h *Handler) CreateQuestion(c *fiber.Ctx) error {
	var req CreateQuestionRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := validateQuestion(req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	q, err := h.svc.CreateQuestion(c.Context(), req)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": q})
}

func (h *Handler) ListQuestionsByExamSet(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "50"))
	f := ListFilter{
		ExamSetID: c.Params("id"),
		Difficulty: c.Query("difficulty"),
		Page:       page,
		Limit:      limit,
	}
	qs, total, err := h.svc.ListQuestions(c.Context(), f)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    qs,
		"meta":    fiber.Map{"total": total, "page": page, "limit": limit},
	})
}

func (h *Handler) UpdateQuestion(c *fiber.Ctx) error {
	var req UpdateQuestionRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	q, err := h.svc.UpdateQuestion(c.Context(), c.Params("id"), req)
	if err != nil {
		if errors.Is(err, ErrQuestionNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": q})
}

func (h *Handler) UpdateParsedQuestion(c *fiber.Ctx) error {
	uploadID := c.Params("id")
	idx, _ := strconv.Atoi(c.Params("idx"))
	if idx < 0 {
		return fiber.NewError(fiber.StatusBadRequest, "invalid question index")
	}
	var req parser.ParsedQuestion
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	var parsedData []byte
	var status string
	err := h.db.QueryRow(c.Context(),
		`SELECT parsed_data, parse_status FROM pdf_uploads WHERE id = $1`, uploadID,
	).Scan(&parsedData, &status)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "upload not found")
	}
	if status != "parsed" && status != "failed" {
		return fiber.NewError(fiber.StatusBadRequest, "upload cannot be edited in current state")
	}
	var parsed []parser.ParsedQuestion
	if err := json.Unmarshal(parsedData, &parsed); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to read parsed data")
	}
	if idx >= len(parsed) {
		return fiber.NewError(fiber.StatusBadRequest, "question index out of range")
	}
	parsed[idx] = req
	newData, _ := json.Marshal(parsed)
	_, err = h.db.Exec(c.Context(),
		`UPDATE pdf_uploads SET parsed_data = $1, questions_extracted = $2 WHERE id = $3`,
		newData, len(parsed), uploadID,
	)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": req})
}

func (h *Handler) DeleteQuestion(c *fiber.Ctx) error {
	if err := h.svc.DeleteQuestion(c.Context(), c.Params("id")); err != nil {
		if errors.Is(err, ErrQuestionNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "question deactivated"})
}

// UploadParse handles file upload, parses MCQs, stores parsed_data in pdf_uploads,
// and returns a preview for admin review before publishing.
func (h *Handler) UploadParse(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)

	file, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file is required")
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if ext != ".docx" && ext != ".pdf" {
		return fiber.NewError(fiber.StatusBadRequest, "only .docx and .pdf files are supported")
	}

	f, err := file.Open()
	if err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to open uploaded file")
	}
	defer f.Close()

	data := make([]byte, file.Size)
	if _, err := f.Read(data); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to read uploaded file")
	}

	// Store upload record as processing
	uploadID := uuid.New().String()
	storePath := fmt.Sprintf("./storage/uploads/%s%s", uploadID, ext)
	_, _ = h.db.Exec(c.Context(),
		`INSERT INTO pdf_uploads (id, uploaded_by, filename, file_path, file_size, parse_status)
		 VALUES ($1, $2, $3, $4, $5, 'processing')`,
		uploadID, userID, file.Filename, storePath, file.Size,
	)

	// Parse
	parsed, err := parser.ParseFile(file.Filename, data)
	if err != nil {
		_, _ = h.db.Exec(c.Context(),
			`UPDATE pdf_uploads SET parse_status='failed', error_log=$1 WHERE id=$2`,
			err.Error(), uploadID,
		)
		return fiber.NewError(fiber.StatusUnprocessableEntity, fmt.Sprintf("parse error: %s", err.Error()))
	}

	parsedJSON, _ := json.Marshal(parsed)
	_, _ = h.db.Exec(c.Context(),
		`UPDATE pdf_uploads SET
		   parse_status='parsed',
		   questions_extracted=$1,
		   parsed_data=$2,
		   parsed_at=$3
		 WHERE id=$4`,
		len(parsed), parsedJSON, time.Now(), uploadID,
	)

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":             true,
		"upload_id":           uploadID,
		"questions_extracted": len(parsed),
		"preview":             parsed[:min(5, len(parsed))],
		"message":             fmt.Sprintf("Parsed %d questions. Call POST /questions/uploads/:id/publish to add to question bank.", len(parsed)),
	})
}

// PreviewUpload returns the full parsed question list for review before publishing.
func (h *Handler) PreviewUpload(c *fiber.Ctx) error {
	uploadID := c.Params("id")
	var parsedData []byte
	var status string
	err := h.db.QueryRow(c.Context(),
		`SELECT parsed_data, parse_status FROM pdf_uploads WHERE id = $1`, uploadID,
	).Scan(&parsedData, &status)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "upload not found")
	}
	var parsed []parser.ParsedQuestion
	if err := json.Unmarshal(parsedData, &parsed); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to read parsed data")
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data": fiber.Map{
			"upload_id":           uploadID,
			"parse_status":        status,
			"questions_extracted": len(parsed),
			"questions":           parsed,
		},
	})
}

// PublishUpload moves parsed questions from pdf_uploads into the questions table.
func (h *Handler) PublishUpload(c *fiber.Ctx) error {
	uploadID := c.Params("id")

	var body struct {
		ExamSetID string `json:"exam_set_id"`
	}
	if err := c.BodyParser(&body); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if body.ExamSetID == "" {
		return fiber.NewError(fiber.StatusBadRequest, "exam_set_id is required")
	}

	var parsedData []byte
	var status string
	err := h.db.QueryRow(c.Context(),
		`SELECT parsed_data, parse_status FROM pdf_uploads WHERE id = $1`, uploadID,
	).Scan(&parsedData, &status)
	if err != nil {
		return fiber.NewError(fiber.StatusNotFound, "upload not found")
	}
	if status == "published" {
		return fiber.NewError(fiber.StatusConflict, "upload already published")
	}
	if status != "parsed" {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("upload is in '%s' state, must be 'parsed'", status))
	}

	var parsed []parser.ParsedQuestion
	if err := json.Unmarshal(parsedData, &parsed); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to read parsed data")
	}

	count, err := h.svc.BulkImportFromParsed(c.Context(), parsed, body.ExamSetID, uploadID)
	if err != nil {
		return fmt.Errorf("bulk import error: %w", err)
	}

	return c.JSON(fiber.Map{
		"success":             true,
		"questions_published": count,
		"message":             fmt.Sprintf("%d questions added to the exam set.", count),
	})
}

func validateQuestion(req CreateQuestionRequest) error {
	if strings.TrimSpace(req.ExamSetID) == "" {
		return fmt.Errorf("exam_set_id is required")
	}
	if strings.TrimSpace(req.QuestionText) == "" {
		return fmt.Errorf("question_text is required")
	}
	if strings.TrimSpace(req.OptionA) == "" || strings.TrimSpace(req.OptionB) == "" ||
		strings.TrimSpace(req.OptionC) == "" || strings.TrimSpace(req.OptionD) == "" {
		return fmt.Errorf("all four options (a-d) are required")
	}
	opt := strings.ToUpper(strings.TrimSpace(req.CorrectOption))
	if opt != "A" && opt != "B" && opt != "C" && opt != "D" {
		return fmt.Errorf("correct_option must be A, B, C, or D")
	}
	return nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
