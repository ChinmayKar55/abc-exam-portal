package auth

import (
	"errors"
	"time"

	"github.com/gofiber/fiber/v2"
)

type Handler struct {
	svc *Service
	cfg handlerConfig
}

type handlerConfig struct {
	RefreshTokenExpiryDays int
	IsProd                 bool
}

func NewHandler(svc *Service, refreshDays int, isProd bool) *Handler {
	return &Handler{
		svc: svc,
		cfg: handlerConfig{RefreshTokenExpiryDays: refreshDays, IsProd: isProd},
	}
}

func (h *Handler) Register(c *fiber.Ctx) error {
	var req RegisterRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := validate(req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	tokens, user, err := h.svc.Register(c.Context(), req)
	if err != nil {
		if errors.Is(err, ErrEmailExists) {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return err
	}

	h.setRefreshCookie(c, tokens.RefreshToken)
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success":      true,
		"access_token": tokens.AccessToken,
		"expires_in":   tokens.ExpiresIn,
		"user":         user,
	})
}

// VerifyEmail is no longer required — email verification is automatic on registration.
// This endpoint is kept for backward-compat and always returns 410 Gone.
func (h *Handler) VerifyEmail(c *fiber.Ctx) error {
	return c.Status(fiber.StatusGone).JSON(fiber.Map{
		"success": false,
		"message": "Email verification is no longer required. Please log in directly.",
	})
}

func (h *Handler) Login(c *fiber.Ctx) error {
	var req LoginRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := validate(req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	tokens, user, err := h.svc.Login(c.Context(), req)
	if err != nil {
		if errors.Is(err, ErrInvalidCredentials) {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		return err
	}

	h.setRefreshCookie(c, tokens.RefreshToken)
	return c.JSON(fiber.Map{
		"success":      true,
		"access_token": tokens.AccessToken,
		"expires_in":   tokens.ExpiresIn,
		"user":         user,
	})
}

func (h *Handler) Refresh(c *fiber.Ctx) error {
	rawToken := c.Cookies("refresh_token")
	if rawToken == "" {
		rawToken = c.Get("X-Refresh-Token")
	}
	if rawToken == "" {
		return fiber.NewError(fiber.StatusUnauthorized, "missing refresh token")
	}

	tokens, err := h.svc.RefreshToken(c.Context(), rawToken)
	if err != nil {
		if errors.Is(err, ErrInvalidToken) {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired refresh token")
		}
		return err
	}

	h.setRefreshCookie(c, tokens.RefreshToken)
	return c.JSON(fiber.Map{
		"success":      true,
		"access_token": tokens.AccessToken,
		"expires_in":   tokens.ExpiresIn,
	})
}

func (h *Handler) Logout(c *fiber.Ctx) error {
	rawToken := c.Cookies("refresh_token")
	if rawToken == "" {
		rawToken = c.Get("X-Refresh-Token")
	}

	if rawToken != "" {
		_ = h.svc.Logout(c.Context(), rawToken)
	}

	c.Cookie(&fiber.Cookie{
		Name:    "refresh_token",
		Value:   "",
		Expires: time.Now().Add(-1 * time.Hour),
	})

	return c.JSON(fiber.Map{"success": true, "message": "logged out"})
}

func (h *Handler) ForgotPassword(c *fiber.Ctx) error {
	var req ForgotPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := validate(req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	_ = h.svc.ForgotPassword(c.Context(), req)
	return c.JSON(fiber.Map{
		"success": true,
		"message": "If that email is registered, a reset link has been sent.",
	})
}

func (h *Handler) ResetPassword(c *fiber.Ctx) error {
	var req ResetPasswordRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := validate(req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, err.Error())
	}

	if err := h.svc.ResetPassword(c.Context(), req); err != nil {
		if errors.Is(err, ErrInvalidToken) {
			return fiber.NewError(fiber.StatusUnauthorized, err.Error())
		}
		return err
	}

	return c.JSON(fiber.Map{"success": true, "message": "Password reset successful. You can now log in."})
}

// ResendOTP is no longer required — email verification is automatic on registration.
// This endpoint is kept for backward-compat and always returns 410 Gone.
func (h *Handler) ResendOTP(c *fiber.Ctx) error {
	return c.Status(fiber.StatusGone).JSON(fiber.Map{
		"success": false,
		"message": "Email verification is no longer required. Please log in directly.",
	})
}

func (h *Handler) setRefreshCookie(c *fiber.Ctx, refreshToken string) {
	c.Cookie(&fiber.Cookie{
		Name:     "refresh_token",
		Value:    refreshToken,
		HTTPOnly: true,
		Secure:   h.cfg.IsProd,
		SameSite: "Lax",
		Expires:  time.Now().AddDate(0, 0, h.cfg.RefreshTokenExpiryDays),
		Path:     "/",
	})
}
