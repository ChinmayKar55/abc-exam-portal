package routes

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/abc-exam/api/internal/config"
)

func registerMockCheckout(app *fiber.App, db *pgxpool.Pool, cfg *config.Config) {
	app.Get("/mock-checkout", func(c *fiber.Ctx) error {
		orderID := c.Query("order_id")
		planID := c.Query("plan_id")

		html := fmt.Sprintf(`<!DOCTYPE html>
<html>
<head>
  <title>Mock Payment Gateway</title>
  <style>
    body { font-family: system-ui, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f3f4f6; }
    .card { background: white; border-radius: 12px; padding: 40px; max-width: 420px; width: 100%%; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    h2 { margin-top: 0; color: #111; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 12px; font-weight: 600; background: #fef3c7; color: #92400e; margin-bottom: 20px; }
    .info { background: #f9fafb; border-radius: 8px; padding: 16px; margin-bottom: 24px; font-size: 14px; color: #374151; }
    .info div { margin-bottom: 6px; }
    .info span { font-weight: 600; color: #111; }
    button { width: 100%%; padding: 14px; border: none; border-radius: 8px; font-size: 16px; font-weight: 600; cursor: pointer; margin-bottom: 12px; transition: opacity 0.2s; }
    button:hover { opacity: 0.9; }
    .btn-success { background: #10b981; color: white; }
    .btn-fail    { background: #ef4444; color: white; }
    .btn-timeout { background: #6b7280; color: white; }
    #status { margin-top: 16px; padding: 12px; border-radius: 8px; display: none; font-size: 14px; }
    .status-ok  { background: #d1fae5; color: #065f46; }
    .status-err { background: #fee2e2; color: #991b1b; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">🧪 DEV — Mock Payment Gateway</div>
    <h2>Complete Payment</h2>
    <div class="info">
      <div>Order ID: <span>%s</span></div>
      <div>Plan ID: <span>%s</span></div>
      <div>Environment: <span>Development</span></div>
    </div>
    <button class="btn-success" onclick="pay('success')">✅ Simulate Success</button>
    <button class="btn-fail"    onclick="pay('failure')">❌ Simulate Failure</button>
    <button class="btn-timeout" onclick="pay('timeout')">⏱ Simulate Timeout</button>
    <div id="status"></div>
  </div>
  <script>
    async function pay(outcome) {
      const statusEl = document.getElementById('status');
      statusEl.style.display = 'none';
      if (outcome === 'timeout') {
        statusEl.className = 'status-err'; statusEl.style.display = 'block';
        statusEl.textContent = 'Payment timed out. Please try again.'; return;
      }
      try {
        const res = await fetch('/mock-checkout/confirm', {
          method: 'POST',
          headers: {'Content-Type':'application/json'},
          body: JSON.stringify({order_id:'%s', plan_id:'%s', outcome})
        });
        const data = await res.json();
        statusEl.style.display = 'block';
        if (data.success) {
          statusEl.className = 'status-ok';
          statusEl.textContent = '✅ Payment successful! Redirecting...';
          setTimeout(() => window.location.href = '%s/plans?payment=success', 2000);
        } else {
          statusEl.className = 'status-err';
          statusEl.textContent = '❌ Payment failed: ' + (data.error || 'Unknown error');
        }
      } catch(e) {
        statusEl.className = 'status-err'; statusEl.style.display = 'block';
        statusEl.textContent = 'Network error: ' + e.message;
      }
    }
  </script>
</body>
</html>`, orderID, planID, orderID, planID, cfg.CORS.FrontendURL)

		c.Set("Content-Type", "text/html")
		return c.SendString(html)
	})

	app.Post("/mock-checkout/confirm", func(c *fiber.Ctx) error {
		var req struct {
			OrderID string `json:"order_id"`
			PlanID  string `json:"plan_id"`
			Outcome string `json:"outcome"`
		}
		if err := c.BodyParser(&req); err != nil {
			return fiber.NewError(fiber.StatusBadRequest, "invalid body")
		}

		event := "payment.captured"
		if req.Outcome == "failure" {
			event = "payment.failed"
		}

		paymentID := "mock_pay_" + uuid.New().String()[:8]
		var amount int
		_ = db.QueryRow(c.Context(),
			`SELECT amount_paise FROM payments WHERE razorpay_order_id = $1`, req.OrderID,
		).Scan(&amount)

		payload, _ := json.Marshal(map[string]interface{}{
			"event": event,
			"order": map[string]string{"id": req.OrderID},
			"payment": map[string]interface{}{
				"id":         paymentID,
				"amount":     amount,
				"created_at": time.Now().Unix(),
			},
		})

		mac := hmac.New(sha256.New, []byte(cfg.Payment.WebhookSecret))
		mac.Write(payload)
		sig := hex.EncodeToString(mac.Sum(nil))

		webhookURL := fmt.Sprintf("http://localhost:%s/api/webhooks/payment", cfg.Port)
		httpReq, _ := http.NewRequest("POST", webhookURL, bytes.NewReader(payload))
		httpReq.Header.Set("Content-Type", "application/json")
		httpReq.Header.Set("X-Mock-Signature", sig)

		resp, err := http.DefaultClient.Do(httpReq)
		if err != nil {
			return fiber.NewError(fiber.StatusInternalServerError, "webhook dispatch failed")
		}
		defer resp.Body.Close()

		if resp.StatusCode != http.StatusOK {
			return fiber.NewError(fiber.StatusInternalServerError, "webhook handler error")
		}

		return c.JSON(fiber.Map{
			"success":    req.Outcome == "success",
			"payment_id": paymentID,
			"event":      event,
		})
	})
}
