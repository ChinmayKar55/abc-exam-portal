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

func (m *Mailer) SendOTP(to, name, otp string) error {
	subject := "ABC Exam Portal — Verify Your Email"
	body := fmt.Sprintf("Hi %s,\n\nYour OTP to verify your email is: %s\n\nThis code expires in 10 minutes.\n\nDo not share this code with anyone.\n\n— ABC Exam Portal", name, otp)
	return m.send(to, subject, body)
}

func (m *Mailer) SendPasswordReset(to, name, resetLink string) error {
	subject := "ABC Exam Portal — Reset Your Password"
	body := fmt.Sprintf("Hi %s,\n\nClick the link below to reset your password:\n%s\n\nThis link expires in 15 minutes.\n\nIf you did not request this, ignore this email.\n\n— ABC Exam Portal", name, resetLink)
	return m.send(to, subject, body)
}

func (m *Mailer) SendWelcome(to, name string) error {
	subject := "Welcome to ABC Exam Portal!"
	body := fmt.Sprintf("Hi %s,\n\nYour account has been verified. You can now log in and purchase a plan to start practising.\n\nGood luck!\n\n— ABC Exam Portal", name)
	return m.send(to, subject, body)
}

func (m *Mailer) SendPlanActivation(to, name, planName string) error {
	subject := "ABC Exam Portal — Plan Activated"
	body := fmt.Sprintf("Hi %s,\n\nYour %s plan has been activated successfully. You now have full access to your exams.\n\nLog in to start: %s\n\n— ABC Exam Portal", name, planName, "http://localhost:3000/exams")
	return m.send(to, subject, body)
}
