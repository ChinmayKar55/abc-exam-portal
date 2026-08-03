package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
	"github.com/rs/zerolog/log"
	"golang.org/x/crypto/bcrypt"

	"github.com/abc-exam/api/internal/config"
	"github.com/abc-exam/api/internal/email"
)

var (
	ErrEmailExists         = errors.New("email already registered")
	ErrUserNotFound        = errors.New("user not found")
	ErrInvalidCredentials  = errors.New("invalid email or password")
	ErrEmailNotVerified    = errors.New("email not verified — check your inbox for the OTP")
	ErrEmailAlreadyVerified = errors.New("email already verified")
	ErrInvalidOTP          = errors.New("invalid or expired OTP")
	ErrInvalidToken        = errors.New("invalid or expired token")
)

type Service struct {
	db     *pgxpool.Pool
	rdb    *redis.Client
	cfg    *config.Config
	mailer *email.Mailer
}

func NewService(db *pgxpool.Pool, rdb *redis.Client, cfg *config.Config, mailer *email.Mailer) *Service {
	return &Service{db: db, rdb: rdb, cfg: cfg, mailer: mailer}
}

func (s *Service) Register(ctx context.Context, req RegisterRequest) error {
	var existing struct {
		ID            string
		EmailVerified bool
	}
	err := s.db.QueryRow(ctx,
		`SELECT id, email_verified FROM users WHERE email = $1`, req.Email,
	).Scan(&existing.ID, &existing.EmailVerified)
	if err != nil && !errors.Is(err, pgx.ErrNoRows) {
		return fmt.Errorf("db error: %w", err)
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return fmt.Errorf("hashing error: %w", err)
	}

	otp, err := generateOTP()
	if err != nil {
		return fmt.Errorf("otp generation error: %w", err)
	}

	if existing.ID != "" {
		if existing.EmailVerified {
			return ErrEmailExists
		}
		// Allow re-registering before verification: update name/phone/password and resend OTP.
		_, err = s.db.Exec(ctx,
			`UPDATE users SET name = $1, phone = $2, password_hash = $3 WHERE id = $4`,
			req.Name, req.Phone, string(hash), existing.ID)
		if err != nil {
			return fmt.Errorf("update error: %w", err)
		}
	} else {
		_, err = s.db.Exec(ctx,
			`INSERT INTO users (name, email, phone, password_hash, role, email_verified)
			 VALUES ($1, $2, $3, $4, 'student', false)`,
			req.Name, req.Email, req.Phone, string(hash))
		if err != nil {
			return fmt.Errorf("insert error: %w", err)
		}
	}

	if err := storeOTP(ctx, s.rdb, req.Email, otp); err != nil {
		return fmt.Errorf("otp store error: %w", err)
	}

	go func() {
		if err := s.mailer.SendOTP(req.Email, req.Name, otp); err != nil {
			log.Error().Err(err).Str("email", req.Email).Msg("Failed to send OTP email")
		}
	}()

	return nil
}

func (s *Service) VerifyEmail(ctx context.Context, req VerifyEmailRequest) error {
	valid, err := verifyOTP(ctx, s.rdb, req.Email, req.OTP)
	if err != nil {
		return fmt.Errorf("otp verify error: %w", err)
	}
	if !valid {
		return ErrInvalidOTP
	}

	var user struct {
		Name string
	}
	err = s.db.QueryRow(ctx,
		`UPDATE users SET email_verified = true WHERE email = $1
		 RETURNING name`, req.Email,
	).Scan(&user.Name)
	if err != nil {
		return fmt.Errorf("update error: %w", err)
	}

	go func() {
		if err := s.mailer.SendWelcome(req.Email, user.Name); err != nil {
			log.Error().Err(err).Msg("Failed to send welcome email")
		}
	}()

	return nil
}

