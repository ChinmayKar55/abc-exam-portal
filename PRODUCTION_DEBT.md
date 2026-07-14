# Production Debt — OSSSC Online Exam Portal

**Target traffic profile:** 300–700 concurrent exam-takers normally, peak bursts up to 1000 concurrent users.

**Goal:** Make the application deployable, resilient, observable, and performant enough to handle the peak load without data corruption or downtime.

---

## Severity Legend

- **P0 (Critical)** — Blocks production deployment; data loss or corruption risk.
- **P1 (High)** — Will cause incidents under load; must be fixed before going live.
- **P2 (Medium)** — Operational pain / performance degradation; fix soon after launch.
- **P3 (Low)** — Nice-to-have improvements.

---

## 1. Deployment & Build Pipeline (P0)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 1.1 | Containerization | No Dockerfile exists. | Create multi-stage `Dockerfile` for `services/api/cmd/server`. |
| 1.2 | Frontend containers | `apps/student` and `apps/admin` only run via `next dev`. | Add Dockerfiles that run `next build && next start`. |
| 1.3 | Compose / orchestration | No deployment manifests. | Add `docker-compose.prod.yml` with API replicas, Postgres, Redis, nginx. |
| 1.4 | CI/CD | No automated build/deploy pipeline. | Add GitHub Actions workflow to build images and deploy. |
| 1.5 | Environment separation | `.env.example` only; no env validation. | Add strict env validation and secrets management (do not commit `.env` to Git). |

**Reference files:**
- `services/api/cmd/server/main.go`
- `apps/student/package.json`
- `apps/admin/package.json`

---

## 2. Backend Scalability & Concurrency (P0 / P1)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 2.1 | WebSocket auto-submit timers | Timers live only in process memory; lost on restart. | Add a background Redis poller that auto-submits expired attempts every 30s. |
| 2.2 | Race condition in `SaveAnswer` | Read-modify-write JSON state; concurrent saves can overwrite each other. | Use Redis Lua script or optimistic locking to update answers atomically. |
| 2.3 | Double-submit / double-grade | `grade()` checks status then updates non-atomically. | Wrap in transaction: `UPDATE ... WHERE status='in_progress'` and verify `RowsAffected`. |
| 2.4 | Rate limiting | No rate limits on any endpoint. | Add per-IP and per-user rate limiting for login, start-exam, save-answer. |
| 2.5 | Request timeouts | No global request timeout or body-size limit. | Add Fiber `timeout` and `bodylimit` middleware. |
| 2.6 | Horizontal scaling of WebSockets | WS connections must stick to the same backend. | Configure nginx/ALB sticky sessions (`ip_hash` or cookie-based). |
| 2.7 | Graceful shutdown | Server exits on signal but does not drain active WS. | Increase shutdown grace period and close WS connections cleanly. |

**Reference files:**
- `services/api/internal/exam/service.go` (`SaveAnswer`, `grade`, `AutoSubmit`)
- `services/api/internal/exam/handler.go` (`ExamWS`)
- `services/api/cmd/server/main.go`

---

## 3. Database Layer (P0 / P1)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 3.1 | DB connection pool | Hard-coded `MaxConns=50`, `MinConns=5`. | Make env-driven (`DB_MAX_CONNS`, `DB_MIN_CONNS`) and set max lifetime/idle time. |
| 3.2 | Missing indexes | No composite indexes on hot paths. | Add indexes listed below. |
| 3.3 | Managed database | None currently configured. | Use managed PostgreSQL (AWS RDS, Supabase, Neon, Railway Postgres) with daily backups. |
| 3.4 | Connection proxy | Multiple API replicas can exhaust Postgres connection limit. | Use PgBouncer/Supabase connection pooler if `total_conns × replicas > 100`. |
| 3.5 | Status transitions | No DB-level guard against `graded` → `in_progress`. | Add constraint/trigger or enforce state machine strictly in code. |

**Required indexes migration:**

