package payment

import "context"

type CreateOrderRequest struct {
	Amount   int    // in paise
	Currency string // INR
	Receipt  string // idempotency key
	Notes    map[string]string
}

type Order struct {
	ID       string
	Amount   int
	Currency string
	Receipt  string
	Status   string
}

type PaymentDetails struct {
	ID       string
	OrderID  string
	Amount   int
	Currency string
	Status   string
	Captured bool
}

type WebhookEvent struct {
	Event     string
	OrderID   string
	PaymentID string
	Amount    int
	Currency  string
	Status    string
}

type Provider interface {
	CreateOrder(ctx context.Context, req CreateOrderRequest) (Order, error)
	FetchPayment(ctx context.Context, paymentID string) (PaymentDetails, error)
	VerifyWebhookSignature(payload []byte, signature string) bool
	ParseWebhookEvent(payload []byte) (*WebhookEvent, error)
	VerifyPaymentSignature(orderID, paymentID, signature string) bool
}
