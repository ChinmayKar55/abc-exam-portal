package blog

import "time"

// Blog is a content post managed by admins and readable by the public.
type Blog struct {
	ID        string    `json:"id"`
	Title     string    `json:"title"`
	Subtitle  string    `json:"subtitle"`
	Slug      string    `json:"slug"`
	Content   string    `json:"content"`
	Published bool      `json:"published"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// CreateBlogRequest is the admin payload for creating a blog post.
type CreateBlogRequest struct {
	Title     string `json:"title"`
	Subtitle  string `json:"subtitle"`
	Content   string `json:"content"`
	Published bool   `json:"published"`
}

// UpdateBlogRequest is the admin payload for updating a blog post.
type UpdateBlogRequest struct {
	Title     string `json:"title,omitempty"`
	Subtitle  string `json:"subtitle,omitempty"`
	Content   string `json:"content,omitempty"`
	Published *bool  `json:"published,omitempty"`
}
