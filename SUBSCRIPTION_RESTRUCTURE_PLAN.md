# Subscription Tier Restructure — Free / Pro / Max

Restructure the existing single-purchase package system into a three-tier subscription model (Free, Pro ₹199/week, Max ₹399/3 months) with plan expiry, upgrade support, and differentiated UI per tier.

---

## 1. Business Rules (Confirmed)

| Rule | Decision |
|---|---|
| **Renewal** | Manual re-subscribe — no auto-renewal. Plans just expire. |
| **Upgrade** | Pro → Max allowed mid-cycle (pay full ₹399, remaining Pro days ignored). |
| **Exam visibility** | All users see all exams. Locked exams show lock icon + "Upgrade to Pro/Max" or "Buy package". |
| **Packages tab** | Hidden for Max users. Visible for Free & Pro users; exams already covered by active plan show "Included in your plan" (not purchasable). |
| **Tiers** | **Free** = default (no subscription); **Pro** = ₹199/7 days; **Max** = ₹399/90 days. |
| **Exam attachment (admin)** | Each exam can be attached to packages (existing system for free-tier purchase), AND/OR to subscription tiers (Pro, Max, or both). |

---

## 2. Current vs. Target Architecture

### Current
- `plans` table holds purchasable "packages" (one-time buy, no expiry logic)
- `plan_exams` / `plan_materials` link packages ↔ exams/materials
- `user_plans` tracks purchased packages (`expires_at` column exists but is unused)
- Access check: `user_plans.active = true AND plan_exams contains exam_id`
- All exams go through packages — no "free exams" concept
- No concept of subscription tiers, upgrade, or expiry

### Target
- Two separate concepts: **Subscription Tiers** (Pro/Max — time-limited) and **Packages** (one-time purchase bundles — as today, for free-tier users)
- Free-tier users access: free exams + purchased packages
- Pro users access: free exams + Pro-tier exams + purchased packages
- Max users access: free exams + Pro-tier exams + Max-tier exams (no packages tab)
- Exams have a new `access_tier` field: `free`, `pro`, `max`
- Packages remain for one-time bundle sales to Free/Pro users
- `user_subscriptions` table tracks active subscriptions with real expiry

---

## 3. Database Changes (Migration 019)

### 3a. New `user_subscriptions` table
```sql
CREATE TYPE subscription_tier AS ENUM ('pro', 'max');

CREATE TABLE user_subscriptions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  tier          subscription_tier NOT NULL,
  payment_id    UUID REFERENCES payments(id),
  activated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true,
  upgraded_from UUID REFERENCES user_subscriptions(id),  -- links to the Pro sub that was replaced
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_user_subs_user ON user_subscriptions(user_id) WHERE active = true;
CREATE INDEX idx_user_subs_expiry ON user_subscriptions(expires_at) WHERE active = true;
```

### 3b. Add `access_tier` to `exams`
```sql
ALTER TABLE exams ADD COLUMN access_tier TEXT NOT NULL DEFAULT 'free'
  CHECK (access_tier IN ('free', 'pro', 'max'));
CREATE INDEX idx_exams_access_tier ON exams(access_tier);
```

### 3c. Seed subscription plan definitions
```sql
-- These are system-level tier definitions, not the packages table
CREATE TABLE subscription_plans (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier          subscription_tier NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_paise   INT NOT NULL,
  duration_days INT NOT NULL,
  active        BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO subscription_plans (tier, name, description, price_paise, duration_days) VALUES
  ('pro', 'Pro Plan', 'Access all Pro exams for 7 days', 19900, 7),
  ('max', 'Max Plan', 'Access all Pro + Max exams for 3 months', 39900, 90);
```

### 3d. Existing tables — no breaking changes
- `plans` (packages) table stays as-is for one-time bundles
- `plan_exams` / `plan_materials` stay as-is
- `user_plans` stays as-is for package ownership

---

## 4. Backend Changes

### 4a. New package: `internal/subscription`

| Component | Responsibility |
|---|---|
| `model.go` | `SubscriptionPlan`, `UserSubscription`, request/response types |
| `service.go` | `ListTiers`, `GetMySubscription`, `Subscribe`, `Upgrade`, `ExpireStale` |
| `handler.go` | HTTP handlers for subscription endpoints |

