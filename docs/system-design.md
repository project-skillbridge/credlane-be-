# SkillBridge API — System Design Document

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CLIENT TIER                                   │
│              Web App (React) / Mobile / Postman / OAuth                  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │ HTTPS
                               ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         API GATEWAY (NestJS 11)                         │
│                                                                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────┐  │
│  │  Auth    │ │  Talent  │ │Employer  │ │Dashboard │ │  Welcome /   │  │
│  │ Module   │ │  Module  │ │ Module   │ │ Module   │ │  Health      │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬───────┘  │
│       │            │            │            │               │          │
│  ┌────┴────────────┴────────────┴────────────┴───────────────┴───────┐  │
│  │                     GLOBAL CROSS-CUTTING                          │  │
│  │  JwtAuthGuard │ RolesGuard │ ValidationPipe │ TransformInterceptor│  │
│  │  LoggingInterceptor │ HttpExceptionFilter │ ClassSerializer       │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│       │            │            │                                       │
│  ┌────┴────────────┴────────────┴───────────────────────────────────┐  │
│  │  @Global() Shared Modules                                         │  │
│  │  AI Module (OpenRouter + Vercel AI SDK)    Mail Module (Resend)   │  │
│  │  Upload Module (AWS S3)                   Queue (BullMQ + Redis)  │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────┬──────────────────────────────────────────┘
                               │
          ┌────────────────────┼────────────────────┐
          ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐         ┌──────────┐
   │PostgreSQL│        │  Redis   │         │  AWS S3  │
   │(TypeORM) │        │(optional)│         │ (avatars)│
   └──────────┘        └──────────┘         └──────────┘
          │                                      │
          │  ┌──────────────┐                    │
          └──│ OpenRouter   │                    │
             │  (LLM API)   │                    │
             └──────────────┘                    │
          ┌──────────────┐                       │
          │  Google APIs │                       │
          │  (OAuth)     │                       │
          └──────────────┘                       │
          ┌──────────────┐                       │
          │   Resend     │◄──────────────────────┘
          │  (Email)     │
          └──────────────┘
```

---
<page_break>

## Data Flow

**Authentication flow:**
```
Register → POST /auth/register → Validation (DTO) → AuthService
  → UsersService.create() → VerificationOtpService.issue()
  → MailService (OTP email via Resend) → Response
Verify → POST /auth/verify-email → arcon2 OTP match
  → JwtService sign (access + refresh tokens)
  → Set httpOnly cookies → Response
```

**Assessment flow (the core domain):**
```
Talent → POST /talent/assessment/skill/start
  → SkillAssessmentService → fetch questions (bank)
  → Create AssessmentAttempt + AssessmentResponse rows
Talent → POST /talent/assessment/skill/submit
  → MCQ: direct correct_answer comparison
  → Text: OpenRouterService (rubric scoring via structured LLM output)
  → Compute percentage → map to VerifiedLevel via thresholds
  → Write AssessmentResult + update TalentProfile.validated_level
  → (If advanced) Create EmployerPoolProfile on "job_ready"
```

**General request lifecycle:**
```
Incoming HTTP → Helmet/Compression/CORS
  → JwtAuthGuard (extract & verify token)
  → RolesGuard (check role if @Roles present)
  → Controller (route handler)
  → ValidationPipe (class-validator DTO transform & whitelist)
  → Service (business logic)
  → ModelAction (TypeORM via AbstractModelAction)
  → TransformInterceptor (envelope: { status_code, message, data })
  → LoggingInterceptor (log method, URL, duration)
  → Response
