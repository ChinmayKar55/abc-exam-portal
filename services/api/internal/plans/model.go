package plans

import (
	"encoding/json"
	"time"
)

type Plan struct {
	ID           string         `json:"id"`
	Name         string         `json:"name"`
	Description  string         `json:"description"`
	Features     json.RawMessage `json:"features,omitempty"`
	PricePaise   int            `json:"price_paise"`
	DurationDays int            `json:"duration_days"`
	Active       bool           `json:"active"`
	Exams        []PlanExam     `json:"exams,omitempty"`
	Materials    []PlanMaterial `json:"materials,omitempty"`
}

type PlanExam struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type PlanMaterial struct {
	ID    string `json:"id"`
	Title string `json:"title"`
}

type UserPlan struct {
	PlanID      string          `json:"plan_id"`
	PlanName    string          `json:"plan_name"`
	Features    json.RawMessage `json:"features,omitempty"`
	ActivatedAt time.Time       `json:"activated_at"`
	ExpiresAt   *time.Time      `json:"expires_at,omitempty"`
	DurationDays int            `json:"duration_days"`
	Active      bool            `json:"active"`
	Exams       []PlanExam      `json:"exams,omitempty"`
	Materials   []PlanMaterial  `json:"materials,omitempty"`
}

type CreatePlanRequest struct {
	Name         string   `json:"name"`
	Description  string   `json:"description"`
	PricePaise   int      `json:"price_paise"`
	DurationDays int      `json:"duration_days"`
	Active       bool     `json:"active"`
	ExamIDs      []string `json:"exam_ids"`
	MaterialIDs  []string `json:"material_ids"`
}

type UpdatePlanRequest struct {
	Name         string   `json:"name,omitempty"`
	Description  string   `json:"description,omitempty"`
	PricePaise   int      `json:"price_paise,omitempty"`
	DurationDays *int     `json:"duration_days,omitempty"`
	Active       bool     `json:"active"`
	ExamIDs      []string `json:"exam_ids"`
	MaterialIDs  []string `json:"material_ids"`
}

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

type VerifyPaymentRequest struct {
	RazorpayPaymentID string `json:"razorpay_payment_id"`
	RazorpayOrderID   string `json:"razorpay_order_id"`
	RazorpaySignature string `json:"razorpay_signature"`
}