**Key logic:**

- **Subscribe(userID, tier)** → creates Razorpay order, records payment, on capture → inserts `user_subscriptions` with `expires_at = NOW() + duration_days`
- **Upgrade(userID)** → only Pro→Max. Deactivates current Pro sub (`active=false`), creates new Max sub with `upgraded_from` pointing to old Pro. Full ₹399 charge.
- **ExpireStale()** → background poller (runs every 60s): `UPDATE user_subscriptions SET active = false WHERE expires_at < NOW() AND active = true`
- **GetMySubscription(userID)** → returns active subscription or null (free tier)

### 4b. Modify `internal/exam` — access check

Current `StartAttempt` checks:
```go
SELECT EXISTS(
  SELECT 1 FROM user_plans up
  JOIN plan_exams pe ON pe.plan_id = up.plan_id
  WHERE up.user_id=$1 AND up.active=true AND pe.exam_id=$2
)
```

New access logic:
```
1. If exam.access_tier = 'free' → always allowed
2. If exam.access_tier = 'pro' → user must have active Pro OR Max subscription
3. If exam.access_tier = 'max' → user must have active Max subscription
4. ALSO check: user_plans + plan_exams (package ownership still grants access)
```

```go
-- Single query to check all access paths
SELECT EXISTS(
  SELECT 1 FROM exams e WHERE e.id = $2 AND (
    e.access_tier = 'free'
    OR (e.access_tier = 'pro' AND EXISTS(
      SELECT 1 FROM user_subscriptions us
      WHERE us.user_id = $1 AND us.active = true AND us.tier IN ('pro','max')
    ))
    OR (e.access_tier = 'max' AND EXISTS(
      SELECT 1 FROM user_subscriptions us
      WHERE us.user_id = $1 AND us.active = true AND us.tier = 'max'
    ))
    OR EXISTS(
      SELECT 1 FROM user_plans up
      JOIN plan_exams pe ON pe.plan_id = up.plan_id
      WHERE up.user_id = $1 AND up.active = true AND pe.exam_id = $2
    )
  )
)
```

### 4c. Modify exam listing API

Add to the exam list response:
- `access_tier` field (free/pro/max)
- `has_access` boolean (computed per-user)

New endpoint: `GET /api/my/subscription` → returns active subscription or `null`

### 4d. Modify admin exam CRUD

- `CreateExamRequest` / `UpdateExamRequest` gain `access_tier` field (default: `free`)
- Admin can set `access_tier` to `free`, `pro`, or `max` when creating/editing exams

### 4e. New API routes

```
GET  /api/subscription-plans          → list Pro/Max tier definitions
GET  /api/my/subscription             → current active subscription or null
POST /api/subscriptions/subscribe     → { tier: "pro"|"max" } → Razorpay order
POST /api/subscriptions/upgrade       → Pro→Max upgrade → Razorpay order
POST /api/subscriptions/verify        → verify payment + activate
POST /api/webhooks/subscription       → Razorpay webhook for subscription payments
```

### 4f. Subscription expiry poller

Register in `routes.go` alongside the existing `StartExpiredAttemptPoller`:
```go
subSvc.StartExpiryPoller(ctx, 60*time.Second)
```

---

## 5. Frontend Changes (Student App)

### 5a. New subscription page: `/subscription`
- Shows Pro and Max cards with pricing, duration, features
- If user has active subscription: shows current tier, expiry date, days remaining
- Pro users see "Upgrade to Max" button
- Max users see "Active until [date]"
- Expired users see "Renew" button

### 5b. Modify sidebar/nav
- Rename "Plans" → "Packages" (for one-time bundles)
- Add "Subscription" nav item (for Pro/Max tiers)
- **Conditionally hide "Packages"** if user has active Max subscription

### 5c. Modify exams listing page
- Fetch `GET /api/my/subscription` alongside exams
- Compute access: `exam.access_tier === 'free'` OR `subscription covers tier` OR `package owns exam`
- Locked exams show tier badge + appropriate CTA:
  - Free exam not in package → "Buy package"
  - Pro exam, no sub → "Subscribe to Pro" or "Subscribe to Max"
  - Max exam, no sub → "Subscribe to Max"
  - Max exam, Pro sub → "Upgrade to Max"

