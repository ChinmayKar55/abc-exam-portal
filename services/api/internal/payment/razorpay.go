package payment

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"github.com/rs/zerolog/log"
)

type RazorpayProvider struct {
	keyID         string
	keySecret     string
	webhookSecret string
}

func NewRazorpayProvider(keyID, keySecret, webhookSecret string) *RazorpayProvider {
	return &RazorpayProvider{keyID: keyID, keySecret: keySecret, webhookSecret: webhookSecret}
}

func (r *RazorpayProvider) CreateOrder(ctx context.Context, req CreateOrderRequest) (Order, error) {
	body, _ := json.Marshal(map[string]interface{}{
		"amount":   req.Amount,
		"currency": req.Currency,
		"receipt":  req.Receipt,
		"notes":    req.Notes,
	})

	httpReq, err := http.NewRequestWithContext(ctx, "POST", "https://api.razorpay.com/v1/orders", bytes.NewReader(body))
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
		switch resp.StatusCode {
		case http.StatusUnauthorized:
			log.Error().Str("razorpay_key_id", r.keyID).Str("razorpay_key_secret", r.keySecret).Msg("Razorpay CreateOrder authentication failed")
			return Order{}, errors.New("razorpay authentication failed: check your API key ID and secret")
		case http.StatusBadRequest:
			return Order{}, errors.New("razorpay request rejected: invalid order payload")
		default:
			return Order{}, fmt.Errorf("razorpay request failed with status %d", resp.StatusCode)
		}
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

func (r *RazorpayProvider) FetchPayment(ctx context.Context, paymentID string) (PaymentDetails, error) {
	httpReq, err := http.NewRequestWithContext(ctx, "GET", "https://api.razorpay.com/v1/payments/"+url.PathEscape(paymentID), nil)
	if err != nil {
		return PaymentDetails{}, err
	}
	httpReq.SetBasicAuth(r.keyID, r.keySecret)

	resp, err := http.DefaultClient.Do(httpReq)
	if err != nil {
		return PaymentDetails{}, fmt.Errorf("razorpay API error: %w", err)
	}
	defer resp.Body.Close()

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return PaymentDetails{}, fmt.Errorf("razorpay response read error: %w", err)
	}
	if resp.StatusCode != http.StatusOK {
		switch resp.StatusCode {
		case http.StatusUnauthorized:
			log.Error().Str("razorpay_key_id", r.keyID).Str("razorpay_key_secret", r.keySecret).Msg("Razorpay FetchPayment authentication failed")
			return PaymentDetails{}, errors.New("razorpay authentication failed: check your API key ID and secret")
		case http.StatusNotFound:
			log.Error().Str("payment_id", paymentID).Msg("Razorpay payment not found")
			return PaymentDetails{}, errors.New("razorpay payment not found")
		default:
			log.Error().Int("status", resp.StatusCode).Str("payment_id", paymentID).Bytes("response", respBytes).Msg("Razorpay FetchPayment request failed")
			return PaymentDetails{}, fmt.Errorf("razorpay request failed with status %d", resp.StatusCode)
		}
	}

	var result struct {
		ID       string `json:"id"`
		OrderID  string `json:"order_id"`
		Amount   int    `json:"amount"`
		Currency string `json:"currency"`
		Status   string `json:"status"`
		Captured bool   `json:"captured"`
	}
	if err := json.Unmarshal(respBytes, &result); err != nil {
		return PaymentDetails{}, fmt.Errorf("razorpay response decode error: %w", err)
	}

	return PaymentDetails{
		ID:       result.ID,
		OrderID:  result.OrderID,
		Amount:   result.Amount,
		Currency: result.Currency,
		Status:   result.Status,
		Captured: result.Captured,
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
	ok := hmac.Equal([]byte(expected), []byte(signature))
	if !ok {
		log.Error().Str("order_id", orderID).Str("payment_id", paymentID).Str("expected", expected).Str("provided", signature).Msg("Razorpay payment signature mismatch")
	}
	return ok
}

func (r *RazorpayProvider) ParseWebhookEvent(payload []byte) (*WebhookEvent, error) {
	var raw struct {
		Event   string `json:"event"`
		Payload struct {
			Payment struct {
				Entity struct {
					ID       string `json:"id"`
					OrderID  string `json:"order_id"`
					Amount   int    `json:"amount"`
					Currency string `json:"currency"`
					Status   string `json:"status"`
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
		Currency:  raw.Payload.Payment.Entity.Currency,
		Status:    raw.Payload.Payment.Entity.Status,
	}, nil
}
