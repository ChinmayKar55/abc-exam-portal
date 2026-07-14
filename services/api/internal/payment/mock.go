package payment

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
)

type MockProvider struct {
	webhookSecret string
}

func NewMockProvider(webhookSecret string) *MockProvider {
	return &MockProvider{webhookSecret: webhookSecret}
}

func (m *MockProvider) CreateOrder(_ context.Context, req CreateOrderRequest) (Order, error) {
	return Order{
		ID:       "mock_order_" + uuid.New().String()[:8],
		Amount:   req.Amount,
		Currency: req.Currency,
		Receipt:  req.Receipt,
		Status:   "created",
	}, nil
}

func (m *MockProvider) VerifyWebhookSignature(payload []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(m.webhookSecret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (m *MockProvider) VerifyPaymentSignature(orderID, paymentID, signature string) bool {
	mac := hmac.New(sha256.New, []byte(m.webhookSecret))
	mac.Write([]byte(orderID + "|" + paymentID))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (m *MockProvider) ParseWebhookEvent(payload []byte) (*WebhookEvent, error) {
	var raw struct {
		Event  string `json:"event"`
		Order  struct{ ID string `json:"id"` } `json:"order"`
		Payment struct {
			ID     string `json:"id"`
			Amount int    `json:"amount"`
		} `json:"payment"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, fmt.Errorf("invalid webhook payload: %w", err)
	}
	status := "captured"
	if raw.Event == "payment.failed" {
		status = "failed"
	}
	return &WebhookEvent{
		Event:     raw.Event,
		OrderID:   raw.Order.ID,
		PaymentID: raw.Payment.ID,
		Amount:    raw.Payment.Amount,
		Status:    status,
	}, nil
}

func (m *MockProvider) GenerateWebhookPayload(orderID, paymentID, event string, amount int) ([]byte, string) {
	payload, _ := json.Marshal(map[string]interface{}{
		"event": event,
		"order": map[string]string{"id": orderID},
		"payment": map[string]interface{}{
			"id":         paymentID,
			"amount":     amount,
			"created_at": time.Now().Unix(),
		},
	})
	mac := hmac.New(sha256.New, []byte(m.webhookSecret))
	mac.Write(payload)
	sig := hex.EncodeToString(mac.Sum(nil))
	return payload, sig
}