```sql
CREATE INDEX CONCURRENTLY idx_attempts_user_exam_status
  ON exam_attempts(user_id, exam_id, status);

CREATE INDEX CONCURRENTLY idx_attempts_in_progress
  ON exam_attempts(user_id, exam_id) WHERE status = 'in_progress';

CREATE INDEX CONCURRENTLY idx_attempts_user_status_submitted
  ON exam_attempts(user_id, status, submitted_at DESC);

CREATE INDEX CONCURRENTLY idx_exam_events_attempt_id
  ON exam_events(attempt_id, occurred_at DESC);

CREATE INDEX CONCURRENTLY idx_exam_events_attempt_type
  ON exam_events(attempt_id, event_type);

CREATE INDEX CONCURRENTLY idx_user_plans_user_active
  ON user_plans(user_id) WHERE active = true;

CREATE INDEX CONCURRENTLY idx_plan_exams_plan_exam
  ON plan_exams(plan_id, exam_id);
```

**Reference files:**
- `services/api/internal/db/db.go`
- `services/api/migrations/`

---

## 4. Redis Layer (P1)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 4.1 | Single point of failure | Single Redis instance, no persistence configured. | Enable AOF persistence or use managed Redis (ElastiCache, Upstash, Redis Cloud). |
| 4.2 | Connection pool | Default pool settings. | Tune `PoolSize`, `MinIdleConns`, `MaxRetries` from environment. |
| 4.3 | Memory monitoring | No memory alerts. | Set Redis memory policy and CloudWatch/Datadog alerts. |
| 4.4 | HA | No Sentinel/Cluster. | For production resilience, add Redis Sentinel or managed HA. |

**Reference files:**
- `services/api/internal/cache/redis.go`

---

## 5. Frontend Productionization (P1)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 5.1 | Build mode | Only `next dev` scripts. | Use `next build && next start` in production containers. |
| 5.2 | Static export | Server-side middleware requires server mode. | Keep server mode; do **not** use `output: 'export'`. |
| 5.3 | Image optimization | No image domain config. | Add `images.domains` / `images.remotePatterns` in both `next.config.ts`. |
| 5.4 | Public env vars | Client bundle depends on build-time envs. | Ensure CI injects `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_WS_URL`. |
| 5.5 | Bundle size | `face-api` may load on non-exam pages. | Lazy-load face-api only inside the exam proctoring component. |
| 5.6 | Error handling | No global error boundary in exam flow. | Add React Error Boundary on exam layout with safe fallback UI. |

**Reference files:**
- `apps/student/next.config.ts`
- `apps/admin/next.config.ts`
- `apps/student/package.json`

---

## 6. Security (P0 / P1)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 6.1 | Access token storage | Stored in `localStorage` via Zustand. | Move access token to short-lived HttpOnly cookie, or accept XSS risk and keep 15-min expiry. |
| 6.2 | Refresh cookie | `SameSite=Lax`. | Change to `SameSite=Strict` in production. |
| 6.3 | CORS | Configured per env. | Ensure `AllowOrigins` is never `*` and only lists exact domains. |
| 6.4 | Rate limiting | None. | Add middleware for login/registration brute-force protection. |
| 6.5 | Input validation | Minimal validation in admin handlers. | Add strict struct validation (e.g., `go-playground/validator`) on all write endpoints. |
| 6.6 | Proctoring events | Client-generated events are trusted. | Add server-side anomaly detection, rate limits, and signed payloads. |
| 6.7 | SQL injection | Uses parameterized queries — good. | Keep parameterized queries; audit raw SQL in migrations. |

**Reference files:**
- `services/api/internal/auth/handler.go` (`setRefreshCookie`)
- `services/api/cmd/server/main.go` (CORS)
- `apps/student/lib/api.ts`
- `apps/student/store/auth.ts`

---

