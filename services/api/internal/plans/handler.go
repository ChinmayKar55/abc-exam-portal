package plans

import (
	"errors"
	"strings"

	"github.com/gofiber/fiber/v2"

	"github.com/abc-exam/api/internal/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListPlans(c *fiber.Ctx) error {
	plans, err := h.svc.ListPlans(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": plans})
}

func (h *Handler) GetPlan(c *fiber.Ctx) error {
	p, err := h.svc.GetPlan(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, ErrPlanNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": p})
}

func (h *Handler) CreatePlan(c *fiber.Ctx) error {
	var req CreatePlanRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.Name) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "name is required")
	}
	p, err := h.svc.CreatePlan(c.Context(), req)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": p})
}

func (h *Handler) UpdatePlan(c *fiber.Ctx) error {
	var req UpdatePlanRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	p, err := h.svc.UpdatePlan(c.Context(), c.Params("id"), req)
	if err != nil {
		if errors.Is(err, ErrPlanNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": p})
}

func (h *Handler) DeletePlan(c *fiber.Ctx) error {
	if err := h.svc.DeletePlan(c.Context(), c.Params("id")); err != nil {
		if errors.Is(err, ErrPlanNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "plan deleted"})
}

func (h *Handler) ListMaterials(c *fiber.Ctx) error {
	materials, err := h.svc.ListMaterials(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": materials})
}

func (h *Handler) GetMyPlan(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	plans, err := h.svc.GetMyPlans(c.Context(), userID)
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": plans})
}

func (h *Handler) InitiatePurchase(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	planID := c.Params("id")

	result, err := h.svc.InitiatePurchase(c.Context(), userID, planID)
	if err != nil {
		if errors.Is(err, ErrPlanNotFound) {
			return fiber.NewError(fiber.StatusNotFound, "plan not found")
		}
		if errors.Is(err, ErrAlreadyOwned) {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": result})
}

func (h *Handler) HandleWebhook(c *fiber.Ctx) error {
	body := c.Body()
	signature := c.Get("X-Razorpay-Signature")
	if signature == "" {
		signature = c.Get("X-Mock-Signature")
	}

	if err := h.svc.HandleWebhook(c.Context(), body, signature); err != nil {
		if err.Error() == "invalid webhook signature" {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid webhook signature")
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true})
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
		case "payment order not found":
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		case "invalid payment signature":
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		default:
			return fiber.NewError(fiber.StatusInternalServerError, "payment verification failed")
		}
	}
	return c.JSON(fiber.Map{"success": true, "message": "payment verified and plan activated"})
}
