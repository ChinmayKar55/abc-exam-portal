package payments

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

type paymentMetadata struct {
	BasePaise    int    `json:"base_paise"`
	TaxPaise     int    `json:"tax_paise"`
	TaxRate      int    `json:"tax_rate"`
	PlanName     string `json:"plan_name"`
	Tier         string `json:"tier"`
	PlanID       string `json:"plan_id"`
	DurationDays int    `json:"duration_days"`
}

func (s *Service) GetMyPayment(ctx context.Context, userID, orderID string) (*Payment, error) {
	var p Payment
	var metadata []byte
	err := s.db.QueryRow(ctx,
		`SELECT id, razorpay_order_id, razorpay_payment_id, amount_paise, type, status, metadata, created_at, updated_at
		 FROM payments
		 WHERE razorpay_order_id = $1 AND user_id = $2`,
		orderID, userID,
	).Scan(&p.ID, &p.RazorpayOrderID, &p.RazorpayPaymentID, &p.AmountPaise, &p.Type, &p.Status, &metadata, &p.CreatedAt, &p.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrPaymentNotFound
	}
	if err != nil {
		return nil, err
	}

	var meta paymentMetadata
	_ = json.Unmarshal(metadata, &meta)
	p.BaseAmountPaise = meta.BasePaise
	p.TaxAmountPaise = meta.TaxPaise
	p.TaxRate = meta.TaxRate
	p.Currency = "INR"
	p.ItemName = meta.PlanName
	p.Tier = meta.Tier
	p.PlanID = meta.PlanID
	p.DurationDays = meta.DurationDays
	return &p, nil
}

func (s *Service) ListMyPayments(ctx context.Context, userID string) ([]Payment, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, razorpay_order_id, razorpay_payment_id, amount_paise, type, status, metadata, created_at, updated_at
		 FROM payments
		 WHERE user_id = $1
		 ORDER BY created_at DESC`,
		userID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Payment
	for rows.Next() {
		var p Payment
		var metadata []byte
		if err := rows.Scan(&p.ID, &p.RazorpayOrderID, &p.RazorpayPaymentID, &p.AmountPaise, &p.Type, &p.Status, &metadata, &p.CreatedAt, &p.UpdatedAt); err != nil {
			return nil, err
		}
		var meta paymentMetadata
		_ = json.Unmarshal(metadata, &meta)
		p.BaseAmountPaise = meta.BasePaise
		p.TaxAmountPaise = meta.TaxPaise
		p.TaxRate = meta.TaxRate
		p.Currency = "INR"
		p.ItemName = meta.PlanName
		p.Tier = meta.Tier
		p.PlanID = meta.PlanID
		p.DurationDays = meta.DurationDays
		out = append(out, p)
	}
	if out == nil {
		out = []Payment{}
	}
	return out, nil
}