## 7. Observability & Reliability (P1)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 7.1 | Metrics | No Prometheus / APM. | Expose `/metrics` with Fiber monitor; track WS count, answer latency, DB pool stats. |
| 7.2 | Health checks | Basic `/health` only. | Add `/ready` that checks DB + Redis. |
| 7.3 | Logging | Zerolog structured logs. | Ship JSON logs to Datadog / Grafana Cloud / AWS CloudWatch. |
| 7.4 | Alerting | None. | Add alerts for 5xx rate, DB pool saturation, Redis down, WS disconnect spikes. |
| 7.5 | Tracing | No distributed tracing. | Add OpenTelemetry instrumentation for API and DB calls. |
| 7.6 | Backups | None configured. | Automated daily DB backups + point-in-time recovery. |

**Reference files:**
- `services/api/cmd/server/main.go`
- `services/api/internal/logger/logger.go`

---

## 8. External Integrations (P1 / P2)

| # | Item | Current State | Required Change |
|---|---|---|---|
| 8.1 | Email | Mailtrap/SMTP defaults. | Switch to AWS SES / SendGrid / Postmark; configure DKIM/SPF/DMARC; queue retries. |
| 8.2 | Payments | Mock provider available. | Use Razorpay live keys; verify webhook signatures; add idempotency keys. |
| 8.3 | File storage | Local disk storage only. | Migrate to S3-compatible object storage (AWS S3 / Cloudflare R2 / MinIO). |
| 8.4 | CDN | No CDN for static assets. | Serve images/CSS/JS from CloudFront / Cloudflare CDN. |

**Reference files:**
- `services/api/internal/config/config.go`
- `services/api/internal/payment/`
- `services/api/internal/email/`

---

## 9. Recommended Production Architecture

```
┌─────────────────┐
│   Cloudflare    │  DNS + CDN + DDoS protection
└────────┬────────┘
         │
┌────────▼────────┐
│   nginx / ALB   │  SSL termination, rate limiting, WS sticky sessions
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐  ┌──▼────┐
│ API-1 │  │ API-2 │  2–4 Go containers, horizontally scalable
│:8080  │  │ :8080 │
└───┬───┘  └──┬────┘
    │         │
    └────┬────┘
         │
┌────────▼────────┐     ┌─────────────┐
│  PostgreSQL     │     │    Redis    │  Managed services preferred
│  (managed)      │     │  (managed)  │
└─────────────────┘     └─────────────┘
```

**Suggested cloud providers:**
- **Budget-friendly:** Railway, Render, Fly.io, Hetzner Cloud + managed DB
- **Enterprise / full control:** AWS ECS Fargate + RDS PostgreSQL + ElastiCache + ALB + CloudFront

---

## 10. Implementation Roadmap

### Phase 1 — Blockers (do before any production deploy)
1. Dockerize API + student + admin apps.
2. Add DB indexes (migration).
3. Fix `SaveAnswer` race condition and `grade()` atomicity.
4. Add background expired-attempt poller.
5. Add rate limiting and request timeouts.
6. Move refresh token `SameSite` to `Strict`.

### Phase 2 — Production Hardening
7. Use managed PostgreSQL and managed Redis.
8. Configure nginx/ALB with sticky sessions and SSL.
9. Add `/ready` health checks and `/metrics`.
10. Set up log shipping and alerting.
11. Add CI/CD pipeline.

### Phase 3 — Scale & Polish
12. Move file storage to S3.
13. Switch to production email and payment providers.
14. Add CDN.
15. Add application performance monitoring (APM) / distributed tracing.

---

## Summary

| Category | P0 Items | P1 Items | P2 Items |
|---|---:|---:|---:|
| Deployment | 5 | 1 | 1 |
| Backend concurrency | 3 | 3 | 1 |
| Database | 2 | 3 | 1 |
| Redis | 0 | 3 | 1 |
| Frontend | 0 | 5 | 1 |
| Security | 2 | 3 | 2 |
| Observability | 0 | 4 | 2 |
| Integrations | 0 | 2 | 2 |

**Bottom line:** The application is architecturally capable of handling 1000 concurrent exam-takers, but it is **not yet production-deployable** due to missing containers, concurrency bugs, and lack of rate limiting/observability. Fixing the P0 and P1 items above will make it resilient enough for the target load.
