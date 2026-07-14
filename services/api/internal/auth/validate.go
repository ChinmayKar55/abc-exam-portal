package auth

import (
	"fmt"
	"net/mail"
	"strings"
)

func validate(req interface{}) error {
	switch r := req.(type) {
	case RegisterRequest:
		if strings.TrimSpace(r.Name) == "" || len(r.Name) < 2 {
			return fmt.Errorf("name must be at least 2 characters")
		}
		if _, err := mail.ParseAddress(r.Email); err != nil {
			return fmt.Errorf("invalid email address")
		}
		if len(r.Phone) < 10 {
			return fmt.Errorf("phone must be at least 10 digits")
		}
		if len(r.Password) < 8 {
			return fmt.Errorf("password must be at least 8 characters")
		}
	case VerifyEmailRequest:
		if _, err := mail.ParseAddress(r.Email); err != nil {
			return fmt.Errorf("invalid email address")
		}
		if len(r.OTP) != 6 {
			return fmt.Errorf("OTP must be 6 digits")
		}
	case LoginRequest:
		if _, err := mail.ParseAddress(r.Email); err != nil {
			return fmt.Errorf("invalid email address")
		}
		if r.Password == "" {
			return fmt.Errorf("password is required")
		}
	case ForgotPasswordRequest:
		if _, err := mail.ParseAddress(r.Email); err != nil {
			return fmt.Errorf("invalid email address")
		}
	case ResetPasswordRequest:
		if r.Token == "" {
			return fmt.Errorf("token is required")
		}
		if len(r.Password) < 8 {
			return fmt.Errorf("password must be at least 8 characters")
		}
	}
	return nil
}