```

---

## Key Technical Decisions

| Decision | Rationale |
|---|---|
| **Cookie-based JWT** (httpOnly, SameSite=strict) | Prevents XSS token theft vs localStorage. Refresh token rotation with argon2 hash comparison mitigates token theft/replay. |
| **Global `JwtAuthGuard` with `@Public()` opt-out** | Secure by default — every new route is protected unless explicitly marked public. No forgetting to add a guard. |
| **AbstractModelAction<T> pattern over TypeORM repositories** | Centralizes soft-delete, pagination, and error handling in one place. Makes it possible to swap ORM without touching services. |
| **BullMQ with inline Redis fallback** | Zero-config in development; optional Redis in production. Queue is a performance optimization, not a hard dependency. |
| **Zod-structured AI output** (`generateText` + Zod schema) | Type-safe LLM responses — guarantees JSON shape at runtime. No manual parsing of free-form GPT output. |
| **JSONB for flexible assessment data** (personal_assessment_answers, ai_evaluation_json) | Assessment questions and scoring evolve rapidly. JSONB avoids schema migrations for every question change. GIN indexes available for querying. |
| **Server-side assessment timer** (`expires_at` on Attempt) | Prevents client-side clock manipulation. 90-minute window enforced by the API, not the browser. |
| **Fail-fast env validation** (T3 + Zod) | App crashes at startup with clear message if required config is missing. No silent failures or runtime surprises. |
| **Separate AssessmentAttempt / Response / Result entities** | Enables full audit trail: retakes, integrity flags (tab switches), historical score tracking, and AI re-evaluation. |

---

## Scaling Considerations

- **Stateless API:** JWT tokens carry session data. No server-side state beyond the DB. Horizontally scale NestJS instances behind a load balancer with no session affinity.
- **Database indexing:** All foreign keys, `user_id`, `email`, `talent_profile_id`, and `attempt_id` are indexed. `assessment_questions` is indexed by `(track, verified_level)` for fast question lookups.
- **AI bottleneck:** OpenRouter LLM calls take 3–15s. Currently synchronous in the request path. **Future**: move to async BullMQ worker for assessment scoring. The `GuidanceReportService` call alone can be deferred to a post-processing queue.
- **Read replicas:** Dashboard and profile-read endpoints (GET-heavy) can be routed to a read replica while assessment writes target the primary.
- **BullMQ workers:** Email delivery and AI scoring can be scaled independently as dedicated worker processes using PM2's ecosystem config.
- **S3 uploads:** Pre-signed URLs would eliminate the API as a middleman for large file uploads. Currently Multer streams through the server, which adds memory pressure.

---

## Failure Handling Strategy

| Failure Scenario | Mitigation |
|---|---|
| **PostgreSQL down** | Global `HttpExceptionFilter` returns `503 Service Unavailable`. Health/probe endpoints detect outage. PM2 auto-restart. |
| **Redis unavailable** | BullMQ falls back to inline synchronous execution. Queue is a perf optimization — not a correctness requirement. |
| **OpenRouter / AI API down** | Assessment submission fails with `502 Bad Gateway`. Client retries. No partial state — assessment is transactional per submission. |
| **Resend email API down** | OTP issuance proceeds (OTP stored in DB). Email delivery retries via BullMQ (configurable attempts + backoff). `PasswordResetQueueService` handles retry logic. |
| **Refresh token theft / replay** | Optimistic concurrency: `UPDATE ... WHERE id = :id AND refreshTokenHash = :currentHash`. If hash doesn't match, the stolen token was already rotated — attacker and legitimate user both fail, user re-logs in. |
| **Concurrent OAuth registration** | Transactional user creation with unique constraint on `(provider, provider_id)`. If a race creates a duplicate email, the second insert fails the transaction cleanly. |
| **Assessment tab-switch abuse** | Server tracks `tab_switch_count`. At 3 switches, session is voided and 14-day gate applied. Client-side events are authenticated per attempt. |

---

## Tradeoffs

| Choice | What We Gained | What We Sacrificed |
|---|---|---|
| **Global guards** | Security-by-default; zero chance of unprotected endpoints | Slight overhead on every request (cookie parse + JWT verify + DB lookup) |
| **AbstractModelAction pattern** | Uniform data access; ORM-agnostic service layer | Extra abstraction layer; services depend on an intermediate class, not TypeORM directly |
| **AI-generated questions + scoring** | Infinite question variety; subjective answer grading at scale | Cost per assessment (~$0.05–0.20); latency (3–15s); dependency on third-party API |
| **JSONB for flexible schemas** | Zero-migration schema evolution; stores complex nested data | No relational integrity inside JSONB; harder to query without GIN indexes; no DB-level type enforcement |
| **Server-side assessment (sync)** | Strong integrity guarantees; simple request/response model | User waits for AI scoring inline; cannot submit and come back later for results |
| **Cookie auth** | httpOnly protects against XSS; `SameSite=strict` prevents CSRF | Mobile clients need cookie support; CORS with credentials is more complex than Bearer tokens |
| **BullMQ inline fallback** | Simple dev setup; no mandatory Redis | Redis path is less tested; devs may not notice when Redis is missing if fallback works silently |
| **Monolithic NestJS API** | Simple deployment (single process); easy debugging; shared types | Cannot scale auth separately from assessments; a bug in AI scoring can crash the entire process |
