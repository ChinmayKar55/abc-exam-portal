package subscription

import (
	"time"
)

// SubscriptionPlan is a system-defined tier (Pro / Max).
type SubscriptionPlan struct {
	ID           string `json:"id"`
	Tier         string `json:"tier"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	PricePaise   int    `json:"price_paise"`
	DurationDays int    `json:"duration_days"`
	Active       bool   `json:"active"`
}

// UserSubscription is a user's active or past subscription.
type UserSubscription struct {
	ID            string     `json:"id"`
	Tier          string     `json:"tier"`
	PaymentID     string     `json:"payment_id,omitempty"`
	ActivatedAt   time.Time  `json:"activated_at"`
	ExpiresAt     time.Time  `json:"expires_at"`
	Active        bool       `json:"active"`
	UpgradedFrom  string     `json:"upgraded_from,omitempty"`
	PlanName      string     `json:"plan_name"`
	RemainingDays int        `json:"remaining_days"`
}

// MySubscriptionResponse is returned to the frontend.
type MySubscriptionResponse struct {
	Tier         string            `json:"tier"` // "free" if none
	Subscription *UserSubscription `json:"subscription,omitempty"`
}

// PurchaseResult mirrors plans.PurchaseResult.
type PurchaseResult struct {
	OrderID         string `json:"order_id"`
	Amount          int    `json:"amount_paise"`
	BaseAmount      int    `json:"base_amount_paise"`
	TaxAmount       int    `json:"tax_paise"`
	TotalAmount     int    `json:"total_paise"`
	TaxRate         int    `json:"tax_rate"`
	Currency        string `json:"currency"`
	MockCheckoutURL string `json:"mock_checkout_url,omitempty"`
	KeyID           string `json:"key_id,omitempty"`
}

// VerifyPaymentRequest mirrors plans.VerifyPaymentRequest.
type VerifyPaymentRequest struct {
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpaySignature string `json:"razorpay_signature"`
}

// SubscribeRequest starts a new subscription purchase.
type SubscribeRequest struct {
	Tier string `json:"tier"`
}

// UpdateTierRequest is admin-only; updates a Pro/Max tier definition.
type UpdateTierRequest struct {
	Name         string `json:"name"`
	Description  string `json:"description"`
	PricePaise   int    `json:"price_paise"`
	DurationDays int    `json:"duration_days"`
	Active       bool   `json:"active"`
}

// paymentMetadata stored in payments.metadata.
type paymentMetadata struct {
	Tier      string `json:"tier"`
	PlanName  string `json:"plan_name"`
	Upgrade   bool   `json:"upgrade"` // true when Pro -> Max
	BasePaise int    `json:"base_paise"`
	TaxPaise  int    `json:"tax_paise"`
	TaxRate   int    `json:"tax_rate"`
}
