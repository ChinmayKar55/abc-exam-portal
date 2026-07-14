package plans

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

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
		`SELECT id, name, description, features, price_paise, active
		 FROM plans ORDER BY price_paise ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var plans []Plan
	for rows.Next() {
		var p Plan
		if err := rows.Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.Active); err != nil {
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
		`SELECT id, name, description, features, price_paise, active
		 FROM plans WHERE id = $1`, id,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.Active)
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
		`INSERT INTO plans (name, description, features, price_paise, active)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, name, description, features, price_paise, active`,
		req.Name, req.Description, features, req.PricePaise, req.Active,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.Active)
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
	err := s.db.QueryRow(ctx,
		`UPDATE plans
		 SET name = COALESCE(NULLIF($2, ''), name),
		     description = COALESCE(NULLIF($3, ''), description),
		     price_paise = COALESCE($4, price_paise),
		     active = $5
		 WHERE id = $1
		 RETURNING id, name, description, features, price_paise, active`,
		id, req.Name, req.Description, req.PricePaise, req.Active,
	).Scan(&p.ID, &p.Name, &p.Description, &p.Features, &p.PricePaise, &p.Active)
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
	res, err := s.db.Exec(ctx, `DELETE FROM plans WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrPlanNotFound
	}
	return nil
}

// GetMyPlans returns all active plans the user has purchased.
func (s *Service) GetMyPlans(ctx context.Context, userID string) ([]UserPlan, error) {
	rows, err := s.db.Query(ctx,
		`SELECT up.plan_id, p.name, p.features, up.activated_at, up.expires_at, up.active
		 FROM user_plans up
		 JOIN plans p ON p.id = up.plan_id
		 WHERE up.user_id = $1 AND up.active = true
		 ORDER BY up.activated_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []UserPlan
	for rows.Next() {
		var up UserPlan
		if err := rows.Scan(&up.PlanID, &up.PlanName, &up.Features, &up.ActivatedAt, &up.ExpiresAt, &up.Active); err != nil {
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
		`SELECT id, name, price_paise FROM plans WHERE id = $1 AND active = true`, planID,
	).Scan(&plan.ID, &plan.Name, &plan.PricePaise)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPlanNotFound
	}
	if err != nil {
		return nil, err
	}

	// Block re-purchase of the same plan if already active.
	var alreadyOwned bool
	_ = s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM user_plans WHERE user_id = $1 AND plan_id = $2 AND active = true)`,
		userID, planID,
	).Scan(&alreadyOwned)
	if alreadyOwned {
		return nil, ErrAlreadyOwned
	}

	idempotencyKey := fmt.Sprintf("plan_%s_%s_%s", userID[:8], planID[:8], uuid.New().String()[:8])

	order, err := s.provider.CreateOrder(ctx, payment.CreateOrderRequest{
		Amount:   plan.PricePaise,
		Currency: "INR",
		Receipt:  uuid.New().String(),
	})
	if err != nil {
		return nil, fmt.Errorf("order creation failed: %w", err)
	}

	metaBytes, _ := json.Marshal(map[string]string{"plan_id": planID, "plan_name": plan.Name})
	_, err = s.db.Exec(ctx,
		`INSERT INTO payments (user_id, razorpay_order_id, amount_paise, type, status, idempotency_key, metadata)
		 VALUES ($1, $2, $3, 'plan_purchase', 'pending', $4, $5)`,
		userID, order.ID, plan.PricePaise, idempotencyKey, metaBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("payment record error: %w", err)
	}

	result := &PurchaseResult{
		OrderID:  order.ID,
		Amount:   plan.PricePaise,
		Currency: "INR",
	}
	if s.cfg.Payment.Provider == "mock" {
		result.MockCheckoutURL = fmt.Sprintf("%s/mock-checkout?order_id=%s&plan_id=%s",
			s.cfg.CORS.BackendURL, order.ID, planID)
	} else {
		result.KeyID = s.cfg.Payment.RazorpayKeyID
	}
	return result, nil
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
		if event.Event == "payment.failed" {
			_, _ = s.db.Exec(ctx,
				`UPDATE payments SET status = 'failed', updated_at = NOW()
				 WHERE razorpay_order_id = $1`, event.OrderID)
		}
		return nil
	}

	var paymentID, userID, idempotencyKey string
	var metadataRaw []byte
	err = s.db.QueryRow(ctx,
		`SELECT id, user_id, idempotency_key, metadata FROM payments
		 WHERE razorpay_order_id = $1`, event.OrderID,
	).Scan(&paymentID, &userID, &idempotencyKey, &metadataRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		log.Warn().Str("order_id", event.OrderID).Msg("Webhook for unknown order — ignoring")
		return nil
	}
	if err != nil {
		return err
	}

	var alreadyCaptured bool
	_ = s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM payments WHERE razorpay_order_id = $1 AND status = 'captured')`,
		event.OrderID,
	).Scan(&alreadyCaptured)
	if alreadyCaptured {
		log.Info().Str("order_id", event.OrderID).Msg("Duplicate webhook — already processed")
		return nil
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`UPDATE payments SET status = 'captured', razorpay_payment_id = $1, updated_at = NOW()
		 WHERE razorpay_order_id = $2`, event.PaymentID, event.OrderID)
	if err != nil {
		return err
	}

	var meta struct {
		PlanID   string `json:"plan_id"`
		PlanName string `json:"plan_name"`
	}
	_ = json.Unmarshal(metadataRaw, &meta)

	userPlanID := uuid.New().String()
	_, err = tx.Exec(ctx,
		`INSERT INTO user_plans (id, user_id, plan_id, payment_id, activated_at, active)
		 VALUES ($1, $2, $3, $4, NOW(), true)`,
		userPlanID, userID, meta.PlanID, paymentID,
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
	var metadataRaw []byte
	err := s.db.QueryRow(ctx,
		`SELECT id, idempotency_key, metadata FROM payments
		 WHERE razorpay_order_id = $1 AND user_id = $2`,
		req.RazorpayOrderID, userID,
	).Scan(&paymentID, &idempotencyKey, &metadataRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("payment order not found")
	}
	if err != nil {
		return err
	}

	var meta struct {
		PlanID   string `json:"plan_id"`
		PlanName string `json:"plan_name"`
	}
	_ = json.Unmarshal(metadataRaw, &meta)

	var alreadyCaptured bool
	_ = s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM payments WHERE razorpay_order_id = $1 AND status = 'captured')`,
		req.RazorpayOrderID,
	).Scan(&alreadyCaptured)
	if alreadyCaptured {
		return nil
	}

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	_, err = tx.Exec(ctx,
		`UPDATE payments SET status = 'captured', razorpay_payment_id = $1, updated_at = NOW()
		 WHERE razorpay_order_id = $2`, req.RazorpayPaymentID, req.RazorpayOrderID)
	if err != nil {
		return err
	}

	userPlanID := uuid.New().String()
	_, err = tx.Exec(ctx,
		`INSERT INTO user_plans (id, user_id, plan_id, payment_id, activated_at, active)
		 VALUES ($1, $2, $3, $4, NOW(), true)`,
		userPlanID, userID, meta.PlanID, paymentID,
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
			_ = s.mailer.SendPlanActivation(userEmail, userName, meta.PlanName)
		}
	}()

	log.Info().Str("user_id", userID).Str("plan_id", meta.PlanID).Msg("Plan activated via verify")
	return nil
}
