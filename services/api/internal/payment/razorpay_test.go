package payment

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"testing"
)

func signTestValue(secret, value string) string {
	mac := hmac.New(sha256.New, []byte(secret))
	mac.Write([]byte(value))
	return hex.EncodeToString(mac.Sum(nil))
}

func TestVerifyPaymentSignature(t *testing.T) {
	provider := NewRazorpayProvider("key", "payment-secret", "webhook-secret")
	orderID := "order_live_123"
	paymentID := "pay_live_456"
	signature := signTestValue("payment-secret", orderID+"|"+paymentID)

	if !provider.VerifyPaymentSignature(orderID, paymentID, signature) {
		t.Fatal("expected valid payment signature")
	}
	if provider.VerifyPaymentSignature(orderID, "pay_tampered", signature) {
		t.Fatal("accepted signature for a different payment")
	}
	if provider.VerifyPaymentSignature("order_tampered", paymentID, signature) {
		t.Fatal("accepted signature for a different order")
	}
}

func TestVerifyWebhookSignature(t *testing.T) {
	provider := NewRazorpayProvider("key", "payment-secret", "webhook-secret")
	payload := []byte(`{"event":"payment.captured"}`)
	signature := signTestValue("webhook-secret", string(payload))

	if !provider.VerifyWebhookSignature(payload, signature) {
		t.Fatal("expected valid webhook signature")
	}
	if provider.VerifyWebhookSignature([]byte(`{"event":"payment.failed"}`), signature) {
		t.Fatal("accepted signature for a modified payload")
	}
}

func TestParseCapturedWebhook(t *testing.T) {
	provider := NewRazorpayProvider("key", "payment-secret", "webhook-secret")
	payload := []byte(`{
		"event":"payment.captured",
		"payload":{"payment":{"entity":{
			"id":"pay_live_456",
			"order_id":"order_live_123",
			"amount":19900,
			"currency":"INR",
			"status":"captured"
		}}}
	}`)

	event, err := provider.ParseWebhookEvent(payload)
	if err != nil {
		t.Fatalf("parse webhook: %v", err)
	}
	if event.Event != "payment.captured" || event.PaymentID != "pay_live_456" || event.OrderID != "order_live_123" {
		t.Fatalf("unexpected event identity: %+v", event)
	}
	if event.Amount != 19900 || event.Currency != "INR" || event.Status != "captured" {
		t.Fatalf("unexpected payment details: %+v", event)
	}
}
