package subscription

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

var (
	ErrTierNotFound           = errors.New("subscription tier not found")
	ErrAlreadySubscribed      = errors.New("you already have an active subscription")
	ErrNoActiveSubscription   = errors.New("no active subscription")
	ErrNoProForUpgrade        = errors.New("no active pro subscription to upgrade")
	ErrAlreadyOnMax           = errors.New("you are already on the max plan")
	ErrPaymentNotCaptured     = errors.New("payment has not been captured")
	ErrPaymentMismatch        = errors.New("payment details do not match order")
)

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

// ListTiers returns active Pro and Max tier definitions.
func (s *Service) ListTiers(ctx context.Context) ([]SubscriptionPlan, error) {
	return s.listTiers(ctx, true)
}

// ListTiersAdmin returns all tier definitions including inactive ones.
// The Free tier is synthesised so the admin always sees the full ladder.
func (s *Service) ListTiersAdmin(ctx context.Context) ([]SubscriptionPlan, error) {
	tiers, err := s.listTiers(ctx, false)
	if err != nil {
		return nil, err
	}

	// Synthesise a Free tier at the top of the list.
	free := SubscriptionPlan{
		ID:           "",
		Tier:         "free",
		Name:         "Free Plan",
		Description:  "Access all free exams. Upgrade to unlock Pro and Max content.",
		PricePaise:   0,
		DurationDays: 0,
		Active:       true,
	}
	return append([]SubscriptionPlan{free}, tiers...), nil
}

