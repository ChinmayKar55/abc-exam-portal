package main

import (
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/fiber/v2/middleware/limiter"
	"github.com/gofiber/fiber/v2/middleware/recover"
	fiberlogger "github.com/gofiber/fiber/v2/middleware/logger"
	"github.com/rs/zerolog/log"

	"github.com/abc-exam/api/internal/cache"
	"github.com/abc-exam/api/internal/config"
	"github.com/abc-exam/api/internal/db"
	applogger "github.com/abc-exam/api/internal/logger"
	"github.com/abc-exam/api/internal/routes"
)

func main() {
	cfg := config.Load()
	applogger.Init(cfg.Env)

	dbPool, err := db.NewPool(cfg.DB)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to PostgreSQL")
	}
	defer dbPool.Close()

	redisClient, err := cache.NewClient(cfg.Redis.URL, cfg.Redis.Password)
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to connect to Redis")
	}
	defer redisClient.Close()

	app := fiber.New(fiber.Config{
		AppName:      "ABC Exam Portal API",
		ErrorHandler: errorHandler,
		ReadTimeout:  cfg.RequestTimeout,
		WriteTimeout: cfg.RequestTimeout,
		IdleTimeout:  2 * cfg.RequestTimeout,
	})

	app.Use(recover.New())
	app.Use(fiberlogger.New(fiberlogger.Config{
		Format: "[${time}] ${status} - ${method} ${path} (${latency})\n",
	}))

	app.Use(cors.New(cors.Config{
		AllowOrigins:     cfg.CORS.FrontendURL + "," + cfg.CORS.AdminURL,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: true,
	}))

	app.Get("/health", func(c *fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"status":  "ok",
			"service": "abc-exam-portal-api",
			"env":     cfg.Env,
		})
	})

	app.Use(limiter.New(limiter.Config{
		Max:        cfg.RateLimit.Max,
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
		Next: func(c *fiber.Ctx) bool {
			path := c.Path()
			return path == "/health" ||
				strings.HasPrefix(path, "/ws") ||
				path == "/api/webhooks/payment" ||
				strings.HasPrefix(path, "/mock-checkout")
		},
	}))

	cleanup := routes.Register(app, dbPool, redisClient, cfg)

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, os.Interrupt, syscall.SIGTERM)

	go func() {
		log.Info().Str("port", cfg.Port).Msg("Server starting")
		if err := app.Listen(":" + cfg.Port); err != nil {
			log.Fatal().Err(err).Msg("Server failed to start")
		}
	}()

	<-quit
	log.Info().Msg("Shutting down server...")
	cleanup()
	if err := app.Shutdown(); err != nil {
		log.Error().Err(err).Msg("Error during shutdown")
	}
	log.Info().Msg("Server stopped")
}

func errorHandler(c *fiber.Ctx, err error) error {
	code := fiber.StatusInternalServerError
	message := "Internal Server Error"

	if e, ok := err.(*fiber.Error); ok {
		code = e.Code
		message = e.Message
	}

	if code >= 500 {
		log.Error().Err(err).Str("path", c.Path()).Str("method", c.Method()).Msg("Internal server error")
	}

	return c.Status(code).JSON(fiber.Map{
		"error":   message,
		"success": false,
	})
}
