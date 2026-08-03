package blog

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
)

const (
	blogImageDir    = "./storage/blogs"
	blogImageMaxMB  = 5
	blogImageMaxSiz = blogImageMaxMB * 1024 * 1024
)

var allowedBlogImageExt = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".webp": true,
	".gif":  true,
}

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) List(c *fiber.Ctx) error {
	blogs, err := h.svc.List(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": blogs})
}

func (h *Handler) ListPublished(c *fiber.Ctx) error {
	blogs, err := h.svc.ListPublished(c.Context())
	if err != nil {
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": blogs})
}

func (h *Handler) Get(c *fiber.Ctx) error {
	b, err := h.svc.Get(c.Context(), c.Params("id"))
	if err != nil {
		if errors.Is(err, ErrBlogNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": b})
}

func (h *Handler) GetBySlug(c *fiber.Ctx) error {
	slug := strings.TrimSpace(c.Params("slug"))
	if slug == "" {
		return fiber.NewError(fiber.StatusBadRequest, "slug is required")
	}
	b, err := h.svc.GetBySlug(c.Context(), slug)
	if err != nil {
		if errors.Is(err, ErrBlogNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": b})
}

func (h *Handler) Create(c *fiber.Ctx) error {
	var req CreateBlogRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}
	if strings.TrimSpace(req.Title) == "" {
		return fiber.NewError(fiber.StatusBadRequest, "title is required")
	}

	b, err := h.svc.Create(c.Context(), req)
	if err != nil {
		if errors.Is(err, ErrSlugExists) {
			return fiber.NewError(fiber.StatusConflict, err.Error())
		}
		return err
	}
	return c.Status(fiber.StatusCreated).JSON(fiber.Map{"success": true, "data": b})
}

func (h *Handler) Update(c *fiber.Ctx) error {
	var req UpdateBlogRequest
	if err := c.BodyParser(&req); err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "invalid request body")
	}

	b, err := h.svc.Update(c.Context(), c.Params("id"), req)
	if err != nil {
		if errors.Is(err, ErrBlogNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "data": b})
}

// UploadImage handles inline blog image uploads for use in post content.
// It returns a public URL that admins can insert into the content textarea
// as a `![alt](url)` marker.
func (h *Handler) UploadImage(c *fiber.Ctx) error {
	file, err := c.FormFile("file")
	if err != nil {
		return fiber.NewError(fiber.StatusBadRequest, "file is required")
	}

	if file.Size > blogImageMaxSiz {
		return fiber.NewError(fiber.StatusBadRequest, fmt.Sprintf("image must be smaller than %dMB", blogImageMaxMB))
	}

	ext := strings.ToLower(filepath.Ext(file.Filename))
	if !allowedBlogImageExt[ext] {
		return fiber.NewError(fiber.StatusBadRequest, "only .jpg, .jpeg, .png, .webp and .gif images are supported")
	}

	if err := os.MkdirAll(blogImageDir, 0755); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to prepare storage")
	}

	filename := uuid.New().String() + ext
	destPath := filepath.Join(blogImageDir, filename)
	if err := c.SaveFile(file, destPath); err != nil {
		return fiber.NewError(fiber.StatusInternalServerError, "failed to save image")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"url":     "/uploads/blogs/" + filename,
	})
}

func (h *Handler) Delete(c *fiber.Ctx) error {
	if err := h.svc.Delete(c.Context(), c.Params("id")); err != nil {
		if errors.Is(err, ErrBlogNotFound) {
			return fiber.NewError(fiber.StatusNotFound, err.Error())
		}
		return err
	}
	return c.JSON(fiber.Map{"success": true, "message": "blog deleted"})
}