func (s *Service) listTiers(ctx context.Context, onlyActive bool) ([]SubscriptionPlan, error) {
	query := `SELECT id, tier::TEXT, name, description, price_paise, duration_days, active
		      FROM subscription_plans`
	if onlyActive {
		query += ` WHERE active = true`
	}
	query += ` ORDER BY price_paise ASC`

	rows, err := s.db.Query(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []SubscriptionPlan
	for rows.Next() {
		var p SubscriptionPlan
		if err := rows.Scan(&p.ID, &p.Tier, &p.Name, &p.Description, &p.PricePaise, &p.DurationDays, &p.Active); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, nil
}

// getActive returns the user's currently active subscription, if any.
func (s *Service) getActive(ctx context.Context, userID string) (*UserSubscription, string, error) {
	var us UserSubscription
	var planName string
	err := s.db.QueryRow(ctx,
		`SELECT us.id, us.tier::TEXT, us.payment_id, us.activated_at, us.expires_at, us.active, COALESCE(us.upgraded_from::TEXT, ''), sp.name
		 FROM user_subscriptions us
		 JOIN subscription_plans sp ON sp.tier = us.tier
		 WHERE us.user_id = $1 AND us.active = true AND us.expires_at > NOW()
		 ORDER BY us.expires_at DESC
		 LIMIT 1`,
		userID,
	).Scan(&us.ID, &us.Tier, &us.PaymentID, &us.ActivatedAt, &us.ExpiresAt, &us.Active, &us.UpgradedFrom, &planName)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, "", nil
	}
	if err != nil {
		return nil, "", err
	}
	us.PlanName = planName
	us.RemainingDays = int(time.Until(us.ExpiresAt).Hours() / 24)
	return &us, planName, nil
}

// GetMySubscription returns current tier and active subscription details.
func (s *Service) GetMySubscription(ctx context.Context, userID string) (*MySubscriptionResponse, error) {
	us, _, err := s.getActive(ctx, userID)
	if err != nil {
		return nil, err
	}
	resp := &MySubscriptionResponse{Tier: "free"}
	if us != nil {
		resp.Tier = us.Tier
		resp.Subscription = us
	}
	return resp, nil
}

// GetTier returns a tier definition by tier name.
func (s *Service) GetTier(ctx context.Context, tier string) (*SubscriptionPlan, error) {
	var p SubscriptionPlan
	err := s.db.QueryRow(ctx,
		`SELECT id, tier::TEXT, name, description, price_paise, duration_days, active
		 FROM subscription_plans WHERE tier = $1::subscription_tier`, tier,
	).Scan(&p.ID, &p.Tier, &p.Name, &p.Description, &p.PricePaise, &p.DurationDays, &p.Active)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrTierNotFound
	}
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// UpdateTier updates a Pro/Max tier definition. Free is not in the database and cannot be updated.
func (s *Service) UpdateTier(ctx context.Context, tier string, req UpdateTierRequest) (*SubscriptionPlan, error) {
	if tier == "free" {
		return nil, errors.New("free tier cannot be updated")
	}
	if req.DurationDays <= 0 {
		return nil, errors.New("duration_days must be greater than 0")
	}

	var p SubscriptionPlan
	err := s.db.QueryRow(ctx,
		`UPDATE subscription_plans
		 SET name = COALESCE(NULLIF($2, ''), name),
		     description = COALESCE(NULLIF($3, ''), description),
		     price_paise = COALESCE(NULLIF($4, 0), price_paise),
		     duration_days = $5,
		     active = $6
		 WHERE tier = $1::subscription_tier
		 RETURNING id, tier::TEXT, name, description, price_paise, duration_days, active`,
		tier, req.Name, req.Description, req.PricePaise, req.DurationDays, req.Active,
	).Scan(&p.ID, &p.Tier, &p.Name, &p.Description, &p.PricePaise, &p.DurationDays, &p.Active)
	if err != nil {
		return nil, err
	}
	return &p, nil
}

// InitiateSubscribe begins a new Pro or Max subscription purchase.
func (s *Service) InitiateSubscribe(ctx context.Context, userID, tier string) (*PurchaseResult, error) {
	plan, err := s.GetTier(ctx, tier)
	if err != nil {
		return nil, err
	}
	if !plan.Active {
		return nil, ErrTierNotFound
	}

	active, _, err := s.getActive(ctx, userID)
	if err != nil {
		return nil, err
	}
	if active != nil {
		if active.Tier == "max" {
			return nil, ErrAlreadyOnMax
		}
		if active.Tier == tier {
			return nil, ErrAlreadySubscribed
		}
		if tier == "max" {
			return nil, fmt.Errorf("use the /subscriptions/upgrade endpoint to upgrade to max")
		}
	}

	return s.createOrder(ctx, userID, plan, false)
}

// InitiateUpgrade lets a Pro user upgrade to Max mid-cycle.
func (s *Service) InitiateUpgrade(ctx context.Context, userID string) (*PurchaseResult, error) {
	active, _, err := s.getActive(ctx, userID)
	if err != nil {
		return nil, err
	}
	if active == nil || active.Tier != "pro" {
		return nil, ErrNoProForUpgrade
	}

	plan, err := s.GetTier(ctx, "max")
	if err != nil {
		return nil, err
	}

	return s.createOrder(ctx, userID, plan, true)
}

func (s *Service) createOrder(ctx context.Context, userID string, plan *SubscriptionPlan, isUpgrade bool) (*PurchaseResult, error) {
	idempotencyKey := fmt.Sprintf("sub_%s_%s_%s", userID[:8], plan.Tier, uuid.New().String()[:8])

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

	meta := paymentMetadata{Tier: plan.Tier, PlanName: plan.Name, Upgrade: isUpgrade, BasePaise: baseAmount, TaxPaise: taxAmount, TaxRate: taxRate}
	metaBytes, _ := json.Marshal(map[string]interface{}{
		"tier":         meta.Tier,
		"plan_name":    meta.PlanName,
		"upgrade":      meta.Upgrade,
		"base_paise":   baseAmount,
		"tax_paise":    taxAmount,
		"tax_rate":     taxRate,
	})
	_, err = s.db.Exec(ctx,
		`INSERT INTO payments (user_id, razorpay_order_id, amount_paise, type, status, idempotency_key, metadata)
		 VALUES ($1, $2, $3, 'subscription_purchase', 'pending', $4, $5)`,
		userID, order.ID, totalAmount, idempotencyKey, metaBytes,
	)
	if err != nil {
		return nil, fmt.Errorf("payment record error: %w", err)
	}

	res := &PurchaseResult{
		OrderID:     order.ID,
		Amount:      totalAmount,
		BaseAmount:  baseAmount,
		TaxAmount:   taxAmount,
		TotalAmount: totalAmount,
		TaxRate:     taxRate,
		Currency:    "INR",
	}
	if s.cfg.Payment.Provider == "mock" {
		res.MockCheckoutURL = fmt.Sprintf("%s/mock-checkout?order_id=%s&subscription_tier=%s",
			s.cfg.CORS.BackendURL, order.ID, plan.Tier)
	} else {
		res.KeyID = s.cfg.Payment.RazorpayKeyID
	}
	return res, nil
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

// VerifyPayment verifies a Razorpay payment for a subscription.
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
		 WHERE razorpay_order_id = $1 AND user_id = $2 AND type = 'subscription_purchase'`,
		req.RazorpayOrderID, userID,
	).Scan(&paymentID, &idempotencyKey, &amountPaise, &metadataRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		return errors.New("subscription order not found")
	}
	if err != nil {
		return err
	}

	if err := s.validateCapturedPayment(ctx, req.RazorpayPaymentID, req.RazorpayOrderID, amountPaise); err != nil {
		return err
	}

	var meta paymentMetadata
	_ = json.Unmarshal(metadataRaw, &meta)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	res, err := tx.Exec(ctx,
		`UPDATE payments SET status = 'captured', razorpay_payment_id = $1, updated_at = NOW()
		 WHERE razorpay_order_id = $2 AND status <> 'captured'`,
		req.RazorpayPaymentID, req.RazorpayOrderID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return nil
	}

	plan, err := s.GetTier(ctx, meta.Tier)
	if err != nil {
		return err
	}

	var upgradedFrom interface{}
	if meta.Upgrade {
		active, _, err := s.getActive(ctx, userID)
		if err != nil {
			return err
		}
		if active == nil || active.Tier != "pro" {
			return ErrNoProForUpgrade
		}
		upgradedFrom = active.ID
		_, err = tx.Exec(ctx,
			`UPDATE user_subscriptions SET active = false, expires_at = NOW() WHERE id = $1`,
			active.ID)
		if err != nil {
			return err
		}
	}

	subID := uuid.New().String()
	var expiresAt time.Time
	err = tx.QueryRow(ctx,
		`INSERT INTO user_subscriptions (id, user_id, tier, payment_id, activated_at, expires_at, active, upgraded_from)
		 VALUES ($1, $2, $3::subscription_tier, $4, NOW(), NOW() + ($5::text || ' days')::interval, true, $6)
		 RETURNING expires_at`,
		subID, userID, meta.Tier, paymentID, strconv.Itoa(plan.DurationDays), upgradedFrom).Scan(&expiresAt)
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
			_ = s.mailer.SendPaymentReceipt(userEmail, userName, meta.PlanName, req.RazorpayOrderID, req.RazorpayPaymentID,
				email.FormatRupees(amountPaise), email.FormatRupees(meta.BasePaise), email.FormatRupees(meta.TaxPaise),
				"subscription", meta.Tier, expiresAt.Format("2 Jan 2006"), time.Now().Format("2 Jan 2006"))
			_ = s.mailer.SendSubscriptionActivated(userEmail, userName, meta.Tier, expiresAt.Format("2 Jan 2006"))
		}
	}()

	log.Info().Str("user_id", userID).Str("tier", meta.Tier).Bool("upgrade", meta.Upgrade).Msg("Subscription activated")
	return nil
}

// HandleWebhook processes Razorpay webhooks for subscription payments.
func (s *Service) HandleWebhook(ctx context.Context, payload []byte, signature string) error {
	if !s.provider.VerifyWebhookSignature(payload, signature) {
		return errors.New("invalid webhook signature")
	}

	event, err := s.provider.ParseWebhookEvent(payload)
	if err != nil {
		return fmt.Errorf("webhook parse error: %w", err)
	}

	log.Info().Str("event", event.Event).Str("order_id", event.OrderID).Msg("Subscription webhook received")

	if event.Event != "payment.captured" {
		if event.Event == "payment.failed" && event.Status == "failed" && event.OrderID != "" {
			_, _ = s.db.Exec(ctx,
				`UPDATE payments SET status = 'failed', updated_at = NOW()
				 WHERE razorpay_order_id = $1 AND status = 'pending' AND type = 'subscription_purchase'`,
				event.OrderID)
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
		 WHERE razorpay_order_id = $1 AND type = 'subscription_purchase'`,
		event.OrderID,
	).Scan(&paymentID, &userID, &idempotencyKey, &amountPaise, &metadataRaw)
	if errors.Is(err, pgx.ErrNoRows) {
		log.Warn().Str("order_id", event.OrderID).Msg("Webhook for unknown subscription order — ignoring")
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

	var meta paymentMetadata
	_ = json.Unmarshal(metadataRaw, &meta)

	tx, err := s.db.Begin(ctx)
	if err != nil {
		return err
	}
	defer tx.Rollback(ctx)

	res, err := tx.Exec(ctx,
		`UPDATE payments SET status = 'captured', razorpay_payment_id = $1, updated_at = NOW()
		 WHERE razorpay_order_id = $2 AND status <> 'captured' AND type = 'subscription_purchase'`,
		event.PaymentID, event.OrderID)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		log.Info().Str("order_id", event.OrderID).Msg("Duplicate subscription webhook — already processed")
		return nil
	}

	plan, err := s.GetTier(ctx, meta.Tier)
	if err != nil {
		return err
	}

	var upgradedFrom interface{}
	if meta.Upgrade {
		active, _, err := s.getActive(ctx, userID)
		if err != nil {
			return err
		}
		if active == nil || active.Tier != "pro" {
			return ErrNoProForUpgrade
		}
		upgradedFrom = active.ID
		_, err = tx.Exec(ctx,
			`UPDATE user_subscriptions SET active = false, expires_at = NOW() WHERE id = $1`,
			active.ID)
		if err != nil {
			return err
		}
	}

	subID := uuid.New().String()
	var expiresAt time.Time
	err = tx.QueryRow(ctx,
		`INSERT INTO user_subscriptions (id, user_id, tier, payment_id, activated_at, expires_at, active, upgraded_from)
		 VALUES ($1, $2, $3::subscription_tier, $4, NOW(), NOW() + ($5::text || ' days')::interval, true, $6)
		 RETURNING expires_at`,
		subID, userID, meta.Tier, paymentID, strconv.Itoa(plan.DurationDays), upgradedFrom).Scan(&expiresAt)
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
			_ = s.mailer.SendPaymentReceipt(userEmail, userName, meta.PlanName, event.OrderID, event.PaymentID,
				email.FormatRupees(amountPaise), email.FormatRupees(meta.BasePaise), email.FormatRupees(meta.TaxPaise),
				"subscription", meta.Tier, expiresAt.Format("2 Jan 2006"), time.Now().Format("2 Jan 2006"))
			_ = s.mailer.SendSubscriptionActivated(userEmail, userName, meta.Tier, expiresAt.Format("2 Jan 2006"))
		}
	}()

	log.Info().Str("user_id", userID).Str("tier", meta.Tier).Msg("Subscription activated via webhook")
	return nil
}

