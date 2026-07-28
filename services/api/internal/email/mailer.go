package email

import (
	"fmt"
	"net/smtp"

	"github.com/rs/zerolog/log"

	"github.com/abc-exam/api/internal/config"
)

type Mailer struct {
	cfg *config.Config
}

func NewMailer(cfg *config.Config) *Mailer {
	return &Mailer{cfg: cfg}
}

func (m *Mailer) send(to, subject, body string) error {
	if m.cfg.Email.SMTPUser == "" {
		log.Info().
			Str("to", to).
			Str("subject", subject).
			Str("body", body).
			Msg("[DEV] Email not sent — SMTP not configured, logging instead")
		return nil
	}

	auth := smtp.PlainAuth("", m.cfg.Email.SMTPUser, m.cfg.Email.SMTPPass, m.cfg.Email.SMTPHost)
	addr := fmt.Sprintf("%s:%d", m.cfg.Email.SMTPHost, m.cfg.Email.SMTPPort)
	msg := fmt.Sprintf("From: %s\r\nTo: %s\r\nSubject: %s\r\nMIME-Version: 1.0\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n%s",
		m.cfg.Email.From, to, subject, body)

	return smtp.SendMail(addr, auth, m.cfg.Email.From, []string{to}, []byte(msg))
}

const brandName = "OSSSC Online"

func (m *Mailer) SendOTP(to, name, otp string) error {
	subject := brandName + " — Verify Your Email"
	body := fmt.Sprintf(`Hi %s,

Welcome to %s! Your one-time verification code is: %s

This code expires in 10 minutes. Please do not share it with anyone.

After verification, log in with your email and password to explore exam plans and start practising.

Good luck!

— %s`, name, brandName, otp, brandName)
	return m.send(to, subject, body)
}

func (m *Mailer) SendPasswordReset(to, name, resetLink string) error {
	subject := brandName + " — Reset Your Password"
	body := fmt.Sprintf("Hi %s,\n\nClick the link below to reset your password:\n%s\n\nThis link expires in 15 minutes.\n\nIf you did not request this, ignore this email.\n\n— %s", name, resetLink, brandName)
	return m.send(to, subject, body)
}

func (m *Mailer) SendWelcome(to, name string) error {
	subject := "Welcome to " + brandName + "!"
	body := fmt.Sprintf("Hi %s,\n\nYour email has been verified. You can now log in and purchase a plan to start practising for your OSSSC exams.\n\nGood luck!\n\n— %s", name, brandName)
	return m.send(to, subject, body)
}

func (m *Mailer) SendPlanActivation(to, name, planName string) error {
	subject := brandName + " — Plan Activated"
	body := fmt.Sprintf("Hi %s,\n\nYour %s plan has been activated successfully. You now have full access to your exams.\n\nLog in to start: %s\n\n— %s", name, planName, "http://localhost:3000/exams", brandName)
	return m.send(to, subject, body)
}
