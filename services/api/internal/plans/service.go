package plans

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"

	"github.com/abc-exam/api/internal/config"
	"github.com/abc-exam/api/internal/email"
	"github.com/abc-exam/api/internal/payment"
)

var ErrPlanNotFound = errors.New("plan not found")
var ErrAlreadyOwned = errors.New("you already own this plan")
var ErrPaymentNotCaptured = errors.New("payment has not been captured")
var ErrPaymentMismatch = errors.New("payment details do not match order")

type Service struct {
	db       *pgxpool.Pool
	rdb      *redis.Client
	cfg      *config.Config
	provider payment.Provider
	mailer   *email.Mailer
}

func NewService(db *pgxpool.Pool, rdb *redis.Client, cfg *config.Config, provider payment.Provider, mailer *email.Mailer) *Service {
	return &Service{db: db, rdb: rdb, cfg: cfg, provider: provider, mailer: mailer}
}

type StudyMaterial struct {
	ID          string `json:"id"`
	Title       string `json:"title"`
	Description string `json:"description"`
	FileURL     string `json:"file_url"`
}

func (s *Service) ListMaterials(ctx context.Context) ([]StudyMaterial, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, title, description, file_url FROM study_materials WHERE active = true ORDER BY title`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var materials []StudyMaterial
	for rows.Next() {
		var m StudyMaterial
		if err := rows.Scan(&m.ID, &m.Title, &m.Description, &m.FileURL); err != nil {
			return nil, err
		}
		materials = append(materials, m)
	}
	return materials, nil
}

func (s *Service) ListPlans(ctx context.Context) ([]Plan, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, description, features, price_paise, duration_days, active
		 FROM plans ORDER BY price_paise ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var plans []Plan
	for rows.Next() {
		var p Plan
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.DurationDays, &p.Active); err != nil {
			return nil, err
		}
		p.Exams, _ = s.listPlanExams(ctx, p.ID)
		p.Materials, _ = s.listPlanMaterials(ctx, p.ID)
		plans = append(plans, p)
	}
	return plans, nil
}

func (s *Service) listPlanExams(ctx context.Context, planID string) ([]PlanExam, error) {
	rows, err := s.db.Query(ctx,
		`SELECT e.id, e.title FROM plan_exams pe
		 JOIN exams e ON e.id = pe.exam_id
		 WHERE pe.plan_id = $1 ORDER BY e.title`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var exams []PlanExam
	for rows.Next() {
		var e PlanExam
		if err := rows.Scan(&e.ID, &e.Title); err != nil {
			return nil, err
		}
		exams = append(exams, e)
	}
	return exams, nil
}

func (s *Service) listPlanMaterials(ctx context.Context, planID string) ([]PlanMaterial, error) {
	rows, err := s.db.Query(ctx,
		`SELECT m.id, m.title FROM plan_materials pm
		 JOIN study_materials m ON m.id = pm.material_id
		 WHERE pm.plan_id = $1 ORDER BY m.title`, planID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var materials []PlanMaterial
	for rows.Next() {
		var m PlanMaterial
		if err := rows.Scan(&m.ID, &m.Title); err != nil {
			return nil, err
		}
		materials = append(materials, m)
	}
	return materials, nil
}

func (s *Service) GetPlan(ctx context.Context, id string) (*Plan, error) {
	var p Plan
	err := s.db.QueryRow(ctx,
		`SELECT id, name, description, features, price_paise, duration_days, active
		 FROM plans WHERE id = $1`, id,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.DurationDays, &p.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPlanNotFound
	}
	if err != nil {
		return nil, err
	}
	p.Exams, _ = s.listPlanExams(ctx, p.ID)
	p.Materials, _ = s.listPlanMaterials(ctx, p.ID)
	return &p, nil
}

func (s *Service) CreatePlan(ctx context.Context, req CreatePlanRequest) (*Plan, error) {
	var p Plan
	features, _ := json.Marshal(map[string]interface{}{})
	err := s.db.QueryRow(ctx,
		`INSERT INTO plans (name, description, features, price_paise, duration_days, active)
		 VALUES ($1, $2, $3, $4, $5, $6)
		 RETURNING id, name, description, features, price_paise, duration_days, active`,
		req.Name, req.Description, features, req.PricePaise, req.DurationDays, req.Active,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.DurationDays, &p.Active)
	if err != nil {
		return nil, err
	}
	if err := s.setPlanBundles(ctx, p.ID, req.ExamIDs, req.MaterialIDs); err != nil {
		return nil, err
	}
	p.Exams, _ = s.listPlanExams(ctx, p.ID)
	p.Materials, _ = s.listPlanMaterials(ctx, p.ID)
	return &p, nil
}

func (s *Service) UpdatePlan(ctx context.Context, id string, req UpdatePlanRequest) (*Plan, error) {
	var p Plan
	durationDays := req.DurationDays
	if durationDays == nil || *durationDays < 0 {
		var zero int
		durationDays = &zero
	}
	err := s.db.QueryRow(ctx,
		`UPDATE plans
		 SET name = COALESCE(NULLIF($2, ''), name),
		     description = COALESCE(NULLIF($3, ''), description),
		     price_paise = COALESCE($4, price_paise),
		     duration_days = COALESCE($6, duration_days),
		     active = $5
		 WHERE id = $1
		 RETURNING id, name, description, features, price_paise, duration_days, active`,
		id, req.Name, req.Description, req.PricePaise, req.Active, *durationDays,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.DurationDays, &p.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPlanNotFound
	}
	if err != nil {
		return nil, err
	}
	if err := s.setPlanBundles(ctx, p.ID, req.ExamIDs, req.MaterialIDs); err != nil {
		return nil, err
	}
	p.Exams, _ = s.listPlanExams(ctx, p.ID)
	p.Materials, _ = s.listPlanMaterials(ctx, p.ID)
	return &p, nil
}

func (s *Service) setPlanBundles(ctx context.Context, planID string, examIDs, materialIDs []string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM plan_exams WHERE plan_id = $1`, planID)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx, `DELETE FROM plan_materials WHERE plan_id = $1`, planID)
	if err != nil {
		return err
	}
	for _, examID := range examIDs {
		if examID == "" {
			continue
		}
		_, err := s.db.Exec(ctx,
			`INSERT INTO plan_exams (plan_id, exam_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			planID, examID,
		)
		if err != nil {
			return err
		}
	}
	for _, materialID := range materialIDs {
		if materialID == "" {
			continue
		}
		_, err := s.db.Exec(ctx,
			`INSERT INTO plan_materials (plan_id, material_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
			planID, materialID,
		)
		if err != nil {
			return err
		}
	}
	return nil
}