// StartExpiryPoller deactivates expired subscriptions in the background,
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
				if err := s.pollSubscriptions(ctx); err != nil {
					log.Error().Err(err).Msg("Failed to poll subscriptions")
				}
			}
		}
	}()
}

func (s *Service) pollSubscriptions(ctx context.Context) error {
	// Expire active subscriptions and notify users
	rows, err := s.db.Query(ctx,
		`SELECT us.id, us.tier, u.name, u.email
		 FROM user_subscriptions us
		 JOIN users u ON u.id = us.user_id
		 WHERE us.expires_at < NOW() AND us.active = true AND us.expired_notification_sent = false`)
	if err != nil {
		return err
	}
	defer rows.Close()

	type notify struct{ id, tier, name, email string }
	var expired []notify
	for rows.Next() {
		var n notify
		if err := rows.Scan(&n.id, &n.tier, &n.name, &n.email); err != nil {
			return err
		}
		expired = append(expired, n)
	}

	for _, n := range expired {
		if n.email != "" {
			_ = s.mailer.SendSubscriptionExpired(n.email, n.name, n.tier)
		}
		_, _ = s.db.Exec(ctx,
			`UPDATE user_subscriptions SET active = false, expired_notification_sent = true WHERE id = $1`,
			n.id)
	}

	// Warn users whose subscriptions expire within 2 days
	warningRows, err := s.db.Query(ctx,
		`SELECT us.id, us.tier, us.expires_at, u.name, u.email
		 FROM user_subscriptions us
		 JOIN users u ON u.id = us.user_id
		 WHERE us.expires_at BETWEEN NOW() AND NOW() + INTERVAL '2 days'
		   AND us.active = true
		   AND us.expiry_warning_sent = false`)
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
		if err := warningRows.Scan(&n.id, &n.tier, &expiresAt, &n.name, &n.email); err != nil {
			return err
		}
		warnings = append(warnings, struct {
			notify
			expiresAt time.Time
		}{n, expiresAt})
	}

	for _, w := range warnings {
		if w.email != "" {
			_ = s.mailer.SendSubscriptionExpiryWarning(w.email, w.name, w.tier, w.expiresAt.Format("2 Jan 2006"))
		}
		_, _ = s.db.Exec(ctx,
			`UPDATE user_subscriptions SET expiry_warning_sent = true WHERE id = $1`,
			w.id)
	}

	return nil
}
