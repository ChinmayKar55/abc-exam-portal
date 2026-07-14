package config

import (
	"log"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Port          string
	Env           string
	DB            DBConfig
	Redis         RedisConfig
	Auth          AuthConfig
	Payment       PaymentConfig
	Email         EmailConfig
	Storage       StorageConfig
	CORS          CORSConfig
	RateLimit     RateLimitConfig
	RequestTimeout time.Duration
}

type DBConfig struct {
	URL                string
	MaxConns           int32
	MinConns           int32
	MaxConnLifetime    time.Duration
	MaxConnIdleTime    time.Duration
	HealthCheckPeriod  time.Duration
}

type RedisConfig struct {
	URL      string
	Password string
}

type AuthConfig struct {
	JWTSecret              string
	JWTExpiryMin           int
	RefreshTokenExpiryDays int
}

type PaymentConfig struct {
	Provider         string
	RazorpayKeyID    string
	RazorpaySecret   string
	WebhookSecret    string
}

type EmailConfig struct {
	SMTPHost string
	SMTPPort int
	SMTPUser string
	SMTPPass string
	From     string
}

type StorageConfig struct {
	Provider  string
	LocalPath string
}

type CORSConfig struct {
	FrontendURL string
	AdminURL    string
	BackendURL  string
}

type RateLimitConfig struct {
	Max        int
	AuthMax    int
	Window     time.Duration
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("No .env file found, reading from environment")
	}

	return &Config{
		Port: getEnv("PORT", "8080"),
		Env:  getEnv("ENV", "development"),
		DB: DBConfig{
			URL:               getEnv("DB_URL", "postgres://postgres:postgres@localhost:5432/abc_exam?sslmode=disable"),
			MaxConns:          int32(getEnvInt("DB_MAX_CONNS", 50)),
			MinConns:          int32(getEnvInt("DB_MIN_CONNS", 5)),
			MaxConnLifetime:   getEnvDuration("DB_MAX_CONN_LIFETIME", 30*time.Minute),
			MaxConnIdleTime:   getEnvDuration("DB_MAX_CONN_IDLE_TIME", 10*time.Minute),
			HealthCheckPeriod: getEnvDuration("DB_HEALTH_CHECK_PERIOD", 5*time.Minute),
		},
		Redis: RedisConfig{
			URL:      getEnv("REDIS_URL", "localhost:6379"),
			Password: getEnv("REDIS_PASSWORD", ""),
		},
		Auth: AuthConfig{
			JWTSecret:              getEnv("JWT_SECRET", ""),
			JWTExpiryMin:           getEnvInt("JWT_EXPIRY_MIN", 15),
			RefreshTokenExpiryDays: getEnvInt("REFRESH_TOKEN_EXPIRY_DAYS", 7),
		},
		Payment: PaymentConfig{
			Provider:       getEnv("PAYMENT_PROVIDER", "mock"),
			RazorpayKeyID:  getEnv("RAZORPAY_KEY_ID", ""),
			RazorpaySecret: getEnv("RAZORPAY_KEY_SECRET", ""),
			WebhookSecret:  getEnv("RAZORPAY_WEBHOOK_SECRET", "mock-webhook-secret"),
		},
		Email: EmailConfig{
			SMTPHost: getEnv("SMTP_HOST", ""),
			SMTPPort: getEnvInt("SMTP_PORT", 587),
			SMTPUser: getEnv("SMTP_USER", ""),
			SMTPPass: getEnv("SMTP_PASS", ""),
			From:     getEnv("EMAIL_FROM", "noreply@abcexam.com"),
		},
		Storage: StorageConfig{
			Provider:  getEnv("STORAGE_PROVIDER", "local"),
			LocalPath: getEnv("STORAGE_LOCAL_PATH", "./storage"),
		},
		CORS: CORSConfig{
			FrontendURL: getEnv("FRONTEND_URL", "http://localhost:3000"),
			AdminURL:    getEnv("ADMIN_URL", "http://localhost:3001"),
			BackendURL:  getEnv("BACKEND_URL", "http://localhost:8081"),
		},
		RateLimit: RateLimitConfig{
			Max:     getEnvInt("RATE_LIMIT_MAX", 200),
			AuthMax: getEnvInt("RATE_LIMIT_AUTH_MAX", 10),
			Window:  getEnvDuration("RATE_LIMIT_WINDOW", 1*time.Minute),
		},
		RequestTimeout: getEnvDuration("REQUEST_TIMEOUT", 30*time.Second),
	}
}

func getEnv(key, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val := os.Getenv(key); val != "" {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}

func getEnvDuration(key string, fallback time.Duration) time.Duration {
	if val := os.Getenv(key); val != "" {
		if d, err := time.ParseDuration(val); err == nil {
			return d
		}
	}
	return fallback
}
