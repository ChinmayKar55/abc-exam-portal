package payments

import (
	"errors"

	"github.com/gofiber/fiber/v2"

	"github.com/abc-exam/api/internal/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) GetMyPayment(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	orderID := c.Params("order_id")
	p, err := h.svc.GetMyPayment(c.Context(), userID, orderID)
	if err != nil {
		if errors.Is(err, ErrPaymentNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": p})
}

func (h *Handler) ListMyPayments(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	payments, err := h.svc.ListMyPayments(c.Context(), userID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": payments})
}