func (s *Service) DeletePlan(ctx context.Context, id string) error {
	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	// plan_exams / plan_materials cascade on plan delete.
	// user_plans does not cascade, so remove those first.
	_, err = tx.Exec(ctx, `DELETE FROM user_plans WHERE plan_id = $1`, id)
	if err != nil {
		return err
	}

	res, err := tx.Exec(ctx, `DELETE FROM plans WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrPlanNotFound
	}

	return tx.Commit(ctx)
}

// GetMyPlans returns all active plans the user has purchased.
func (s *Service) GetMyPlans(ctx context.Context, userID string) ([]UserPlan, error) {
	rows, err := s.db.Query(ctx,
		`SELECT up.plan_id, p.name, p.features, p.duration_days, up.activated_at, up.expires_at, up.active
		 FROM user_plans up
		 JOIN plans p ON p.id = up.plan_id
		 WHERE up.user_id = $1 AND up.active = true AND (up.expires_at IS NULL OR up.expires_at > NOW())
		 ORDER BY up.activated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []UserPlan
	for rows.Next() {
		var up UserPlan
		if err := rows.Scan(&up.PlanID, &up.PlanName, &up.Features, &up.DurationDays, &up.ActivatedAt, &up.ExpiresAt, &up.Active); err != nil {
			return nil, err
		}
		up.Exams, _ = s.listPlanExams(ctx, up.PlanID)
		up.Materials, _ = s.listPlanMaterials(ctx, up.PlanID)
		result = append(result, up)
	}
	if result == nil {
		result = []UserPlan{}
	}
	return result, nil
}

func (s *Service) InitiatePurchase(ctx context.Context, userID, planID string) (*PurchaseResult, error) {
	var plan Plan
	err := s.db.QueryRow(ctx,
		`SELECT id, name, price_paise, duration_days FROM plans WHERE id = $1 AND active = true`, planID,
	).Scan(&plan.ID, &plan.Name, &plan.PricePaise, &plan.DurationDays)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPlanNotFound
	}
	if err != nil {
		return nil, err
	}

	// Block re-purchase of the same plan if it is currently valid.
	var alreadyOwned bool
	_ = s.db.QueryRow(ctx,
		`SELECT EXISTS(
			SELECT 1 FROM user_plans
			WHERE user_id = $1 AND plan_id = $2 AND active = true
			  AND (expires_at IS NULL OR expires_at > NOW())
		)`,
		userID, planID,
	).Scan(&alreadyOwned)
	if alreadyOwned {
		return nil, ErrAlreadyOwned
	}

	idempotencyKey := fmt.Sprintf("plan_%s_%s_%s", userID[:8], planID[:8], uuid.New().String()[:8])

	const taxRate = 18
	baseAmount := plan.PricePaise
	taxAmount := int(math.Round(float64(baseAmount) * float64(taxRate) / 100.0))
	totalAmount := baseAmount + taxAmount

	order, err := s.provider.CreateOrder(ctx, payment.CreateOrderRequest{
		Amount:   totalAmount,
		Currency: "INR",
		Receipt:  uuid.New().String(),
	})
	if err != nil {
		return nil, fmt.Errorf("order creation failed: %w", err)
	}

	metaBytes, _ := json.Marshal(map[string]interface{}{
		"plan_id":       planID,
		"plan_name":     plan.Name,
		"duration_days": plan.DurationDays,
		"base_paise":    baseAmount,
		"tax_paise":     taxAmount,
		"tax_rate":      taxRate,
	})
	_, err = s.db.Exec(ctx,
		`INSERT INTO payments (user_id, razorpay_order_id, amount_paise, type, status, idempotency_key, metadata)
		 VALUES ($1, $2, $3, 'plan_purchase', 'pending', $4, $5)`,
		userID, order.ID, totalAmount, idempotencyKey, metaBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("payment record error: %w", err)
	}

	result := &PurchaseResult{
		OrderID:     order.ID,
		Amount:      totalAmount,
		BaseAmount:  baseAmount,
		TaxAmount:   taxAmount,
		TotalAmount: totalAmount,
		TaxRate:     taxRate,
		Currency:    "INR",
	}
	if s.cfg.Payment.Provider == "mock" {
		result.MockCheckoutURL = fmt.Sprintf("%s/mock-checkout?order_id=%s&plan_id=%s",
			s.cfg.CORS.BackendURL, order.ID, planID)
	} else {
		result.KeyID = s.cfg.Payment.RazorpayKeyID
	}
	return result, nil
}

