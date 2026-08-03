package blog

import (
	"context"
	"errors"
	"regexp"
	"strings"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

var (
	ErrBlogNotFound = errors.New("blog not found")
	ErrSlugExists   = errors.New("a blog with this title already exists")
)

type Service struct {
	db *pgxpool.Pool
}

func NewService(db *pgxpool.Pool) *Service {
	return &Service{db: db}
}

var slugRe = regexp.MustCompile(`[^a-z0-9]+`)

func slugify(title string) string {
	s := strings.ToLower(strings.TrimSpace(title))
	s = slugRe.ReplaceAllString(s, "-")
	s = strings.Trim(s, "-")
	return s
}

func (s *Service) generateSlug(ctx context.Context, title string) (string, error) {
	base := slugify(title)
	if base == "" {
		base = "blog-post"
	}

	var slug string
	for i := 0; i < 20; i++ {
		if i == 0 {
			slug = base
		} else {
			slug = base + "-" + uuid.New().String()[:8]
		}

		var exists bool
		err := s.db.QueryRow(ctx, `SELECT EXISTS(SELECT 1 FROM blogs WHERE slug = $1)`, slug).Scan(&exists)
		if err != nil {
			return "", err
		}
		if !exists {
			return slug, nil
		}
	}
	return "", ErrSlugExists
}

// Create creates a new blog post.
func (s *Service) Create(ctx context.Context, req CreateBlogRequest) (*Blog, error) {
	if strings.TrimSpace(req.Title) == "" {
		return nil, errors.New("title is required")
	}

	slug, err := s.generateSlug(ctx, req.Title)
	if err != nil {
		return nil, err
	}

	var b Blog
	err = s.db.QueryRow(ctx,
		`INSERT INTO blogs (title, subtitle, slug, content, published)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, title, subtitle, slug, content, published, created_at, updated_at`,
		req.Title, req.Subtitle, slug, req.Content, req.Published,
	).Scan(&b.ID, &b.Title, &b.Subtitle, &b.Slug, &b.Content, &b.Published, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// List returns all blog posts for the admin dashboard.
func (s *Service) List(ctx context.Context) ([]Blog, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, title, subtitle, slug, content, published, created_at, updated_at
		 FROM blogs ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blogs []Blog
	for rows.Next() {
		var b Blog
		if err := rows.Scan(&b.ID, &b.Title, &b.Subtitle, &b.Slug, &b.Content, &b.Published, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		blogs = append(blogs, b)
	}
	return blogs, nil
}

// ListPublished returns only published blog posts for public readers.
func (s *Service) ListPublished(ctx context.Context) ([]Blog, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, title, subtitle, slug, content, published, created_at, updated_at
		 FROM blogs WHERE published = true ORDER BY created_at DESC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var blogs []Blog
	for rows.Next() {
		var b Blog
		if err := rows.Scan(&b.ID, &b.Title, &b.Subtitle, &b.Slug, &b.Content, &b.Published, &b.CreatedAt, &b.UpdatedAt); err != nil {
			return nil, err
		}
		blogs = append(blogs, b)
	}
	return blogs, nil
}

// Get returns a blog post by id (admin lookup).
func (s *Service) Get(ctx context.Context, id string) (*Blog, error) {
	var b Blog
	err := s.db.QueryRow(ctx,
		`SELECT id, title, subtitle, slug, content, published, created_at, updated_at
		 FROM blogs WHERE id = $1`, id,
	).Scan(&b.ID, &b.Title, &b.Subtitle, &b.Slug, &b.Content, &b.Published, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBlogNotFound
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// GetBySlug returns a published blog post by its slug.
func (s *Service) GetBySlug(ctx context.Context, slug string) (*Blog, error) {
	var b Blog
	err := s.db.QueryRow(ctx,
		`SELECT id, title, subtitle, slug, content, published, created_at, updated_at
		 FROM blogs WHERE slug = $1 AND published = true`, slug,
	).Scan(&b.ID, &b.Title, &b.Subtitle, &b.Slug, &b.Content, &b.Published, &b.CreatedAt, &b.UpdatedAt)
	if errors.Is(err, pgx.ErrNoRows) {
		return nil, ErrBlogNotFound
	}
	if err != nil {
		return nil, err
	}
	return &b, nil
}

// Update modifies an existing blog post.
func (s *Service) Update(ctx context.Context, id string, req UpdateBlogRequest) (*Blog, error) {
	b, err := s.Get(ctx, id)
	if err != nil {
		return nil, err
	}

	if strings.TrimSpace(req.Title) != "" {
		b.Title = strings.TrimSpace(req.Title)
	}
	if req.Subtitle != "" {
		b.Subtitle = req.Subtitle
	}
	if req.Content != "" {
		b.Content = req.Content
	}
	if req.Published != nil {
		b.Published = *req.Published
	}

	err = s.db.QueryRow(ctx,
		`UPDATE blogs
		 SET title = $1, subtitle = $2, content = $3, published = $4, updated_at = NOW()
		 WHERE id = $5
		 RETURNING id, title, subtitle, slug, content, published, created_at, updated_at`,
		b.Title, b.Subtitle, b.Content, b.Published, id,
	).Scan(&b.ID, &b.Title, &b.Subtitle, &b.Slug, &b.Content, &b.Published, &b.CreatedAt, &b.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return b, nil
}

// Delete removes a blog post.
func (s *Service) Delete(ctx context.Context, id string) error {
	res, err := s.db.Exec(ctx, `DELETE FROM blogs WHERE id = $1`, id)
	if err != nil {
		return err
	}
	if res.RowsAffected() == 0 {
		return ErrBlogNotFound
	}
	return nil
}
