package routes

import (
	"context"
	"time"

	fiberws "github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"

	"github.com/abc-exam/api/internal/admin"
	"github.com/abc-exam/api/internal/auth"
	"github.com/abc-exam/api/internal/config"
	"github.com/abc-exam/api/internal/email"
	"github.com/abc-exam/api/internal/exam"
	"github.com/abc-exam/api/internal/payment"
	"github.com/abc-exam/api/internal/plans"
	"github.com/abc-exam/api/internal/questions"
	"github.com/abc-exam/api/internal/results"
)

func Register(app *fiber.App, db *pgxpool.Pool, rdb *redis.Client, cfg *config.Config) func() {
	ctx, cancel := context.WithCancel(context.Background())

	mailer := email.NewMailer(cfg)

	// Auth
	authSvc := auth.NewService(db, rdb, cfg, mailer)
	authHandler := auth.NewHandler(authSvc, cfg.Auth.RefreshTokenExpiryDays, cfg.Env == "production")

	api := app.Group("/api")
	authGroup := api.Group("/auth")
	authGroup.Use(limiter.New(limiter.Config{
		Max:        cfg.RateLimit.AuthMax,
		Expiration: cfg.RateLimit.Window,
		KeyGenerator: func(c *fiber.Ctx) string {
			return c.IP()
		},
		LimitReached: func(c *fiber.Ctx) error {
			return c.Status(fiber.StatusTooManyRequests).JSON(fiber.Map{
				"success": false,
				"error":   "too many requests",
			})
		},
	}))
	authGroup.Post("/register", authHandler.Register)
	authGroup.Post("/verify-email", authHandler.VerifyEmail)
	authGroup.Post("/resend-otp", authHandler.ResendOTP)
	authGroup.Post("/login", authHandler.Login)
	authGroup.Post("/refresh", authHandler.Refresh)
	authGroup.Post("/logout", authHandler.Logout)
	authGroup.Post("/forgot-password", authHandler.ForgotPassword)
	authGroup.Post("/reset-password", authHandler.ResetPassword)

	authMw := auth.Middleware(cfg.Auth.JWTSecret)

	me := api.Group("/me", authMw)
	me.Get("/", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"success": true,
			"user":    fiber.Map{"id": auth.GetUserID(c), "role": auth.GetRole(c)},
		})
	})

	// Payment provider
	var provider payment.Provider
	if cfg.Payment.Provider == "mock" {
		provider = payment.NewMockProvider(cfg.Payment.WebhookSecret)
	} else {
		provider = payment.NewRazorpayProvider(cfg.Payment.RazorpayKeyID, cfg.Payment.RazorpaySecret, cfg.Payment.WebhookSecret)
	}

	// Plans
	plansSvc := plans.NewService(db, rdb, cfg, provider, mailer)
	plansHandler := plans.NewHandler(plansSvc)

	api.Get("/plans", plansHandler.ListPlans)
	api.Get("/plans/:id", plansHandler.GetPlan)
	api.Get("/study-materials", plansHandler.ListMaterials)
	api.Post("/plans", authMw, auth.RequireRole("admin"), plansHandler.CreatePlan)
	api.Put("/plans/:id", authMw, auth.RequireRole("admin"), plansHandler.UpdatePlan)
	api.Delete("/plans/:id", authMw, auth.RequireRole("admin"), plansHandler.DeletePlan)
	api.Post("/plans/:id/purchase", authMw, plansHandler.InitiatePurchase)
	api.Get("/my/plan", authMw, plansHandler.GetMyPlan)
	api.Post("/verify-payment", authMw, plansHandler.VerifyPayment)
	api.Post("/webhooks/payment", plansHandler.HandleWebhook)

	// Question bank (admin-only write, authenticated read)
	qSvc := questions.NewService(db)
	qHandler := questions.NewHandler(qSvc, db)

	api.Get("/exam-sets", authMw, qHandler.ListExamSets)
	api.Post("/exam-sets", authMw, auth.RequireRole("admin"), qHandler.CreateExamSet)
	api.Get("/exam-sets/:id", authMw, qHandler.GetExamSet)
	api.Put("/exam-sets/:id", authMw, auth.RequireRole("admin"), qHandler.UpdateExamSet)
	api.Delete("/exam-sets/:id", authMw, auth.RequireRole("admin"), qHandler.DeleteExamSet)
	api.Get("/exam-sets/:id/questions", authMw, qHandler.ListQuestionsByExamSet)
	api.Get("/questions", authMw, qHandler.ListQuestions)
	api.Post("/questions", authMw, auth.RequireRole("admin"), qHandler.CreateQuestion)
	api.Get("/questions/:id", authMw, qHandler.GetQuestion)
	api.Put("/questions/:id", authMw, auth.RequireRole("admin"), qHandler.UpdateQuestion)
	api.Delete("/questions/:id", authMw, auth.RequireRole("admin"), qHandler.DeleteQuestion)
	api.Post("/questions/upload", authMw, auth.RequireRole("admin"), qHandler.UploadParse)
	api.Get("/questions/uploads/:id/preview", authMw, auth.RequireRole("admin"), qHandler.PreviewUpload)
	api.Put("/questions/uploads/:id/questions/:idx", authMw, auth.RequireRole("admin"), qHandler.UpdateParsedQuestion)
	api.Post("/questions/uploads/:id/publish", authMw, auth.RequireRole("admin"), qHandler.PublishUpload)

	// Exam engine
	examSvc := exam.NewService(db, rdb)
	examHandler := exam.NewHandler(examSvc)
	examSvc.StartExpiredAttemptPoller(ctx, 30*time.Second)

	api.Get("/exams", authMw, examHandler.ListExams)
	api.Get("/admin/exams", authMw, auth.RequireRole("admin"), examHandler.ListAllExams)
	api.Get("/exams/:id", authMw, examHandler.GetExam)
	api.Post("/exams", authMw, auth.RequireRole("admin"), examHandler.CreateExam)
	api.Put("/exams/:id", authMw, auth.RequireRole("admin"), examHandler.UpdateExam)
	api.Delete("/exams/:id", authMw, auth.RequireRole("admin"), examHandler.DeleteExam)
	api.Post("/exams/:id/publish", authMw, auth.RequireRole("admin"), examHandler.PublishExam)
	api.Post("/exams/:id/start", authMw, examHandler.StartAttempt)
	api.Get("/my/attempts", authMw, examHandler.GetMyAttempts)
	api.Post("/attempts/:attemptId/answers", authMw, examHandler.SaveAnswer)
	api.Post("/attempts/:attemptId/submit", authMw, examHandler.Submit)

	// Results & review
	resultsSvc := results.NewService(db)
	resultsHandler := results.NewHandler(resultsSvc)
	api.Get("/my/results", authMw, resultsHandler.ListMyResults)
	api.Get("/attempts/:attemptId/result", authMw, resultsHandler.GetResult)

	// WebSocket — upgrade middleware injects userID into locals from JWT query param
	app.Use("/ws", func(c *fiber.Ctx) error {
		token := c.Query("token")
		if token == "" {
			return fiber.NewError(fiber.StatusUnauthorized, "token required")
		}
		claims, err := auth.ValidateToken(token, cfg.Auth.JWTSecret)
		if err != nil {
			return fiber.NewError(fiber.StatusUnauthorized, "invalid token")
		}
		c.Locals("userID", claims.UserID)
		if fiberws.IsWebSocketUpgrade(c) {
			return c.Next()
		}
		return fiber.ErrUpgradeRequired
	})
	app.Get("/ws/attempts/:attemptId", fiberws.New(examHandler.ExamWS))

	// Admin API
	adminHandler := admin.NewHandler(db)
	adminGroup := api.Group("/admin", authMw, auth.RequireRole("admin"))
	adminGroup.Get("/stats", adminHandler.GetDashboardStats)
	adminGroup.Get("/users", adminHandler.ListUsers)
	adminGroup.Get("/attempts", adminHandler.ListAttempts)
	adminGroup.Get("/attempts/:attemptId/violations", examHandler.GetViolations)
	adminGroup.Get("/uploads", adminHandler.ListUploads)

	// Mock checkout UI (dev only)
	if cfg.Payment.Provider == "mock" {
		registerMockCheckout(app, db, cfg)
	}

	return cancel
}
