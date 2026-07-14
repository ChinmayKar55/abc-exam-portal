package admin

import (
	"strconv"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Handler struct {
	db *pgxpool.Pool
}

func NewHandler(db *pgxpool.Pool) *Handler {
	return &Handler{db: db}
}

// ListUsers returns paginated user list with plan info.
func (h *Handler) ListUsers(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	search := c.Query("search")
	offset := (page - 1) * limit

	var total int
	countQ := `SELECT COUNT(*) FROM users WHERE role = 'student'`
	args := []interface{}{}
	if search != "" {
		countQ += ` AND (name ILIKE $1 OR email ILIKE $1)`
		args = append(args, "%"+search+"%")
	}
	_ = h.db.QueryRow(c.Context(), countQ, args...).Scan(&total)

	listQ := `SELECT u.id, u.name, u.email, u.role::TEXT, u.email_verified, u.created_at,
	                 up.plan_id, p.name AS plan_name, up.active AS plan_active
	          FROM users u
	          LEFT JOIN user_plans up ON up.user_id = u.id AND up.active = true
	          LEFT JOIN plans p ON p.id = up.plan_id
	          WHERE u.role = 'student'`
	listArgs := []interface{}{}
	if search != "" {
		listQ += ` AND (u.name ILIKE $1 OR u.email ILIKE $1)`
		listArgs = append(listArgs, "%"+search+"%")
		listQ += ` ORDER BY u.created_at DESC LIMIT $2 OFFSET $3`
		listArgs = append(listArgs, limit, offset)
	} else {
		listQ += ` ORDER BY u.created_at DESC LIMIT $1 OFFSET $2`
		listArgs = append(listArgs, limit, offset)
	}

	rows, err := h.db.Query(c.Context(), listQ, listArgs...)
	if err != nil {
		return err
	}
	defer rows.Close()

	type userRow struct {
		ID            string     `json:"id"`
		Name          string     `json:"name"`
		Email         string     `json:"email"`
		Role          string     `json:"role"`
		EmailVerified bool       `json:"email_verified"`
		CreatedAt     time.Time  `json:"created_at"`
		PlanID        *string    `json:"plan_id"`
		PlanName      *string    `json:"plan_name"`
		PlanActive    *bool      `json:"plan_active"`
	}

	var users []userRow
	for rows.Next() {
		var u userRow
		if err := rows.Scan(&u.ID, &u.Name, &u.Email, &u.Role, &u.EmailVerified, &u.CreatedAt,
			&u.PlanID, &u.PlanName, &u.PlanActive); err != nil {
			return err
		}
		users = append(users, u)
	}
	return c.JSON(fiber.Map{
		"success": true,
		"data":    users,
		"meta":    fiber.Map{"total": total, "page": page, "limit": limit},
	})
}

// GetDashboardStats returns high-level portal statistics.
func (h *Handler) GetDashboardStats(c *fiber.Ctx) error {
	type stats struct {
		TotalUsers       int `json:"total_users"`
		ActivePlans      int `json:"active_plans"`
		TotalExams       int `json:"total_exams"`
		TotalAttempts    int `json:"total_attempts"`
		GradedAttempts   int `json:"graded_attempts"`
		TotalQuestions   int `json:"total_questions"`
		RevenueCapture   int `json:"revenue_captured_paise"`
	}
	var s stats
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM users WHERE role='student'`).Scan(&s.TotalUsers)
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM user_plans WHERE active=true`).Scan(&s.ActivePlans)
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM exams WHERE status='active'::exam_status`).Scan(&s.TotalExams)
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM exam_attempts`).Scan(&s.TotalAttempts)
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM exam_attempts WHERE status='graded'::attempt_status`).Scan(&s.GradedAttempts)
	_ = h.db.QueryRow(c.Context(), `SELECT COUNT(*) FROM questions WHERE active=true`).Scan(&s.TotalQuestions)
	_ = h.db.QueryRow(c.Context(), `SELECT COALESCE(SUM(amount_paise),0) FROM payments WHERE status='captured'`).Scan(&s.RevenueCapture)

	return c.JSON(fiber.Map{"success": true, "data": s})
}

// ListAttempts returns paginated exam attempts (for monitoring).
func (h *Handler) ListAttempts(c *fiber.Ctx) error {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	examID := c.Query("exam_id")
	offset := (page - 1) * limit

	args := []interface{}{}
	where := ""
	idx := 1
	if examID != "" {
		where = " WHERE ea.exam_id = $1"
		args = append(args, examID)
		idx++
	}

	args = append(args, limit, offset)

	rows, err := h.db.Query(c.Context(),
		`SELECT ea.id, u.name, u.email, e.title,
		        ea.status::TEXT, ea.score, ea.passed,
		        ea.total_questions, ea.correct_answers, ea.started_at, ea.submitted_at,
		        ea.violation_count, ea.is_flagged
		 FROM exam_attempts ea
		 JOIN users u ON u.id = ea.user_id
		 JOIN exams e ON e.id = ea.exam_id`+where+
			` ORDER BY ea.started_at DESC LIMIT $`+strconv.Itoa(idx)+` OFFSET $`+strconv.Itoa(idx+1),
		args...,
	)
	if err != nil {
		return err
	}
	defer rows.Close()

	type row struct {
		ID             string     `json:"id"`
		UserName       string     `json:"user_name"`
		UserEmail      string     `json:"user_email"`
		ExamTitle      string     `json:"exam_title"`
		Status         string     `json:"status"`
		Score          *float64   `json:"score"`
		Passed         *bool      `json:"passed"`
		TotalQuestions int        `json:"total_questions"`
		CorrectAnswers *int       `json:"correct_answers"`
		StartedAt      time.Time  `json:"started_at"`
		SubmittedAt    *time.Time `json:"submitted_at"`
		ViolationCount int        `json:"violation_count"`
		IsFlagged      bool       `json:"is_flagged"`
	}

	var attempts []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.ID, &r.UserName, &r.UserEmail, &r.ExamTitle,
			&r.Status, &r.Score, &r.Passed,
			&r.TotalQuestions, &r.CorrectAnswers, &r.StartedAt, &r.SubmittedAt,
			&r.ViolationCount, &r.IsFlagged); err != nil {
			return err
		}
		attempts = append(attempts, r)
	}
	return c.JSON(fiber.Map{"success": true, "data": attempts})
}

// ListUploads returns all PDF/DOCX uploads with their parse status.
func (h *Handler) ListUploads(c *fiber.Ctx) error {
	rows, err := h.db.Query(c.Context(),
		`SELECT pu.id, u.name, pu.filename, pu.file_size,
		        pu.parse_status::TEXT, pu.questions_extracted, pu.questions_published,
		        pu.parsed_at, pu.uploaded_at, es.name AS exam_set_name
		 FROM pdf_uploads pu
		 JOIN users u ON u.id = pu.uploaded_by
		 LEFT JOIN exam_sets es ON es.id = pu.exam_set_id
		 ORDER BY pu.uploaded_at DESC LIMIT 100`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type row struct {
		ID                 string     `json:"id"`
		UploadedBy         string     `json:"uploaded_by"`
		Filename           string     `json:"filename"`
		FileSize           int64      `json:"file_size"`
		ParseStatus        string     `json:"parse_status"`
		QuestionsExtracted int        `json:"questions_extracted"`
		QuestionsPublished int        `json:"questions_published"`
		ParsedAt           *time.Time `json:"parsed_at"`
		UploadedAt         time.Time  `json:"uploaded_at"`
		ExamSetName        *string    `json:"exam_set_name"`
	}

	var uploads []row
	for rows.Next() {
		var r row
		if err := rows.Scan(&r.ID, &r.UploadedBy, &r.Filename, &r.FileSize,
			&r.ParseStatus, &r.QuestionsExtracted, &r.QuestionsPublished,
			&r.ParsedAt, &r.UploadedAt, &r.ExamSetName); err != nil {
			return err
		}
		uploads = append(uploads, r)
	}
	return c.JSON(fiber.Map{"success": true, "data": uploads})
}