func (s *Service) ResendOTP(ctx context.Context, email string) error {
	var user struct {
		Name          string
		EmailVerified bool
	}
	err := s.db.QueryRow(ctx,
		`SELECT name, email_verified FROM users WHERE email = $1`, email,
	).Scan(&user.Name, &user.EmailVerified)
	if errors.Is(err, pgx.ErrNoRows) {
		return ErrUserNotFound
	}
	if err != nil {
		return fmt.Errorf("db error: %w", err)
	}
	if user.EmailVerified {
		return ErrEmailAlreadyVerified
	}

	otp, err := generateOTP()
	if err != nil {
		return fmt.Errorf("otp generation error: %w", err)
	}
	if err := storeOTP(ctx, s.rdb, email, otp); err != nil {
		return fmt.Errorf("otp store error: %w", err)
	}

	go func() {
		if err := s.mailer.SendOTP(email, user.Name, otp); err != nil {
			log.Error().Err(err).Str("email", email).Msg("Failed to resend OTP email")
		}
	}()

	return nil
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*TokenPair, *UserResponse, error) {
	var user struct {
		ID            string
		Name          string
		Phone         string
		PasswordHash  string
		Role          string
		EmailVerified bool
		CreatedAt     time.Time
	}
	err := s.db.QueryRow(ctx,
		`SELECT id, name, phone, password_hash, role, email_verified, created_at
		 FROM users WHERE email = $1`, req.Email,
	).Scan(&user.ID, &user.Name, &user.Phone, &user.PasswordHash,
		&user.Role, &user.EmailVerified, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, nil, fmt.Errorf("db error: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}
	if !user.EmailVerified {
		return nil, nil, ErrEmailNotVerified
	}

	tokens, userResp, err := s.issueTokenPair(ctx, user.ID, user.Role, req.Email)
	if err != nil {
		return nil, nil, err
	}
	userResp.Name = user.Name
	userResp.Phone = user.Phone
	userResp.EmailVerified = user.EmailVerified
	userResp.CreatedAt = user.CreatedAt
	return tokens, userResp, nil
}

func (s *Service) RefreshToken(ctx context.Context, rawToken string) (*TokenPair, error) {
	tokenHash := hashToken(rawToken)

	var userID, role, email string
	var expiresAt time.Time
	err := s.db.QueryRow(ctx,
		`SELECT user_id, expires_at,
		        (SELECT role FROM users WHERE id = user_id),
		        (SELECT email FROM users WHERE id = user_id)
		 FROM refresh_tokens
		 WHERE token_hash = $1 AND revoked = false`,
		tokenHash,
	).Scan(&userID, &expiresAt, &role, &email)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrInvalidToken
	}
	if err != nil {
		return nil, fmt.Errorf("db error: %w", err)
	}
	if time.Now().After(expiresAt) {
		return nil, ErrInvalidToken
	}

	_, err = s.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, tokenHash)
	if err != nil {
		return nil, fmt.Errorf("revoke error: %w", err)
	}

	tokens, _, err := s.issueTokenPair(ctx, userID, role, email)
	return tokens, err
}

func (s *Service) Logout(ctx context.Context, rawToken string) error {
	tokenHash := hashToken(rawToken)
	_, err := s.db.Exec(ctx,
		`UPDATE refresh_tokens SET revoked = true WHERE token_hash = $1`, tokenHash)
	return err
}

func (s *Service) ForgotPassword(ctx context.Context, req ForgotPasswordRequest) error {
	var userID, name, role string
	err := s.db.QueryRow(ctx,
		`SELECT id, name, role FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &name, &role)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil
	}
	if err != nil {
		return fmt.Errorf("db error: %w", err)
	}

	rawToken, err := generateRefreshToken()
	if err != nil {
		return err
	}
	if err := storeResetToken(ctx, s.rdb, rawToken, userID); err != nil {
		return err
	}

	frontendURL := s.cfg.CORS.FrontendURL
	if strings.EqualFold(role, "admin") {
		frontendURL = s.cfg.CORS.AdminURL
	}
	resetLink := fmt.Sprintf("%s/reset-password?token=%s", frontendURL, rawToken)
	go func() {
		if err := s.mailer.SendPasswordReset(req.Email, name, resetLink); err != nil {
			log.Error().Err(err).Msg("Failed to send password reset email")
		}
	}()
	return nil
}

func (s *Service) ResetPassword(ctx context.Context, req ResetPasswordRequest) error {
	userID, err := getResetToken(ctx, s.rdb, req.Token)
	if err != nil {
		return fmt.Errorf("token lookup error: %w", err)
	}
	if userID == "" {
		return ErrInvalidToken
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return err
	}
	_, err = s.db.Exec(ctx,
		`UPDATE users SET password_hash = $1 WHERE id = $2`, string(hash), userID)
	return err
}

func (s *Service) UpdateProfile(ctx context.Context, userID string, req UpdateProfileRequest) (*UserResponse, error) {
	var user UserResponse
	err := s.db.QueryRow(ctx,
		`UPDATE users
		 SET name = $1, phone = $2
		 WHERE id = $3
		 RETURNING id, name, email, phone, role, email_verified, created_at`,
		req.Name, req.Phone, userID,
	).Scan(&user.ID, &user.Name, &user.Email, &user.Phone, &user.Role, &user.EmailVerified, &user.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("update profile error: %w", err)
	}
	return &user, nil
}

func (s *Service) issueTokenPair(ctx context.Context, userID, role, email string) (*TokenPair, *UserResponse, error) {
	accessToken, err := generateAccessToken(userID, role, email, s.cfg.Auth.JWTSecret, s.cfg.Auth.JWTExpiryMin)
	if err != nil {
		return nil, nil, fmt.Errorf("access token error: %w", err)
	}

	rawRefresh, err := generateRefreshToken()
	if err != nil {
		return nil, nil, fmt.Errorf("refresh token error: %w", err)
	}

	expiresAt := time.Now().AddDate(0, 0, s.cfg.Auth.RefreshTokenExpiryDays)
	_, err = s.db.Exec(ctx,
		`INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
		 VALUES ($1, $2, $3)`,
		userID, hashToken(rawRefresh), expiresAt,
	)
	if err != nil {
		return nil, nil, fmt.Errorf("refresh token store error: %w", err)
	}

	return &TokenPair{
			AccessToken:  accessToken,
			RefreshToken: rawRefresh,
			ExpiresIn:    s.cfg.Auth.JWTExpiryMin * 60,
		}, &UserResponse{
			ID:    userID,
			Email: email,
			Role:  role,
		}, nil
}

func hashToken(token string) string {
	h := sha256.Sum256([]byte(token))
	return hex.EncodeToString(h[:])
}
