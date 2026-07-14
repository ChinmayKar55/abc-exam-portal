package payment

import "context"

type CreateOrderRequest struct {
	Amount         int    // in paise
	Currency       string // INR
	Receipt        string // idempotency key
	Notes          map[string]string
}

type Order struct {
	ID       string
	Amount   int
	Currency string
	Receipt  string
	Status   string
}

type WebhookEvent struct {
	Event   string
	OrderID string
	PaymentID string
	Amount  int
	Status  string
}

type Provider interface {
	CreateOrder(ctx context.Context, req CreateOrderRequest) (Order, error)
	VerifyWebhookSignature(payload []byte, signature string) bool
	ParseWebhookEvent(payload []byte) (*WebhookEvent, error)
	VerifyPaymentSignature(orderID, paymentID, signature string) bool
}
