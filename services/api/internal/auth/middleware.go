package auth

import (
	"strings"

	"github.com/gofiber/fiber/v2"
)

const (
	CtxUserID = "userID"
	CtxRole   = "role"
	CtxEmail  = "email"
)

func Middleware(jwtSecret string) fiber.Handler {
	return func(c *fiber.Ctx) error {
		header := c.Get("Authorization")
		if header == "" || !strings.HasPrefix(header, "Bearer ") {
			return fiber.NewError(fiber.StatusUnauthorized, "missing or invalid authorization header")
		}
		tokenStr := strings.TrimPrefix(header, "Bearer ")

		claims, err := validateAccessToken(tokenStr, jwtSecret)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid or expired token")
		}

		c.Locals(CtxUserID, claims.UserID)
		c.Locals(CtxRole, claims.Role)
		c.Locals(CtxEmail, claims.Email)
		return c.Next()
	}
}

func RequireRole(roles ...string) fiber.Handler {
	allowed := make(map[string]bool, len(roles))
	for _, r := range roles {
		allowed[r] = true
	}
	return func(c *fiber.Ctx) error {
		role, ok := c.Locals(CtxRole).(string)
		if !ok || !allowed[role] {
			return fiber.NewError(fiber.StatusForbidden, "insufficient permissions")
		}
		return c.Next()
	}
}

func GetUserID(c *fiber.Ctx) string {
	id, _ := c.Locals(CtxUserID).(string)
	return id
}

func GetRole(c *fiber.Ctx) string {
	role, _ := c.Locals(CtxRole).(string)
	return role
}
