package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type RazorpayProvider struct {
	keyID     string
	keySecret string
	webhookSecret string
}

func NewRazorpayProvider(keyID, keySecret, webhookSecret string) *RazorpayProvider {
	return &RazorpayProvider{keyID: keyID, keySecret: keySecret, webhookSecret: webhookSecret}
}

func (r *RazorpayProvider) CreateOrder(_ context.Context, req CreateOrderRequest) (Order, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"amount":   req.Amount,
		"currency": req.Currency,
		"receipt":  req.Receipt,
		"notes":    req.Notes,
	})

	httpReq, err := http.NewRequest("POST", "https://api.razorpay.com/v1/orders", bytes.NewReader(body))
	if err != nil {
		return Order{}, err
	}
	httpReq.SetBasicAuth(r.keyID, r.keySecret)
	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return Order{}, fmt.Errorf("razorpay API error: %w", err)
	}
	defer resp.Body.Close()

	respBytes, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != http.StatusOK {
		return Order{}, fmt.Errorf("razorpay returned %d: %s", resp.StatusCode, string(respBytes))
	}

	var result struct {
		ID       string `json:"id"`
		Amount   int    `json:"amount"`
		Currency string `json:"currency"`
		Receipt  string `json:"receipt"`
		Status   string `json:"status"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return Order{}, err
	}
	return Order{
		ID:       result.ID,
		Amount:   result.Amount,
		Currency: result.Currency,
		Receipt:  result.Receipt,
		Status:   result.Status,
	}, nil
}

func (r *RazorpayProvider) VerifyWebhookSignature(payload []byte, signature string) bool {
	mac := hmac.New(sha256.New, []byte(r.webhookSecret))
	mac.Write(payload)
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (r *RazorpayProvider) VerifyPaymentSignature(orderID, paymentID, signature string) bool {
	secret := r.keySecret
	message := orderID + "|" + paymentID
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(message))
	expected := hex.EncodeToString(mac.Sum(nil))
	return hmac.Equal([]byte(expected), []byte(signature))
}

func (r *RazorpayProvider) ParseWebhookEvent(payload []byte) (*WebhookEvent, error) {
	var raw struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID      string `json:"id"`
					OrderID string `json:"order_id"`
					Amount  int    `json:"amount"`
					Status  string `json:"status"`
				} `json:"entity"`
			} `json:"payment"`
		} `json:"payload"`
	}
	if err := json.Unmarshal(payload, &raw); err != nil {
		return nil, err
	}
	return &WebhookEvent{
		Event:     raw.Event,
		OrderID:   raw.Payload.Payment.Entity.OrderID,
		PaymentID: raw.Payload.Payment.Entity.ID,
		Amount:    raw.Payload.Payment.Entity.Amount,
		Status:    raw.Payload.Payment.Entity.Status,
	}, nil
}
