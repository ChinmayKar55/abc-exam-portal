package exam

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/gofiber/contrib/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/rs/zerolog/log"

	"github.com/abc-exam/api/internal/auth"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) ListExams(c *fiber.Ctx) error {
	exams, err := h.svc.ListExams(c.Context(), c.Query("exam_type"))
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": exams})
}

func (h *Handler) GetExam(c *fiber.Ctx) error {
	e, err := h.svc.GetExam(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, ErrExamNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": e})
}

func (h *Handler) ListAllExams(c *fiber.Ctx) error {
	exams, err := h.svc.ListAllExams(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": exams})
}

func (h *Handler) CreateExam(c *fiber.Ctx) error {
	var req CreateExamRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if req.Title == "" || req.DurationMinutes == 0 || len(req.Sources) == 0 {
		return fiber.NewError(fiber.StatusBadRequest, "title, duration_minutes and at least one source bank are required")
	}
	e, err := h.svc.CreateExam(c.Context(), req)
	if err != nil {
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": e})
}

func (h *Handler) UpdateExam(c *fiber.Ctx) error {
	var req UpdateExamRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if req.Title == "" {
		return fiber.NewError(fiber.StatusBadRequest, "title is required")
	}
	e, err := h.svc.UpdateExam(c.Context(), c.Params("id"), req)
	if err != nil {
		if errors.Is(err, ErrExamNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": e})
}

func (h *Handler) DeleteExam(c *fiber.Ctx) error {
	if err := h.svc.DeleteExam(c.Context(), c.Params("id")); err != nil {
		if errors.Is(err, ErrExamNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "exam deleted"})
}

func (h *Handler) PublishExam(c *fiber.Ctx) error {
	if err := h.svc.PublishExam(c.Context(), c.Params("id")); err != nil {
		if errors.Is(err, ErrExamNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "exam published"})
}

func (h *Handler) StartAttempt(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	resp, err := h.svc.StartAttempt(c.Context(), userID, c.Params("id"))
	if err != nil {
		switch {
		case errors.Is(err, ErrExamNotFound):
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		case errors.Is(err, ErrNoPlanAccess):
			return fiber.NewError(fiber.StatusForbidden, err.Error())
		case errors.Is(err, ErrAttemptExpired):
			return fiber.NewError(fiber.StatusGone, err.Error())
		}
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": resp})
}

func (h *Handler) SaveAnswer(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	attemptID := c.Params("attemptId")
	var req SaveAnswerRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if err := h.svc.SaveAnswer(c.Context(), attemptID, userID, req.QuestionID, req.Answer); err != nil {
		if errors.Is(err, ErrAttemptNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		if errors.Is(err, ErrAttemptExpired) {
			return fiber.NewError(fiber.StatusGone, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true})
}

func (h *Handler) Submit(c *fiber.Ctx) error {
	userID := auth.GetUserID(c)
	attempt, err := h.svc.Submit(c.Context(), c.Params("attemptId"), userID)
	if err != nil {
		if errors.Is(err, ErrAttemptNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": attempt})
}

func (h *Handler) GetMyAttempts(c *fiber.Ctx) error {
	attempts, err := h.svc.GetMyAttempts(c.Context(), auth.GetUserID(c))
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": attempts})
}

// ExamWS handles the WebSocket connection for real-time answer auto-save.
// Protocol:
//   Client → {"type":"save_answer","payload":{"question_id":"...","answer":"A"}}
//   Client → {"type":"submit"}
//   Client → {"type":"ping"}
//   Server → {"type":"pong"}
//   Server → {"type":"time_warning","payload":{"seconds_left":60}}
//   Server → {"type":"auto_submitted","payload":{...attempt...}}
//   Server → {"type":"error","payload":{"message":"..."}}
func (h *Handler) ExamWS(c *websocket.Conn) {
	attemptID := c.Params("attemptId")
	userID := c.Locals("userID").(string)

	// Load initial state to set up the timer
	state, err := h.svc.loadState(context.Background(), attemptID)
	if err != nil {
		sendWSError(c, "attempt not found or already submitted")
		return
	}
	if state.UserID != userID {
		sendWSError(c, "unauthorized")
		return
	}

	// Timer that fires 60s before expiry for warning, then auto-submits
	remaining := time.Until(state.ExpiresAt)
	warnAt := remaining - 60*time.Second
	warnTimer := time.NewTimer(maxDuration(warnAt, 0))
	expireTimer := time.NewTimer(maxDuration(remaining, 0))
	defer warnTimer.Stop()
	defer expireTimer.Stop()

	msgCh := make(chan WSMessage, 16)
	errCh := make(chan error, 1)

	// Reader goroutine
	go func() {
		for {
			var msg WSMessage
			if err := c.ReadJSON(&msg); err != nil {
				errCh <- err
				return
			}
			msgCh <- msg
		}
	}()

	for {
		select {
		case <-warnTimer.C:
			secondsLeft := int(time.Until(state.ExpiresAt).Seconds())
			payload, _ := json.Marshal(map[string]int{"seconds_left": secondsLeft})
			c.WriteJSON(WSMessage{Type: "time_warning", Payload: payload})

		case <-expireTimer.C:
			attempt, err := h.svc.Submit(context.Background(), attemptID, userID)
			if err != nil {
				sendWSError(c, "auto-submit failed")
				return
			}
			payload, _ := json.Marshal(attempt)
			c.WriteJSON(WSMessage{Type: "auto_submitted", Payload: payload})
			return

		case msg := <-msgCh:
			switch msg.Type {
			case "ping":
				c.WriteJSON(WSMessage{Type: "pong"})

			case "save_answer":
				var req SaveAnswerRequest
				if err := json.Unmarshal(msg.Payload, &req); err != nil {
					sendWSError(c, "invalid save_answer payload")
					continue
				}
				if err := h.svc.SaveAnswer(context.Background(), attemptID, userID, req.QuestionID, req.Answer); err != nil {
					if errors.Is(err, ErrAttemptExpired) {
						sendWSError(c, "exam expired")
						return
					}
					sendWSError(c, err.Error())
					continue
				}
				c.WriteJSON(WSMessage{Type: "answer_saved"})

			case "submit":
				attempt, err := h.svc.Submit(context.Background(), attemptID, userID)
				if err != nil {
					sendWSError(c, err.Error())
					return
				}
				payload, _ := json.Marshal(attempt)
				c.WriteJSON(WSMessage{Type: "submitted", Payload: payload})
				return

			case "proctoring_event":
				var evt ProctoringEvent
				if err := json.Unmarshal(msg.Payload, &evt); err != nil {
					log.Debug().Err(err).Msg("invalid proctoring_event payload")
					continue
				}
				// Fire-and-forget; don't block the exam on a logging error
				go func(e ProctoringEvent) {
					if err := h.svc.LogProctoringEvent(context.Background(), attemptID, userID, e); err != nil {
						log.Warn().Err(err).Str("attempt_id", attemptID).Str("event", e.Type).Msg("proctoring log failed")
					}
				}(evt)

			default:
				log.Debug().Str("type", msg.Type).Msg("Unknown WS message type")
			}

		case err := <-errCh:
			if websocket.IsUnexpectedCloseError(err) {
				log.Debug().Str("attempt_id", attemptID).Msg("WS client disconnected")
			}
			return
		}
	}
}

// GetViolations returns proctoring events for an attempt (admin only).
func (h *Handler) GetViolations(c *fiber.Ctx) error {
	vs, err := h.svc.GetViolations(c.Context(), c.Params("attemptId"))
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": vs})
}

func sendWSError(c *websocket.Conn, msg string) {
	payload, _ := json.Marshal(map[string]string{"message": msg})
	_ = c.WriteJSON(WSMessage{Type: "error", Payload: payload})
}

func maxDuration(a, b time.Duration) time.Duration {
	if a > b {
		return a
	}
	return b
}
