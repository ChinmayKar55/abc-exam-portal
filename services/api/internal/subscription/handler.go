package subscription

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/abc-exam/api/internal/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListTiers(c *fiber.Ctx) error {
	tiers, err := h.svc.ListTiers(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": tiers})
}

func (h *Handler) ListTiersAdmin(c *fiber.Ctx) error {
	tiers, err := h.svc.ListTiersAdmin(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": tiers})
}

func (h *Handler) UpdateTier(c *fiber.Ctx) error {
	tier := strings.ToLower(strings.TrimSpace(c.Params("tier")))
	if tier != "pro" && tier != "max" {
		return fiber.NewError(fiber.StatusBadRequest, "tier must be pro or max")
	}

	var req UpdateTierRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	p, err := h.svc.UpdateTier(c.Context(), tier, req)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": p})
}

func (h *Handler) GetMySubscription(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	resp, err := h.svc.GetMySubscription(c.Context(), userID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": resp})
}

func (h *Handler) InitiateSubscribe(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	var req SubscribeRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	tier := strings.ToLower(strings.TrimSpace(req.Tier))
	if tier != "pro" && tier != "max" {
		return fiber.NewError(fiber.StatusBadRequest, "tier must be pro or max")
	}

	result, err := h.svc.InitiateSubscribe(c.Context(), userID, tier)
	if err != nil {
		switch {
		case errors.Is(err, ErrTierNotFound):
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		case errors.Is(err, ErrAlreadySubscribed), errors.Is(err, ErrAlreadyOnMax):
			return fiber.NewError(fiber.StatusConflict, err.Error())
		case strings.Contains(err.Error(), "razorpay"):
			return fiber.NewError(fiber.StatusBadGateway, "payment gateway error: "+err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": result})
}

func (h *Handler) InitiateUpgrade(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	result, err := h.svc.InitiateUpgrade(c.Context(), userID)
	if err != nil {
		switch {
		case errors.Is(err, ErrNoProForUpgrade), errors.Is(err, ErrNoActiveSubscription), errors.Is(err, ErrAlreadyOnMax):
			return fiber.NewError(fiber.StatusConflict, err.Error())
		case strings.Contains(err.Error(), "razorpay"):
			return fiber.NewError(fiber.StatusBadGateway, "payment gateway error: "+err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, err.Error())
		}
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": result})
}

func (h *Handler) VerifyPayment(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	var req VerifyPaymentRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := h.svc.VerifyPayment(c.Context(), userID, req); err != nil {
		switch err.Error() {
		case "missing payment verification fields":
			return fiber.NewError(fiber.StatusBadRequest, err.Error())
		case "subscription order not found":
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		case "invalid payment signature":
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		default:
			if errors.Is(err, ErrPaymentMismatch) || errors.Is(err, ErrPaymentNotCaptured) {
				return fiber.NewError(fiber.StatusUnprocessableEntity, err.Error())
			}
			log.Error().Err(err).Msg("subscription payment verification failed")
			return fiber.NewError(fiber.StatusInternalServerError, "payment verification failed")
		}
	}
	return c.JSON(fiber.Map{"success": true, "message": "subscription activated"})
}

func (h *Handler) HandleWebhook(c *fiber.Ctx) error {
	body := c.Body()
	signature := c.Get("X-Razorpay-Signature")
	if signature == "" {
		signature = c.Get("X-Mock-Signature")
	}
	if err := h.svc.HandleWebhook(c.Context(), body, signature); err != nil {
		if err.Error() == "invalid webhook signature" {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}
