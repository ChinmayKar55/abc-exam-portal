package results

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

func (h *Handler) GetResult(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	includeReview := c.QueryBool("review", false)

	result, err := h.svc.GetResult(c.Context(), c.Params("attemptId"), userID, includeReview)
	if err != nil {
		if errors.Is(err, ErrAttemptNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		if errors.Is(err, ErrNotOwner) {
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		}
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}
	return c.JSON(fiber.Map{"success": true, "data": result})
}

func (h *Handler) ListMyResults(c *fiber.Ctx) error {
	list, err := h.svc.ListMyResults(c.Context(), auth.GetUserID(c))
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": list})
}