### 5d. Modify exam detail page
- Same access logic for Start button vs lock message
- Lock message changes based on tier: "This is a Pro exam. Subscribe to Pro or Max to access."

### 5e. Modify packages page
- Hidden entirely for Max subscribers
- For Pro/Free users: exams already accessible via subscription show "Included in your subscription" (not purchasable)

### 5f. New query file: `lib/queries/subscription.ts`
- `listTiers()`, `mySubscription()`, `subscribe(tier)`, `upgrade()`, `verifyPayment()`

---

## 6. Frontend Changes (Admin App)

### 6a. Modify exam create/edit wizard
- Add `Access Tier` selector in Step 1 (radio group: Free / Pro / Max)
- Default: Free

### 6b. Modify exams table
- Add "Tier" column showing badge (Free = gray, Pro = blue, Max = purple)

### 6c. Optional: Subscription management page
- View all active subscriptions, revenue, expiry stats

---

## 7. Execution Order

| Phase | Steps | Priority |
|---|---|---|
| **Phase 1: DB + Backend** | | |
| 1.1 | Write migration 019 (new tables + `access_tier` column) | High |
| 1.2 | Create `internal/subscription` package (model, service, handler) | High |
| 1.3 | Add subscription routes to `routes.go` | High |
| 1.4 | Modify `exam` service access check for new tier logic | High |
| 1.5 | Add `access_tier` to exam CRUD (model, service, handler) | High |
| 1.6 | Add expiry poller to deactivate expired subscriptions | High |
| 1.7 | Add exam `has_access` computation to list/get endpoints | High |
| **Phase 2: Student Frontend** | | |
| 2.1 | Add `subscription.ts` queries | High |
| 2.2 | Build subscription page (`/subscription`) | High |
| 2.3 | Update sidebar (rename Plans→Packages, add Subscription, hide Packages for Max) | High |
| 2.4 | Update exams page — tier badges, lock messages, access logic | High |
| 2.5 | Update exam detail page — tier-aware lock/start | High |
| 2.6 | Update packages page — hide for Max, mark "included" for subscription-covered exams | High |
| **Phase 3: Admin Frontend** | | |
| 3.1 | Add access tier selector to exam create/edit wizard | Medium |
| 3.2 | Add tier badge column to exams table | Medium |
| **Phase 4: Polish** | | |
| 4.1 | Email notifications for subscription activation, expiry warning (2 days before), expired | Low |
| 4.2 | Dashboard stats for subscription revenue | Low |

---

## 8. Edge Cases & Business Logic

| Scenario | Behavior |
|---|---|
| Pro expires while user is mid-exam | Exam attempt continues (already started). User loses access to start new Pro exams. |
| User has Pro + purchases Max | Pro is deactivated, Max starts fresh with 90-day window. |
| Max user tries to buy a package | Packages tab is hidden. API also rejects if somehow called. |
| User has package that includes a Pro exam | Access granted via package regardless of subscription status. |
| Admin changes exam tier from free→pro | Existing package ownership still grants access. Only new "start" checks are affected. |
| User's subscription expires | `active` set to `false` by poller. User reverts to free tier. All Pro/Max exams become locked. |
| User re-subscribes after expiry | New `user_subscriptions` row. No "resume" — fresh subscription period. |
| Concurrent webhook + verify-payment | Idempotency via `payments.status <> 'captured'` check (same as current). |

---

## 9. Data Model Summary

```
┌─────────────────────┐
│  subscription_plans │  (Pro, Max — system-defined tiers)
│  tier, price, days  │
└─────────┬───────────┘
          │ user subscribes
          ▼
┌─────────────────────┐         ┌──────────────┐
│ user_subscriptions  │─────────│   payments   │
│ user, tier, expiry  │         └──────────────┘
└─────────────────────┘
          │
          │ grants access to exams where access_tier ≤ user's tier
          ▼
┌─────────────────────┐
│       exams         │◄── access_tier: free | pro | max
│  (+ existing fields)│
└────────┬────────────┘
         │
         │ also accessible via packages (existing system)
         ▼
┌─────────────────────┐
│   plans (packages)  │──── plan_exams ──── exams
│   user_plans        │
└─────────────────────┘
```