func (s *Service) validateCapturedPayment(ctx context.Context, paymentID, orderID string, amountPaise int) error {
	providerPayment, err := s.provider.FetchPayment(ctx, paymentID)
	if err != nil {
		return fmt.Errorf("payment lookup failed: %w", err)
	}
	if providerPayment.ID != paymentID ||
		providerPayment.OrderID != orderID ||
		providerPayment.Amount != amountPaise ||
		providerPayment.Currency != "INR" {
		return ErrPaymentMismatch
	}
	if !providerPayment.Captured || providerPayment.Status != "captured" {
		return ErrPaymentNotCaptured
	}
	return nil
}

func (s *Service) HandleWebhook(ctx context.Context, payload []byte, signature string) error {
	if !s.provider.VerifyWebhookSignature(payload, signature) {
		return errors.New("invalid webhook signature")
	}

	event, err := s.provider.ParseWebhookEvent(payload)
	if err != nil {
		return fmt.Errorf("webhook parse error: %w", err)
	}

	log.Info().Str("event", event.Event).Str("order_id", event.OrderID).Msg("Webhook received")

	if event.Event != "payment.captured" {
		if event.Event == "payment.failed" && event.Status == "failed" && event.OrderID != "" {
			log.Warn().
				Str("order_id", event.OrderID).
				Str("payment_id", event.PaymentID).
				Str("error_code", event.ErrorCode).
				Str("error_description", event.ErrorDescription).
				Msg("Payment failed")
			_, _ = s.db.Exec(ctx,
				`UPDATE payments SET status = 'failed', updated_at = NOW()
				 WHERE razorpay_order_id = $1 AND status = 'pending'`, event.OrderID)
		}
		return nil
	}
	if event.OrderID == "" || event.PaymentID == "" || event.Amount <= 0 || event.Currency != "INR" {
		return ErrPaymentMismatch
	}
	if event.Status != "captured" {
		return ErrPaymentNotCaptured
	}

	var paymentID, userID, idempotencyKey string
	var amountPaise int
	var metadataRaw []byte
	err = s.db.QueryRow(ctx,
		`SELECT id, user_id, idempotency_key, amount_paise, metadata FROM payments
		 WHERE razorpay_order_id = $1`, event.OrderID,
	).Scan(&paymentID, &userID, &idempotencyKey, &amountPaise, &metadataRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		log.Warn().Str("order_id", event.OrderID).Msg("Webhook for unknown order — ignoring")
		return nil
	}
	if err != nil {
		return err
	}
	if event.Amount != amountPaise {
		return ErrPaymentMismatch
	}
	if s.cfg.Payment.Provider != "mock" {
		if err := s.validateCapturedPayment(ctx, event.PaymentID, event.OrderID, amountPaise); err != nil {
			return err
		}
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	result, err := tx.Exec(ctx,
		`UPDATE payments SET status = 'captured', razorpay_payment_id = $1, updated_at = NOW()
		 WHERE razorpay_order_id = $2 AND status <> 'captured'`, event.PaymentID, event.OrderID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		log.Info().Str("order_id", event.OrderID).Msg("Duplicate webhook — already processed")
		return nil
	}

	var meta struct {
		PlanID       string `json:"plan_id"`
		PlanName     string `json:"plan_name"`
		DurationDays int    `json:"duration_days"`
		BasePaise    int    `json:"base_paise"`
		TaxPaise     int    `json:"tax_paise"`
	}
	_ = json.Unmarshal(metadataRaw, &meta)

	userPlanID := uuid.New().String()
	durationText := strconv.Itoa(meta.DurationDays)
	_, err = tx.Exec(ctx,
		`INSERT INTO user_plans (id, user_id, plan_id, payment_id, activated_at, expires_at, active)
		 VALUES ($1, $2, $3, $4, NOW(), CASE WHEN $5::int > 0 THEN NOW() + ($6::text || ' days')::interval ELSE NULL END, true)`,
		userPlanID, userID, meta.PlanID, paymentID, meta.DurationDays, durationText,
	)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	go func() {
		var userName, userEmail string
		_ = s.db.QueryRow(context.Background(),
			`SELECT name, email FROM users WHERE id = $1`, userID,
		).Scan(&userName, &userEmail)
		if userEmail != "" {
			duration := "Lifetime"
			if meta.DurationDays > 0 {
				duration = fmt.Sprintf("%d days", meta.DurationDays)
			}
			_ = s.mailer.SendPaymentReceipt(userEmail, userName, meta.PlanName, event.OrderID, event.PaymentID,
				email.FormatRupees(amountPaise), email.FormatRupees(meta.BasePaise), email.FormatRupees(meta.TaxPaise),
				"plan", "", duration, time.Now().Format("2 Jan 2006"))
			_ = s.mailer.SendPlanActivation(userEmail, userName, meta.PlanName)
		}
	}()

	log.Info().Str("user_id", userID).Str("plan_id", meta.PlanID).Msg("Plan activated")
	return nil
}

func (s *Service) VerifyPayment(ctx context.Context, userID string, req VerifyPaymentRequest) error {
	if req.RazorpayPaymentID == "" || req.RazorpayOrderID == "" || req.RazorpaySignature == "" {
		return errors.New("missing payment verification fields")
	}

	if !s.provider.VerifyPaymentSignature(req.RazorpayOrderID, req.RazorpayPaymentID, req.RazorpaySignature) {
		return errors.New("invalid payment signature")
	}

	var paymentID, idempotencyKey string
	var amountPaise int
	var metadataRaw []byte
	err := s.db.QueryRow(ctx,
		`SELECT id, idempotency_key, amount_paise, metadata FROM payments
		 WHERE razorpay_order_id = $1 AND user_id = $2`,
		req.RazorpayOrderID, userID,
	).Scan(&paymentID, &idempotencyKey, &amountPaise, &metadataRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("payment order not found")
	}
	if err != nil {
		return err
	}

	if err := s.validateCapturedPayment(ctx, req.RazorpayPaymentID, req.RazorpayOrderID, amountPaise); err != nil {
		return err
	}

	var meta struct {
		PlanID       string `json:"plan_id"`
		PlanName     string `json:"plan_name"`
		DurationDays int    `json:"duration_days"`
		BasePaise    int    `json:"base_paise"`
		TaxPaise     int    `json:"tax_paise"`
	}
	_ = json.Unmarshal(metadataRaw, &meta)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	result, err := tx.Exec(ctx,
		`UPDATE payments SET status = 'captured', razorpay_payment_id = $1, updated_at = NOW()
		 WHERE razorpay_order_id = $2 AND status <> 'captured'`, req.RazorpayPaymentID, req.RazorpayOrderID)
	if err != nil {
		return err
	}
	if result.RowsAffected() == 0 {
		return nil
	}

	userPlanID := uuid.New().String()
	durationText := strconv.Itoa(meta.DurationDays)
	_, err = tx.Exec(ctx,
		`INSERT INTO user_plans (id, user_id, plan_id, payment_id, activated_at, expires_at, active)
		 VALUES ($1, $2, $3, $4, NOW(), CASE WHEN $5::int > 0 THEN NOW() + ($6::text || ' days')::interval ELSE NULL END, true)`,
		userPlanID, userID, meta.PlanID, paymentID, meta.DurationDays, durationText,
	)
	if err != nil {
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return err
	}

	go func() {
		var userName, userEmail string
		_ = s.db.QueryRow(context.Background(),
			`SELECT name, email FROM users WHERE id = $1`, userID,
		).Scan(&userName, &userEmail)
		if userEmail != "" {
			duration := "Lifetime"
			if meta.DurationDays > 0 {
				duration = fmt.Sprintf("%d days", meta.DurationDays)
			}
			_ = s.mailer.SendPaymentReceipt(userEmail, userName, meta.PlanName, req.RazorpayOrderID, req.RazorpayPaymentID,
				email.FormatRupees(amountPaise), email.FormatRupees(meta.BasePaise), email.FormatRupees(meta.TaxPaise),
				"plan", "", duration, time.Now().Format("2 Jan 2006"))
			_ = s.mailer.SendPlanActivation(userEmail, userName, meta.PlanName)
		}
	}()

	log.Info().Str("user_id", userID).Str("plan_id", meta.PlanID).Msg("Plan activated via verify")
	return nil
}

// StartExpiryPoller deactivates expired packages in the background,
// and sends expiry warning (2 days before) and expired notifications.
func (s *Service) StartExpiryPoller(ctx context.Context, interval time.Duration) {
	if interval == 0 {
		interval = 60 * time.Second
	}
	ticker := time.NewTicker(interval)
	go func() {
		for {
			select {
			case <-ctx.Done():
				ticker.Stop()
				return
			case <-ticker.C:
				if err := s.pollPlanExpiry(ctx); err != nil {
					log.Error().Err(err).Msg("Failed to poll plan expiry")
				}
			}
		}
	}()
}

func (s *Service) pollPlanExpiry(ctx context.Context) error {
	// Expire active packages and notify users
	rows, err := s.db.Query(ctx,
		`SELECT up.id, up.plan_id, p.name, u.name, u.email
		 FROM user_plans up
		 JOIN plans p ON p.id = up.plan_id
		 JOIN users u ON u.id = up.user_id
		 WHERE up.expires_at < NOW() AND up.active = true AND up.expired_notification_sent = false`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type notify struct{ id, planID, planName, name, email string }
	var expired []notify
	for rows.Next() {
		var n notify
		if err := rows.Scan(&n.id, &n.planID, &n.planName, &n.name, &n.email); err != nil {
			return err
		}
		expired = append(expired, n)
	}

	for _, n := range expired {
		if n.email != "" {
			_ = s.mailer.SendPlanExpired(n.email, n.name, n.planName)
		}
		_, _ = s.db.Exec(ctx,
			`UPDATE user_plans SET active = false, expired_notification_sent = true WHERE id = $1`,
			n.id)
	}

	// Warn users whose packages expire within 2 days
	warningRows, err := s.db.Query(ctx,
		`SELECT up.id, up.plan_id, p.name, up.expires_at, u.name, u.email
		 FROM user_plans up
		 JOIN plans p ON p.id = up.plan_id
		 JOIN users u ON u.id = up.user_id
		 WHERE up.expires_at BETWEEN NOW() AND NOW() + INTERVAL '2 days'
		   AND up.active = true
		   AND up.expiry_warning_sent = false`)
	if err != nil {
		return err
	}
	defer warningRows.Close()

	var warnings []struct {
		notify
		expiresAt time.Time
	}
	for warningRows.Next() {
		var n notify
		var expiresAt time.Time
		if err := warningRows.Scan(&n.id, &n.planID, &n.planName, &expiresAt, &n.name, &n.email); err != nil {
			return err
		}
		warnings = append(warnings, struct {
			notify
			expiresAt time.Time
		}{n, expiresAt})
	}

	for _, w := range warnings {
		if w.email != "" {
			_ = s.mailer.SendPlanExpiryWarning(w.email, w.name, w.planName, w.expiresAt.Format("2 Jan 2006"))
		}
		_, _ = s.db.Exec(ctx,
			`UPDATE user_plans SET expiry_warning_sent = true WHERE id = $1`,
			w.id)
	}

	return nil
}
