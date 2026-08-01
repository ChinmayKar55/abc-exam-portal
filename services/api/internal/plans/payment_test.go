package plans

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abc-exam/api/internal/config"
	"github.com/abc-exam/api/internal/payment"
)

type paymentTestProvider struct {
	mu               sync.RWMutex
	details          payment.PaymentDetails
	event            payment.WebhookEvent
	paymentSignature bool
	webhookSignature bool
}

func (p *paymentTestProvider) CreateOrder(context.Context, payment.CreateOrderRequest) (payment.Order, error) {
	return payment.Order{}, nil
}

func (p *paymentTestProvider) FetchPayment(context.Context, string) (payment.PaymentDetails, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.details, nil
}

func (p *paymentTestProvider) VerifyWebhookSignature([]byte, string) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.webhookSignature
}

func (p *paymentTestProvider) ParseWebhookEvent([]byte) (*payment.WebhookEvent, error) {
	p.mu.RLock()
	defer p.mu.RUnlock()
	event := p.event
	return &event, nil
}

func (p *paymentTestProvider) VerifyPaymentSignature(string, string, string) bool {
	p.mu.RLock()
	defer p.mu.RUnlock()
	return p.paymentSignature
}

func (p *paymentTestProvider) setEvent(event payment.WebhookEvent) {
	p.mu.Lock()
	defer p.mu.Unlock()
	p.event = event
}

func capturedTestProvider() *paymentTestProvider {
	return &paymentTestProvider{
		details: payment.PaymentDetails{
			ID:       "pay_live_456",
			OrderID:  "order_live_123",
			Amount:   19900,
			Currency: "INR",
			Status:   "captured",
			Captured: true,
		},
		event: payment.WebhookEvent{
			Event:     "payment.captured",
			OrderID:   "order_live_123",
			PaymentID: "pay_live_456",
			Amount:    19900,
			Currency:  "INR",
			Status:    "captured",
		},
		paymentSignature: true,
		webhookSignature: true,
	}
}

func TestValidateCapturedPayment(t *testing.T) {
	tests := []struct {
		name    string
		mutate  func(*payment.PaymentDetails)
		wantErr error
	}{
		{name: "valid"},
		{name: "wrong payment", mutate: func(p *payment.PaymentDetails) { p.ID = "pay_other" }, wantErr: ErrPaymentMismatch},
		{name: "wrong order", mutate: func(p *payment.PaymentDetails) { p.OrderID = "order_other" }, wantErr: ErrPaymentMismatch},
		{name: "wrong amount", mutate: func(p *payment.PaymentDetails) { p.Amount = 1 }, wantErr: ErrPaymentMismatch},
		{name: "wrong currency", mutate: func(p *payment.PaymentDetails) { p.Currency = "USD" }, wantErr: ErrPaymentMismatch},
		{name: "authorized", mutate: func(p *payment.PaymentDetails) { p.Status = "authorized"; p.Captured = false }, wantErr: ErrPaymentNotCaptured},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			provider := capturedTestProvider()
			if tt.mutate != nil {
				tt.mutate(&provider.details)
			}
			service := &Service{provider: provider}
			err := service.validateCapturedPayment(context.Background(), "pay_live_456", "order_live_123", 19900)
			if !errors.Is(err, tt.wantErr) {
				t.Fatalf("got error %v, want %v", err, tt.wantErr)
			}
		})
	}
}

func openPaymentTestDB(t *testing.T) *pgxpool.Pool {
	t.Helper()
	databaseURL := os.Getenv("TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("TEST_DATABASE_URL is not set")
	}

	ctx := context.Background()
	admin, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect test database: %v", err)
	}

	schema := "payment_test_" + strings.ReplaceAll(uuid.NewString(), "-", "")
	if _, err := admin.Exec(ctx, "CREATE SCHEMA "+pgx.Identifier{schema}.Sanitize()); err != nil {
		admin.Close()
		t.Fatalf("create test schema: %v", err)
	}

	poolConfig, err := pgxpool.ParseConfig(databaseURL)
	if err != nil {
		admin.Close()
		t.Fatalf("parse test database URL: %v", err)
	}
	poolConfig.ConnConfig.RuntimeParams["search_path"] = schema
	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		admin.Close()
		t.Fatalf("connect test schema: %v", err)
	}

	t.Cleanup(func() {
		pool.Close()
		_, _ = admin.Exec(context.Background(), "DROP SCHEMA "+pgx.Identifier{schema}.Sanitize()+" CASCADE")
		admin.Close()
	})

	schemaSQL := `
		CREATE TYPE payment_status AS ENUM ('pending', 'captured', 'failed', 'refunded');
		CREATE TYPE payment_type AS ENUM ('plan_purchase', 'exam_purchase');
		CREATE TABLE users (id UUID PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL);
		CREATE TABLE plans (id UUID PRIMARY KEY, name TEXT NOT NULL, price_paise INTEGER NOT NULL, duration_days INTEGER NOT NULL DEFAULT 0, active BOOLEAN NOT NULL DEFAULT true);
		CREATE TABLE payments (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id),
			razorpay_order_id TEXT UNIQUE NOT NULL,
			razorpay_payment_id TEXT UNIQUE,
			amount_paise INTEGER NOT NULL,
			type payment_type NOT NULL,
			status payment_status NOT NULL DEFAULT 'pending',
			idempotency_key TEXT UNIQUE NOT NULL,
			metadata JSONB NOT NULL DEFAULT '{}',
			created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
		);
		CREATE TABLE user_plans (
			id UUID PRIMARY KEY,
			user_id UUID NOT NULL REFERENCES users(id),
			plan_id UUID NOT NULL REFERENCES plans(id),
			payment_id UUID REFERENCES payments(id),
			activated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
			expires_at TIMESTAMPTZ,
			active BOOLEAN NOT NULL DEFAULT true,
			expiry_warning_sent BOOLEAN NOT NULL DEFAULT false,
			expired_notification_sent BOOLEAN NOT NULL DEFAULT false
		);
		CREATE UNIQUE INDEX uq_user_plans_payment ON user_plans(payment_id) WHERE payment_id IS NOT NULL;
	`
	if _, err := pool.Exec(ctx, schemaSQL); err != nil {
		t.Fatalf("create payment test tables: %v", err)
	}
	return pool
}

