package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
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
	ErrEmailExists        = errors.New("email already registered")
	ErrUserNotFound       = errors.New("user not found")
	ErrInvalidCredentials = errors.New("invalid email or password")
	ErrEmailNotVerified   = errors.New("email not verified — check your inbox for the OTP")
	ErrInvalidOTP         = errors.New("invalid or expired OTP")
	ErrInvalidToken       = errors.New("invalid or expired token")
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

func (s *Service) Register(ctx context.Context, req RegisterRequest) (*TokenPair, *UserResponse, error) {
	var exists bool
	if err := s.db.QueryRow(ctx,
		`SELECT EXISTS(SELECT 1 FROM users WHERE email = $1)`, req.Email,
	).Scan(&exists); err != nil {
		return nil, nil, fmt.Errorf("db error: %w", err)
	}
	if exists {
		return nil, nil, ErrEmailExists
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), 12)
	if err != nil {
		return nil, nil, fmt.Errorf("hashing error: %w", err)
	}

	var userID string
	err = s.db.QueryRow(ctx,
		`INSERT INTO users (name, email, phone, password_hash, role, email_verified)
		 VALUES ($1, $2, $3, $4, 'student', true)
		 RETURNING id`,
		req.Name, req.Email, req.Phone, string(hash),
	).Scan(&userID)
	if err != nil {
		return nil, nil, fmt.Errorf("insert error: %w", err)
	}

	go func() {
		if err := s.mailer.SendWelcome(req.Email, req.Name); err != nil {
			log.Error().Err(err).Str("email", req.Email).Msg("Failed to send welcome email")
		}
	}()

	return s.issueTokenPair(ctx, userID, "student", req.Email)
}

func (s *Service) VerifyEmail(ctx context.Context, req VerifyEmailRequest) (*TokenPair, *UserResponse, error) {
	valid, err := verifyOTP(ctx, s.rdb, req.Email, req.OTP)
	if err != nil {
		return nil, nil, fmt.Errorf("otp verify error: %w", err)
	}
	if !valid {
		return nil, nil, ErrInvalidOTP
	}

	var user struct {
		ID   string
		Name string
		Role string
	}
	err = s.db.QueryRow(ctx,
		`UPDATE users SET email_verified = true WHERE email = $1
		 RETURNING id, name, role`, req.Email,
	).Scan(&user.ID, &user.Name, &user.Role)
	if err != nil {
		return nil, nil, fmt.Errorf("update error: %w", err)
	}

	go func() {
		if err := s.mailer.SendWelcome(req.Email, user.Name); err != nil {
			log.Error().Err(err).Msg("Failed to send welcome email")
		}
	}()

	return s.issueTokenPair(ctx, user.ID, user.Role, req.Email)
}

func (s *Service) Login(ctx context.Context, req LoginRequest) (*TokenPair, *UserResponse, error) {
	var user struct {
		ID           string
		Name         string
		Phone        string
		PasswordHash string
		Role         string
		CreatedAt    time.Time
	}
	err := s.db.QueryRow(ctx,
		`SELECT id, name, phone, password_hash, role, created_at
		 FROM users WHERE email = $1`, req.Email,
	).Scan(&user.ID, &user.Name, &user.Phone, &user.PasswordHash,
		&user.Role, &user.CreatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, nil, ErrInvalidCredentials
	}
	if err != nil {
		return nil, nil, fmt.Errorf("db error: %w", err)
	}
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, nil, ErrInvalidCredentials
	}

	tokens, userResp, err := s.issueTokenPair(ctx, user.ID, user.Role, req.Email)
	if err != nil {
		return nil, nil, err
	}
	userResp.Name = user.Name
	userResp.Phone = user.Phone
	userResp.EmailVerified = true
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
	var userID, name string
	err := s.db.QueryRow(ctx,
		`SELECT id, name FROM users WHERE email = $1`, req.Email,
	).Scan(&userID, &name)
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

	resetLink := fmt.Sprintf("%s/reset-password?token=%s", s.cfg.CORS.FrontendURL, rawToken)
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
