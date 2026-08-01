package payments

import (
	"errors"
	"time"
)

var ErrPaymentNotFound = errors.New("payment not found")

// Payment represents a single payment record from the shared payments table.
type Payment struct {
	ID                string    `json:"id"`
	RazorpayOrderID   string    `json:"order_id"`
	RazorpayPaymentID *string   `json:"payment_id"`
	AmountPaise       int       `json:"amount_paise"`
	BaseAmountPaise   int       `json:"base_amount_paise"`
	TaxAmountPaise    int       `json:"tax_paise"`
	TaxRate           int       `json:"tax_rate"`
	Currency          string    `json:"currency"`
	Type              string    `json:"type"`
	Status            string    `json:"status"`
	ItemName          string    `json:"item_name"`
	Tier              string    `json:"tier,omitempty"`
	PlanID            string    `json:"plan_id,omitempty"`
	DurationDays      int       `json:"duration_days,omitempty"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}