func seedPendingPayment(t *testing.T, pool *pgxpool.Pool) string {
	t.Helper()
	ctx := context.Background()
	userID := uuid.NewString()
	planID := uuid.NewString()
	paymentID := uuid.NewString()
	if _, err := pool.Exec(ctx, `INSERT INTO users (id, name, email) VALUES ($1, 'Test User', '')`, userID); err != nil {
		t.Fatalf("insert user: %v", err)
	}
	if _, err := pool.Exec(ctx, `INSERT INTO plans (id, name, price_paise) VALUES ($1, 'Test Plan', 19900)`, planID); err != nil {
		t.Fatalf("insert plan: %v", err)
	}
	metadata := fmt.Sprintf(`{"plan_id":%q,"plan_name":"Test Plan"}`, planID)
	if _, err := pool.Exec(ctx, `
		INSERT INTO payments (id, user_id, razorpay_order_id, amount_paise, type, status, idempotency_key, metadata)
		VALUES ($1, $2, 'order_live_123', 19900, 'plan_purchase', 'pending', $3, $4)`,
		paymentID, userID, uuid.NewString(), metadata); err != nil {
		t.Fatalf("insert payment: %v", err)
	}
	return userID
}

func newPaymentTestService(pool *pgxpool.Pool, provider *paymentTestProvider) *Service {
	return &Service{
		db:       pool,
		cfg:      &config.Config{Payment: config.PaymentConfig{Provider: "razorpay"}},
		provider: provider,
	}
}

func TestConcurrentVerificationAndWebhookActivateOnce(t *testing.T) {
	pool := openPaymentTestDB(t)
	userID := seedPendingPayment(t, pool)
	provider := capturedTestProvider()
	service := newPaymentTestService(pool, provider)
	request := VerifyPaymentRequest{
		RazorpayPaymentID: "pay_live_456",
		RazorpayOrderID:   "order_live_123",
		RazorpaySignature: "valid",
	}

	start := make(chan struct{})
	errorsCh := make(chan error, 2)
	var wg sync.WaitGroup
	wg.Add(2)
	go func() {
		defer wg.Done()
		<-start
		errorsCh <- service.VerifyPayment(context.Background(), userID, request)
	}()
	go func() {
		defer wg.Done()
		<-start
		errorsCh <- service.HandleWebhook(context.Background(), []byte("payload"), "valid")
	}()
	close(start)
	wg.Wait()
	close(errorsCh)

	for err := range errorsCh {
		if err != nil {
			t.Fatalf("concurrent activation failed: %v", err)
		}
	}

	var activations int
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM user_plans`).Scan(&activations); err != nil {
		t.Fatalf("count activations: %v", err)
	}
	if activations != 1 {
		t.Fatalf("got %d activations, want 1", activations)
	}
}

func TestDuplicateWebhookAndDelayedFailure(t *testing.T) {
	pool := openPaymentTestDB(t)
	seedPendingPayment(t, pool)
	provider := capturedTestProvider()
	service := newPaymentTestService(pool, provider)

	for i := 0; i < 2; i++ {
		if err := service.HandleWebhook(context.Background(), []byte("payload"), "valid"); err != nil {
			t.Fatalf("captured webhook %d: %v", i+1, err)
		}
	}
	provider.setEvent(payment.WebhookEvent{
		Event:     "payment.failed",
		OrderID:   "order_live_123",
		PaymentID: "pay_live_456",
		Amount:    19900,
		Currency:  "INR",
		Status:    "failed",
	})
	if err := service.HandleWebhook(context.Background(), []byte("payload"), "valid"); err != nil {
		t.Fatalf("delayed failure webhook: %v", err)
	}

	var status string
	var activations int
	if err := pool.QueryRow(context.Background(), `SELECT status FROM payments WHERE razorpay_order_id = 'order_live_123'`).Scan(&status); err != nil {
		t.Fatalf("read payment status: %v", err)
	}
	if err := pool.QueryRow(context.Background(), `SELECT COUNT(*) FROM user_plans`).Scan(&activations); err != nil {
		t.Fatalf("count activations: %v", err)
	}
	if status != "captured" || activations != 1 {
		t.Fatalf("got status %q and %d activations", status, activations)
	}
}
