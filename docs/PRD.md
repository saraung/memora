# Memora

**Product Requirements Document · Full-stack social platform**

`FastAPI` · `React + TypeScript` · `PostgreSQL` · `Responsive web`

---

## Table of Contents

1. [Product overview](#1-product-overview)
2. [Technology stack](#2-technology-stack)
3. [Functional requirements](#3-functional-requirements)
4. [Clean architecture](#4-clean-architecture)
5. [Database entities and relationships](#5-database-entities-and-relationships)
6. [API contracts](#6-api-contracts)
7. [Frontend product and visual design](#7-frontend-product-and-visual-design)
8. [Security and privacy requirements](#8-security-and-privacy-requirements)
9. [Performance, reliability, and scalability](#9-performance-reliability-and-scalability)
10. [Testing strategy](#10-testing-strategy)
11. [Development milestones](#11-development-milestones)
12. [Acceptance criteria](#12-acceptance-criteria)
13. [Deployment and environments](#13-deployment-and-environments)
14. [Important technical decisions](#14-important-technical-decisions)
15. [Immediate implementation plan](#15-immediate-implementation-plan)
16. [Admin dashboard (admin-frontend)](#16-admin-dashboard-admin-frontend)

---

## 1. Product overview

### 1.1 Product vision

Memora is a modern social media platform inspired by the core experiences of Instagram, with its own visual identity. Users can share moments, publish photo and video posts, create ephemeral stories, watch short-form videos, follow people, communicate privately, and discover content.

The product should feel polished on both mobile and desktop, with a consistent design system, responsive navigation, smooth interactions, and reliable privacy controls.

### 1.2 Goals

- Provide a complete account registration, login, and account management experience.
- Support public and private profiles and a flexible social graph.
- Build an engaging feed for posts, stories, and Reels.
- Support likes, comments, bookmarks, follows, mentions, and hashtags.
- Provide private messaging and real-time notifications.
- Offer search and discovery.
- Provide reporting, moderation, and administrative tools.
- Establish a secure, testable backend architecture that can evolve as usage grows.
- Keep the codebase understandable and maintainable for ongoing development.

### 1.3 Non-goals for the initial release

These are not required for the first usable release:

- Native Android and iOS applications.
- Microservices and distributed deployment.
- End-to-end encrypted messaging.
- Live streaming and video calls.
- Advertising, creator payouts, and monetization.
- Machine-learning recommendation ranking.
- Advanced video editing tools.

They can be considered after the core platform is stable.

### 1.4 Target users

| User type | Primary needs |
|---|---|
| Visitor | View permitted public content and discover users |
| Registered user | Publish content, follow users, interact, and message |
| Private account user | Approve followers and control content visibility |
| Creator | Share posts, stories, and Reels; understand engagement |
| Moderator | Review reports and take policy-based actions |
| Administrator | Manage users, platform configuration, moderation, and audit records |

### 1.5 Product principles

1. **Privacy first:** Every content endpoint must enforce visibility rules on the server.
2. **Mobile first, desktop complete:** The interface adapts to touch and pointer-based interactions.
3. **Modular monolith:** Keep a single deployable backend with well-separated modules.
4. **Explicit contracts:** Validate inputs and responses and document APIs through OpenAPI.
5. **Secure by default:** Authorization, token management, rate limiting, and auditability are built in rather than added later.
6. **Incremental delivery:** Each milestone produces testable functionality.

---

## 2. Technology stack

### Backend

| Technology | Role |
|---|---|
| **Python 3.12+ · FastAPI** | REST API, dependency injection, validation, OpenAPI documentation, asynchronous endpoints where useful. |
| **SQLModel + PostgreSQL + Alembic** | Relational data, database constraints, migrations, transactions, indexes, and persistence. |
| **Redis and background processing** | Caching, rate-limit support, short-lived coordination, and queues where appropriate. PostgreSQL remains the source of truth for durable application data. |
| **Cloudinary or compatible media storage** | Image and video delivery, transformations, upload workflows, and media metadata. |
| **uv + pytest** | Dependency and environment management, unit tests, API tests, and PostgreSQL integration tests. |

### Frontend

| Technology | Role |
|---|---|
| **React + TypeScript + Vite** | Component-driven UI, type-safe application code, and fast development/build tooling. |
| **Tailwind CSS v4** | Responsive styling, design tokens, reusable UI patterns, and consistent branding. |
| **TanStack Query + Axios + React Router** | Server-state management, API requests, route protection, pagination, and navigation. |
| **Vitest + React Testing Library + Playwright** | Component tests, frontend integration tests, and end-to-end browser testing. |

Additional libraries can be selected when their functionality is implemented. We should avoid adding Redis, WebSockets, job queues, or other infrastructure before there is a clear use case for them.

---

## 3. Functional requirements

**Priority definitions:** P0 = required for a usable core release; P1 = required for a complete social platform; P2 = enhancement.

### FR-01 — Authentication and account security (P0)

- Register with username, email, and password.
- Validate username and email uniqueness.
- Sign in and sign out.
- Hash passwords securely using Argon2id.
- Issue short-lived JWT access tokens.
- Use rotating refresh tokens backed by server-side sessions.
- Detect refresh-token reuse and revoke the affected token family.
- Support logout from the current session and all sessions.
- Provide email verification and password reset.
- Provide authenticated account information through `/auth/me`.
- Apply rate limits to login, registration, verification, and reset endpoints.
- Return consistent validation and authentication errors.

### FR-02 — User profiles (P0)

- Unique username and display name.
- Avatar, biography, and optional profile links.
- Public/private account setting.
- Edit profile and account settings.
- Display post, follower, and following counts.
- View followers and following lists.
- Follow/unfollow users and approve or reject follow requests.
- Block/unblock users.
- Respect private accounts and blocks throughout feeds, searches, stories, messaging, and profile pages.

### FR-03 — Posts and media (P0)

- Create posts containing one image, one video, or multiple media items.
- Store captions, alt text, timestamps, and media ordering.
- Edit captions and delete owned posts.
- Support post details, comments, likes, and bookmarks.
- Display media in a carousel when a post contains multiple items.
- Support media upload validation and upload completion.
- Record media dimensions, type, size, duration where relevant, and processing status.
- Enforce content visibility and ownership rules.

### FR-04 — Following and social graph (P0)

- Follow and unfollow public accounts.
- Send follow requests to private accounts.
- Approve, reject, and cancel follow requests.
- List followers and following.
- Block and unblock accounts.
- Prevent invalid self-following and duplicate relationships.
- Handle deleted, suspended, blocked, or private accounts consistently.

### FR-05 — Home feed and discovery feed (P0/P1)

- Return posts the viewer is allowed to see.
- Initially rank the feed chronologically.
- Use cursor pagination instead of large offset pagination.
- Exclude blocked relationships and unauthorized private content.
- Provide loading, empty, retry, and end-of-feed states.
- Support refresh and incremental loading.
- Add a discovery feed with public content in a later milestone.

### FR-06 — Stories (P1)

- Publish photo or short-video stories.
- Set story expiration to 24 hours after publication.
- Show active stories from permitted accounts.
- Record story views.
- Provide an owner-only viewer list.
- Allow the owner to delete a story before expiry.
- Exclude expired stories from normal queries.
- Clean up expired metadata and associated media according to retention policy.

### FR-07 — Reels and short-form video (P1)

- Publish short videos with captions and cover images.
- Support playback, pause, mute, and vertical scrolling.
- Record qualified views using a documented view-counting rule.
- Like, comment on, share, and bookmark Reels.
- Process videos asynchronously when transcoding is needed.
- Display processing and failure states.
- Enforce visibility and moderation restrictions.

### FR-08 — Comments and engagement (P0)

- Add, edit, and delete comments according to ownership and moderation policy.
- Like and unlike posts and comments.
- Prevent duplicate likes through database constraints.
- Paginate comments.
- Support mentions in comments and captions.
- Update visible engagement counts consistently.
- Prevent interactions with content the user cannot access.

### FR-09 — Bookmarks (P0)

- Bookmark and remove bookmarks from posts.
- List bookmarks belonging to the authenticated user.
- Ensure bookmarks are private to their owner.
- Exclude inaccessible or deleted content from normal bookmark results.

### FR-10 — Messaging (P1)

- Create or open direct conversations.
- Send and retrieve text messages.
- Support image attachments after media upload infrastructure is ready.
- Display conversation participants and last-message previews.
- Support message history pagination.
- Track delivery/read state where supported.
- Use WebSockets for real-time delivery, with an HTTP fallback or resynchronization mechanism.
- Reconnect and recover missed messages.
- Enforce participant membership on every operation.
- Apply block, privacy, and message-request rules.

### FR-11 — Notifications (P1)

Generate notifications for relevant events, including:

- New followers and follow requests.
- Likes and comments.
- Mentions.
- Story or content interactions where appropriate.
- New messages.
- Moderation and account-security events.

Requirements:

- Persist notifications in PostgreSQL.
- Paginate notifications.
- Track unread counts.
- Mark one or all as read.
- Push real-time updates over WebSockets when connected.
- Respect user preferences and avoid notifying users about disallowed interactions.

### FR-12 — Search, hashtags, and mentions (P1)

- Search users by username and display name.
- Search permitted public posts.
- Search hashtags and browse associated posts.
- Extract and store hashtags from captions.
- Parse mentions and validate referenced users.
- Exclude private content the viewer cannot access.
- Prevent blocked users and restricted content from leaking through search results.
- Begin with PostgreSQL search/indexing and evolve to a dedicated search service only if justified.

### FR-13 — Reporting and moderation (P1)

- Report accounts, posts, comments, and messages where policy permits.
- Record report category, details, reporter, target, status, and timestamps.
- Allow authorized moderators to review reports.
- Support actions such as dismissing a report, removing content, warning a user, temporarily restricting an account, or suspending an account.
- Record the acting moderator, reason, target, and action in an audit trail.
- Prevent moderators from exercising privileges beyond their role.
- Keep a documented appeal/reversal workflow if introduced.

### FR-14 — Administration and observability (P1)

- Role-based administrative access.
- User and content moderation queues.
- Account status and report summaries.
- Basic platform health and error monitoring.
- Structured logs with request correlation IDs.
- Audit events for privileged and security-sensitive actions.
- Configuration managed through environment variables or a secrets manager.
- No secrets, access tokens, passwords, or private message contents in logs.

### FR-15 — Account and data lifecycle (P1)

- Provide a clear account deactivation/deletion workflow.
- Define how user content, messages, media, reports, and audit events are handled when accounts are deleted.
- Support media cleanup for abandoned uploads.
- Apply retention rules for expired stories and expired authentication sessions.
- Provide backup and recovery procedures.
- Document any data that must be retained for security or legal reasons.

### FR-16 — Authorization and access control (P0)

Memora uses a hybrid authorization model: **RBAC** for platform staff, **ReBAC** for relationships between users and content, and **ABAC** for current state and privacy conditions. A single `role` string on the user record is not sufficient.

- Define staff roles (e.g. `admin`, `moderator`, `support`) as database-backed roles bundling granular permissions (e.g. `reports:review`, `content:remove`, `users:suspend`).
- Allow a user to hold multiple staff roles; ordinary authenticated users have no staff role by default (no explicit `member` role row).
- Never allow staff roles or permissions to be changed through ordinary profile or account updates.
- Evaluate relationship rules (own content, follows, blocks, conversation membership, story ownership) separately from staff permissions.
- Evaluate state rules (account status, public/private profile, post visibility and removal status, story expiry) on every access decision.
- Deny by default and enforce authorization on every protected request.
- The `admin` role must not automatically bypass privacy or safety rules (e.g. private messages, blocks). Any sensitive exception must be explicit, permission-gated, and audited.
- Provide reusable FastAPI dependencies for permission checks (e.g. `require_permission("reports:review")`) and shared resource-level policy checks reused by feed, search, profile, and content endpoints.
- Record staff role/permission changes and other privileged actions in the audit trail.

---

## 4. Clean architecture

The backend should be a modular monolith. This means one application and deployment initially, with strong module boundaries and the option to extract services later.

### 4.1 Dependency direction

```
HTTP/API layer
  FastAPI routers, request schemas, response schemas, dependencies
        ↓
Application layer
  Use cases, orchestration, interfaces, transactions, DTOs
        ↓
Domain layer
  Business rules, domain entities, value objects, policies, domain errors

Infrastructure implementations
  SQLModel repositories, PostgreSQL, Redis, media storage, email, realtime delivery
```

Infrastructure implements interfaces defined inward; it does not define core business rules.

**Rules:**

- The domain must not depend on FastAPI, SQLModel, Redis, or Cloudinary.
- Application use cases depend on domain logic and abstractions.
- Infrastructure implements persistence, cache, storage, and external integrations.
- API modules translate HTTP requests into use-case calls.
- `core` contains cross-cutting infrastructure such as configuration, logging, security helpers, and exception handling.
- Avoid circular imports.
- Do not expose database models directly as public API contracts.
- Keep transactions and authorization decisions explicit.
- Keep authorization policies (staff permissions, relationship rules, state rules) in a dedicated, well-organized layer that endpoints and use cases call; do not scatter ad-hoc checks across routers.
- Do not introduce an external policy engine until complexity justifies it.

### 4.2 Backend project structure

Continue with the existing folders. Adjust names only when there is a concrete reason, rather than restructuring everything at once.

```
backend/
├── app/
│   ├── main.py
│   ├── core/
│   │   ├── config.py                 # Existing
│   │   ├── logging.py                # Existing
│   │   ├── exceptions.py             # Existing
│   │   ├── security.py
│   │   ├── middleware.py
│   │   └── constants.py
│   ├── domain/
│   │   ├── entities/
│   │   ├── value_objects/
│   │   ├── policies/                 # Access policies (content visibility, ownership, staff permissions)
│   │   ├── enums/
│   │   ├── events/
│   │   ├── repositories/
│   │   └── exceptions.py
│   ├── application/
│   │   ├── dto/
│   │   ├── interfaces/
│   │   ├── services/
│   │   └── use_cases/
│   │       ├── auth/
│   │       ├── profiles/
│   │       ├── posts/
│   │       ├── follows/
│   │       ├── feed/
│   │       ├── stories/
│   │       ├── reels/
│   │       ├── messaging/
│   │       └── moderation/
│   ├── infrastructure/
│   │   ├── database/
│   │   │   ├── session.py
│   │   │   ├── base.py
│   │   │   ├── models/
│   │   │   └── repositories/
│   │   ├── security/
│   │   ├── cache/
│   │   ├── storage/
│   │   ├── realtime/
│   │   ├── tasks/
│   │   └── observability/
│   ├── modules/
│   │   ├── auth/
│   │   ├── users/
│   │   ├── profiles/
│   │   ├── posts/
│   │   ├── media/
│   │   ├── comments/
│   │   ├── likes/
│   │   ├── follows/
│   │   ├── feed/
│   │   ├── stories/
│   │   ├── reels/
│   │   ├── messaging/
│   │   ├── notifications/
│   │   ├── search/
│   │   ├── hashtags/
│   │   ├── bookmarks/
│   │   ├── authorization/            # Roles, permissions, permission dependencies
│   │   ├── moderation/
│   │   └── admin/
│   └── api/
│       ├── dependencies.py
│       └── v1/
│           └── router.py
├── migrations/
│   ├── env.py
│   └── versions/
├── scripts/
├── workers/
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── api/
│   ├── factories/
│   └── conftest.py
├── .env.example
├── .gitignore
├── alembic.ini
├── pyproject.toml
└── README.md
```

Not every directory needs to be populated immediately. Add files as their corresponding feature is implemented.

### 4.3 Existing core files

Preserve these files and extend them deliberately:

- `app/core/config.py`: environment configuration and validated settings.
- `app/core/logging.py`: structured application logging.
- `app/core/exceptions.py`: shared application exceptions.

Later, integrate exception handlers into FastAPI, add security utilities, and centralize dependencies. Do not rewrite these files just to introduce SQLModel.

### 4.4 Database session and migrations

- Create one SQLAlchemy engine and a session factory.
- Provide a FastAPI dependency that yields and reliably closes a database session.
- Use explicit transaction boundaries for multi-step business operations.
- Use SQLModel table models for persistence and Alembic for schema changes.
- Ensure all table models are imported before Alembic reads `SQLModel.metadata`.
- Use migrations for schema changes; do not rely on `create_all()` in production.
- Test migrations against PostgreSQL, not only SQLite.
- Use PostgreSQL constraints and indexes to protect important invariants.

### 4.5 Frontend project structure

```
frontend/
├── public/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── navigation/
│   │   ├── media/
│   │   ├── feedback/
│   │   └── forms/
│   ├── features/
│   │   ├── auth/
│   │   ├── feed/
│   │   ├── profiles/
│   │   ├── posts/
│   │   ├── follows/
│   │   ├── stories/
│   │   ├── reels/
│   │   ├── messaging/
│   │   ├── notifications/
│   │   ├── search/
│   │   ├── bookmarks/
│   │   └── moderation/
│   ├── layouts/
│   ├── pages/
│   ├── services/
│   │   ├── api-client.ts
│   │   └── endpoints/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── styles/
│       └── index.css
├── package.json
├── tsconfig.json
└── vite.config.ts
```

**Frontend conventions:**

- Use TypeScript types for API payloads and domain-facing UI models.
- Keep feature-specific components, hooks, and API functions together.
- Use TanStack Query for server state and caching.
- Use local React state for temporary UI state.
- Keep API base URLs and environment configuration out of components.
- Use shared loading, error, empty, and retry components.
- Avoid duplicating business authorization logic in the frontend; the backend remains authoritative.

---

## 5. Database entities and relationships

Use UUID primary keys for public-facing records, timezone-aware timestamps stored consistently in UTC, foreign keys, database constraints, and appropriate indexes. PostgreSQL is the authoritative store for application data.

### 5.1 Core entities

| Entity | Important fields and purpose |
|---|---|
| User | id, email, username, password_hash, display_name, is_verified, account_status, created_at, updated_at |
| RefreshSession | id, user_id, hashed refresh-token identifier, token-family ID, expiry, revocation, device/session metadata |
| EmailVerificationToken | User, token hash, expiry, used timestamp |
| PasswordResetToken | User, token hash, expiry, used timestamp |
| UserPreference | User, notification preferences, privacy defaults, interface settings |
| Follow | Follower ID, followed ID, creation timestamp |
| FollowRequest | Requester ID, target ID, status, timestamps |
| Block | Blocker ID, blocked ID, creation timestamp |
| Role | id, name (e.g. `admin`, `moderator`, `support`), description, timestamps |
| Permission | id, code (e.g. `reports:review`, `content:remove`, `users:suspend`), description |
| UserRole | User ID, role ID, granted by, granted timestamp |
| RolePermission | Role ID, permission ID |

### 5.2 Content and engagement entities

| Entity | Important fields and purpose |
|---|---|
| Post | Author, caption, visibility, status, timestamps |
| MediaAsset | Storage provider, storage key, MIME type, dimensions, size, duration, processing status |
| PostMedia | Post ID, media ID, ordering, alt text |
| Like | User ID, post ID, creation timestamp |
| Comment | Post ID, author ID, body, optional parent comment if replies are supported, timestamps |
| Bookmark | User ID, post ID, creation timestamp |
| Story | Author, media ID, caption, creation time, expiry time, status |
| StoryView | Story ID, viewer ID, viewed timestamp |
| Reel | Author, video asset, caption, cover asset, processing status, publication status |
| Hashtag | Normalized hashtag text |
| PostHashtag | Post ID, hashtag ID |
| Mention | Source content type and ID, mentioned user, source position or parsed text metadata |

Use separate Story and Reel records even if both reference shared media assets. Their expiry, visibility, processing, and interaction rules differ.

### 5.3 Messaging and notification entities

| Entity | Important fields and purpose |
|---|---|
| Conversation | ID, conversation type, creation timestamp, latest activity |
| ConversationParticipant | Conversation ID, user ID, joined/left timestamps, mute/archive settings |
| Message | Conversation ID, sender ID, message type, body or media reference, creation timestamp, edit/deletion status |
| MessageReceipt | Message ID, user ID, delivered/read timestamps |
| Notification | Recipient, actor, notification type, target type/ID, read timestamp, creation timestamp |

Use a unique participant constraint per conversation and user. For direct conversations, define a deterministic lookup strategy to avoid accidentally creating duplicate conversations for the same participants.

### 5.4 Moderation and operations entities

| Entity | Important fields and purpose |
|---|---|
| Report | Reporter, target type/ID, category, details, status, assigned moderator |
| ModerationAction | Moderator, target, action, reason, timestamps, optional expiry |
| AuditEvent | Actor, action, target, request ID, safe metadata, timestamp |
| MediaUploadIntent | Owner, expected media type/size, expiry, upload state, provider reference |
| OutboxEvent (recommended) | Event type, payload, creation timestamp, processing state, retry count |

The outbox pattern is useful when a database transaction must reliably trigger a background task or notification. It is not necessary to implement every event through an outbox on day one, but the design should avoid losing important events between committing a database change and publishing a message.

### 5.5 Relationship overview

| Group | Entities |
|---|---|
| **User** (root) | — |
| Social graph | Follow · FollowRequest · Block |
| Content | Post · Story · Reel |
| Engagement | Like · Comment · Bookmark |
| Communication | Conversation · Message |
| Platform events | Notification · AuditEvent |
| Safety | Report · ModerationAction |
| Staff authorization | Role · Permission · UserRole · RolePermission |

### 5.6 Database constraints and indexes

At minimum:

- Unique normalized username and email.
- Unique `(follower_id, followed_id)` for follows.
- Unique `(requester_id, target_id)` for follow requests.
- Unique `(user_id, post_id)` for likes and bookmarks.
- Unique `(story_id, viewer_id)` for story views, if only one view record per viewer/story is desired.
- Unique normalized hashtag.
- Unique role name and unique permission code.
- Unique `(user_id, role_id)` for user roles and `(role_id, permission_id)` for role permissions.
- Unique `(conversation_id, user_id)` for conversation participants.
- Check constraints preventing self-following and self-blocking.
- Foreign keys and deletion policies appropriate to each relationship.
- Indexes for feed retrieval, author posts, comments by post, messages by conversation and timestamp, notifications by recipient and timestamp, and reports by status.
- Indexes for expiry jobs and background-processing queues.
- Full-text or trigram indexes for selected search fields where useful.

Define deletion semantics carefully. For example, removing a user should not accidentally cascade-delete audit records that the platform is required to retain.

---

## 6. API contracts

All public endpoints are versioned under `/api/v1`. JSON is the default request and response format, except for media uploads and WebSocket traffic.

### 6.1 API conventions

- Use plural nouns for collection resources.
- Use GET for reads, POST for creation or commands, PATCH for partial updates, and DELETE for deletion.
- Validate request bodies and path parameters.
- Use consistent response schemas and error envelopes.
- Require authentication for private operations.
- Return pagination cursors for large collections.
- Return appropriate status codes: 200, 201, 202, 204, 400, 401, 403, 404, 409, 413, 415, 422, and 429 as appropriate.
- Use idempotency controls for operations where retries could duplicate important effects.
- Document the API using FastAPI's OpenAPI support.

**Standard success response**

Individual resources can be returned directly as JSON objects. Collection endpoints should return a stable envelope:

```json
{
  "items": [],
  "next_cursor": null,
  "has_more": false
}
```

**Standard error response**

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found.",
    "details": {},
    "request_id": "request-correlation-id"
  }
}
```

Do not expose stack traces, SQL statements, secret values, or internal exception details in production responses.

### 6.2 Authentication API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Create an account |
| POST | `/auth/login` | Authenticate and establish a session |
| POST | `/auth/refresh` | Rotate refresh token and issue access token |
| POST | `/auth/logout` | Revoke the current session |
| POST | `/auth/logout-all` | Revoke all sessions |
| GET | `/auth/me` | Get authenticated account information |
| POST | `/auth/verify-email` | Verify email using a token |
| POST | `/auth/password/forgot` | Request a password reset |
| POST | `/auth/password/reset` | Set a new password using a reset token |

Registration request:

```json
{
  "username": "memora_user",
  "email": "user@example.com",
  "password": "a-strong-password"
}
```

Validation includes username format, email format, password policy, normalized uniqueness, and rate limiting.

The login/refresh response design must match the frontend's token strategy. Prefer a refresh token in a secure, HttpOnly, Secure, appropriately SameSite cookie for a browser application, with CSRF protections when cookie-based authentication requires them. Access tokens should be short-lived and stored with an explicit security policy; avoid persisting long-lived credentials in localStorage without carefully evaluating the XSS risks.

### 6.3 User and profile API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/users/{username}` | View an accessible profile |
| PATCH | `/users/me` | Edit current profile |
| PATCH | `/users/me/privacy` | Update account privacy |
| GET | `/users/{username}/followers` | List followers |
| GET | `/users/{username}/following` | List following |
| GET | `/users/me/blocked` | List blocked users |
| POST | `/users/{user_id}/block` | Block a user |
| DELETE | `/users/{user_id}/block` | Unblock a user |

### 6.4 Follow API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/users/{user_id}/follow` | Follow a public user or request access |
| DELETE | `/users/{user_id}/follow` | Unfollow |
| GET | `/follow-requests` | List incoming requests |
| POST | `/follow-requests/{request_id}/approve` | Approve a request |
| POST | `/follow-requests/{request_id}/reject` | Reject a request |
| DELETE | `/follow-requests/{request_id}` | Cancel a sent request |

The backend must prevent duplicate follows, enforce private-account rules, and ensure that only the target account can approve or reject its incoming requests.

### 6.5 Posts and engagement API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/posts` | Create a post |
| GET | `/posts/{post_id}` | Get an accessible post |
| PATCH | `/posts/{post_id}` | Edit an owned post |
| DELETE | `/posts/{post_id}` | Delete an owned post |
| GET | `/posts/{post_id}/comments` | List comments |
| POST | `/posts/{post_id}/comments` | Create a comment |
| PATCH | `/comments/{comment_id}` | Edit a comment |
| DELETE | `/comments/{comment_id}` | Delete a comment |
| PUT | `/posts/{post_id}/like` | Like a post idempotently |
| DELETE | `/posts/{post_id}/like` | Unlike a post |
| GET | `/users/me/bookmarks` | List current user's bookmarks |
| PUT | `/posts/{post_id}/bookmark` | Bookmark a post |
| DELETE | `/posts/{post_id}/bookmark` | Remove a bookmark |

Use a PUT operation when the desired state is explicitly "liked" or "bookmarked," rather than relying on a toggle that can behave incorrectly when requests are retried.

### 6.6 Feed and discovery API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/feed` | Home feed |
| GET | `/explore` | Discovery feed |
| GET | `/users/{username}/posts` | Accessible profile posts |
| GET | `/search/users` | Search users |
| GET | `/search/posts` | Search accessible posts |
| GET | `/search/hashtags` | Search hashtags |
| GET | `/hashtags/{tag}/posts` | Browse posts for a hashtag |

Example request:

```
GET /api/v1/feed?limit=20&cursor=opaque-cursor
```

The cursor must be opaque and validated by the server. It should encode or reference stable ordering information rather than trusting arbitrary client-supplied database IDs.

### 6.7 Media API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/media/upload-intents` | Start an authorized upload |
| POST | `/media/upload-intents/{id}/complete` | Complete and validate upload |
| GET | `/media/{media_id}` | Get permitted media metadata |
| DELETE | `/media/{media_id}` | Delete an owned media asset where permitted |

Prefer signed direct uploads to Cloudinary or another storage provider for larger files. The backend must authorize the owner, restrict accepted formats and sizes, validate provider callbacks or upload results, and verify the uploaded asset before associating it with published content.

Never trust a client-supplied URL as proof that a file is owned by the user or safe to publish.

### 6.8 Stories and Reels API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/stories` | Publish a story |
| GET | `/stories/feed` | Get active stories the viewer can access |
| GET | `/stories/{story_id}` | View a story |
| POST | `/stories/{story_id}/views` | Record a view |
| GET | `/stories/{story_id}/viewers` | List viewers for the owner |
| DELETE | `/stories/{story_id}` | Delete an owned story |
| POST | `/reels` | Publish a Reel |
| GET | `/reels/feed` | Retrieve the Reel feed |
| GET | `/reels/{reel_id}` | Get a Reel |
| POST | `/reels/{reel_id}/views` | Record a qualified view |
| DELETE | `/reels/{reel_id}` | Delete an owned Reel |

Expired stories must not be served merely because a cleanup job has not run yet. Expiration is enforced in queries and authorization checks as well as by background cleanup.

### 6.9 Messaging API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/conversations` | List current user's conversations |
| POST | `/conversations` | Create or retrieve a direct conversation |
| GET | `/conversations/{id}/messages` | Get paginated history |
| POST | `/conversations/{id}/messages` | Send a message |
| POST | `/conversations/{id}/read` | Update read state |
| WS | `/ws` | Real-time messaging and event connection |

The WebSocket must authenticate the connection and authorize every subscribed conversation. It must not allow a client to subscribe to arbitrary conversation IDs.

### 6.10 Notifications API

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/notifications` | List notifications |
| GET | `/notifications/unread-count` | Get unread count |
| POST | `/notifications/{id}/read` | Mark one as read |
| POST | `/notifications/read-all` | Mark all as read |

### 6.11 Moderation and administration API

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/reports` | Submit a report |
| GET | `/admin/reports` | List reports for authorized staff |
| GET | `/admin/reports/{id}` | Review a report |
| POST | `/admin/reports/{id}/actions` | Apply a moderation decision |
| GET | `/admin/users` | Search/manage accounts |
| GET | `/admin/audit-events` | View authorized audit history |
| GET | `/admin/roles` | List staff roles and their permissions |
| POST | `/admin/users/{user_id}/roles` | Assign a staff role (audited) |
| DELETE | `/admin/users/{user_id}/roles/{role_id}` | Revoke a staff role (audited) |

Administrative endpoints require server-side role checks and explicit permissions. Hiding an admin button in React is not an authorization mechanism.

---

## 7. Frontend product and visual design

### 7.1 Memora visual identity

Memora should look like its own product rather than a clone of Instagram. Use a recognizable logo, consistent icon style, carefully controlled color palette, distinctive typography, and a coherent visual system.

**Brand direction**

| Token | Usage |
|---|---|
| Memora violet | Primary actions |
| Midnight ink | Text and dark UI |
| Soft lavender | Subtle surfaces |
| Clean white | Primary surfaces |

*Initial palette proposal. Final color tokens, contrast ratios, typography, and light/dark behavior should be validated during frontend implementation.*

**Design principles:**

- Clean surfaces and clear information hierarchy.
- Rounded media and cards without excessive decorative effects.
- Consistent spacing, typography, icon sizing, and interactive states.
- Subtle transitions for navigation, likes, story progress, and menus.
- Accessible focus indicators, semantic HTML, and sufficient color contrast.
- Reduced-motion support.
- Consistent loading skeletons and empty states.
- Avoid copying Instagram's logo, exact brand styling, or proprietary assets.

### 7.2 Responsive application shell

**Desktop:**

- Left navigation rail with Memora branding.
- Central feed or feature content.
- Optional right sidebar for suggestions and trending topics.
- Dedicated messaging layout with conversation list and chat panel.
- Responsive modal/drawer patterns for creation and settings.

**Mobile:**

- Compact top bar with branding and key actions.
- Bottom navigation for primary destinations.
- Full-screen story and Reel viewers.
- Touch-friendly controls and swipe gestures where appropriate.
- Chat layout that transitions between conversation list and active conversation.
- Forms that fit small screens without horizontal overflow.

### 7.3 Frontend pages and routes

| Route | Page | Key components |
|---|---|---|
| `/` | Home feed or landing page | Feed, stories rail, post card, suggestions |
| `/login` | Sign in | Login form, validation, password visibility |
| `/register` | Registration | Registration form, validation |
| `/verify-email` | Email verification | Token status and resend action |
| `/forgot-password` | Password recovery | Recovery form |
| `/reset-password` | Reset password | New password form |
| `/explore` | Discovery | Explore grid, user suggestions |
| `/search` | Search | Search input, result tabs, result lists |
| `/p/:postId` | Post details | Media viewer, caption, comments |
| `/reels` | Reel viewer | Vertical video feed and controls |
| `/stories/:storyId` | Story viewer | Progress, viewer, navigation |
| `/u/:username` | User profile | Profile header, follow action, post grid |
| `/settings` | Account settings | Privacy, profile, notification settings |
| `/bookmarks` | Saved posts | Private bookmark grid |
| `/messages` | Messaging | Conversation list and chat |
| `/notifications` | Notifications | Notification list and unread states |
| `/moderation` | Moderation workspace | Reports queue and case detail |
| `/admin` | Administration | Authorized management and audit tools |

> **Note:** The `/moderation` and `/admin` staff workspaces listed above are delivered by the separate internal `admin-frontend` application (see [Section 16](#16-admin-dashboard-admin-frontend)), not by the public Memora frontend. The public app should not ship staff screens; ordinary users must never reach them.

Public versus authenticated route behavior should be explicit. A public profile can be accessible without login where privacy permits; private profile content remains protected.

### 7.4 Reusable component library

Build shared components before duplicating patterns across pages.

**Core UI**

- Button
- Input
- Textarea
- Avatar
- Badge
- DropdownMenu
- Dialog
- Drawer
- Tooltip
- Tabs
- Skeleton
- Toast
- ErrorState
- EmptyState
- ConfirmDialog

**Navigation**

- AppShell
- DesktopSidebar
- MobileBottomNav
- TopBar
- NotificationBell
- UserMenu

**Social content**

- PostCard
- PostMediaCarousel
- PostActions
- CommentList
- CommentComposer
- StoryAvatar
- StoriesRail
- StoryViewer
- ReelCard
- ReelViewer
- ProfileHeader
- ProfilePostGrid
- FollowButton
- UserSuggestionCard

**Messaging and feedback**

- ConversationList
- ConversationItem
- ChatHeader
- MessageBubble
- MessageComposer
- TypingIndicator
- NotificationItem
- ReportDialog
- ModerationActionDialog

Components should have clear props, typed callbacks, accessible keyboard behavior, and test coverage appropriate to their complexity.

### 7.5 Frontend state and API integration

- Use TanStack Query for server state, pagination, cache invalidation, and mutations.
- Use React state or a small state-management solution only where shared client state requires it.
- Centralize Axios configuration and error normalization.
- Handle 401 responses without creating refresh loops.
- If refresh requests are used, coordinate concurrent requests and revoke/reset local session state safely when refresh fails.
- Use optimistic updates only where rollback behavior is defined.
- Reconcile WebSocket events with cached query state.
- Do not trust client-side permission flags as proof of access.
- Use environment variables for API base URLs; never put private server secrets in frontend variables.

---

## 8. Security and privacy requirements

Security is a release requirement, not a final polish task.

### 8.1 Authentication and session security

- Hash passwords using Argon2id with a maintained library and appropriate parameters.
- Never store plaintext passwords or raw refresh tokens.
- Use high-entropy refresh tokens, store only a suitable cryptographic hash or token identifier, rotate on refresh, and detect reuse.
- Expire sessions and revoke them after password changes or security-sensitive account actions according to policy.
- Validate JWT signature, algorithm, issuer/audience where configured, expiry, and required claims.
- Keep secrets in environment configuration or a secrets manager, not source control.
- Use secure cookies and CSRF defenses when relying on cookie-based authentication.
- Require HTTPS in production.

### 8.2 Authorization and content privacy

Enforce authorization in the backend for every read and write:

- Only owners or specifically authorized roles may modify or delete content.
- Private profiles and their content are accessible only under the platform's follow-approval rules.
- Blocking must have clearly defined effects on profiles, search, follows, comments, messaging, and notifications.
- Story viewers and private bookmarks are restricted to authorized users.
- Moderation endpoints require explicit permissions.
- Every conversation operation verifies the user's membership.
- IDs must never act as authorization; knowing a resource ID does not grant access.
- Authorization checks should be reused across feed, search, profile, and content endpoints to reduce privacy inconsistencies.

#### Authorization model (RBAC + ReBAC + ABAC)

Roles alone are not enough for an application where access depends on ownership, relationships, and context. Memora layers three models:

| Layer | Question | Examples |
|---|---|---|
| **RBAC** — platform staff permissions | Who can perform administrative actions? | Admin, moderator, support staff; permissions such as `reports:review`, `content:remove`, `users:suspend` |
| **ReBAC** — ownership and relationships | How is the user connected to this resource? | Own post, followed account, conversation participant, blocked user, story owner |
| **ABAC** — privacy and current state | Do current conditions allow this action? | Public/private profile, account status, story expiry, post visibility |

Viewing a post, for example, requires all of the following:

1. The viewer's account is allowed to access the platform.
2. The post exists and is not removed or otherwise restricted.
3. The post is public, or the viewer has the appropriate relationship with its owner.
4. The viewer is not blocked by the owner, and applicable privacy rules permit access.

Principles:

- Staff roles live in database tables (`roles`, `permissions`, `user_roles`, `role_permissions`), not in an editable `users.role` string. A single role string is acceptable only for a throwaway prototype.
- Ordinary authenticated users have no staff role; no explicit `member` role row is needed.
- Moderators' powers are limited to their granted permissions (and to the content they are responsible for, if scoped moderation is introduced). A moderator is not an administrator.
- If groups or creator communities are introduced later, add permissions scoped to those spaces rather than granting global access.
- Third-party/API access scopes (if introduced) are separate from internal staff permissions.
- Social relationship tables (`follows`, `follow_requests`, `blocks`) govern access to content and are not substitutes for staff roles.
- `admin` must not bypass privacy or safety rules automatically; sensitive exceptions (e.g. reading message content) are explicit, permission-gated, and audited.
- Deny by default; enforce on every protected request; keep checks in one reusable authorization layer.

### 8.3 Input and media safety

- Validate and normalize usernames, email addresses, captions, and text.
- Limit request sizes, upload sizes, video duration, and supported media formats.
- Do not trust the file extension or browser MIME type alone.
- Verify uploaded assets with the storage provider and, where applicable, inspect file signatures and scan content.
- Prevent arbitrary server-side URL fetching and unsafe file paths.
- Escape user-generated content appropriately in rendering contexts.
- Use safe Markdown or rich-text policies if formatted content is introduced.
- Avoid leaking signed media URLs, storage credentials, or provider secrets.
- Define reporting, removal, and abuse-handling procedures.

### 8.4 API and infrastructure protection

- Configure CORS for the intended frontend origins.
- Apply rate limiting to login, registration, search, messaging, and expensive endpoints.
- Use request timeouts and sensible database connection pool limits.
- Avoid unbounded feed, message, or search queries.
- Use transactions and constraints to prevent duplicate and inconsistent writes.
- Add structured logs and correlation IDs without logging secrets.
- Monitor application errors, database health, and background-job failures.
- Establish database backups and periodically test recovery.
- Define retention policies for media, messages, sessions, and audit data.

### 8.5 Privacy decisions that must be documented

Before release, explicitly decide:

- Whether public profiles and posts are visible to logged-out visitors.
- Whether users can message non-followers and how message requests work.
- How blocking affects existing conversations and previously shared content.
- Whether deleted messages disappear for everyone or only their author.
- Whether administrators can view message contents, and under which audited conditions.
- How account deletion affects retained messages, reports, and audit events.
- How users can report abuse and appeal moderation decisions.

These decisions should be written into a privacy and moderation policy and reflected in backend authorization tests.

---

## 9. Performance, reliability, and scalability

Start with a well-designed monolith and optimize based on measured bottlenecks.

### 9.1 Database performance

- Add indexes for the actual query patterns.
- Use cursor pagination for feeds, messages, notifications, and large lists.
- Avoid N+1 query patterns.
- Select only the fields needed by a response.
- Use transactions for related changes.
- Track slow queries and connection-pool saturation.
- Test migrations against production-like PostgreSQL.

### 9.2 Media delivery

- Deliver media through a CDN or media provider.
- Generate appropriate image sizes and responsive variants.
- Load feed images lazily.
- Use thumbnails and posters for videos.
- Upload large media directly to the provider using signed upload instructions.
- Keep media processing separate from latency-sensitive API requests.
- Handle upload failure, retries, abandoned intents, and orphan cleanup.

### 9.3 Background tasks

Background processing can handle:

- Story expiry and cleanup.
- Email verification and password-reset emails.
- Notification fan-out.
- Video processing.
- Media cleanup.
- Session expiry.
- Retryable integrations.

Use a durable queue or worker system when tasks must survive process restarts. FastAPI background tasks can be useful for lightweight work, but should not be the only mechanism for critical or long-running jobs.

### 9.4 Real-time communication

- Authenticate WebSocket connections.
- Authorize each conversation and event subscription.
- Reconnect with backoff.
- Support resynchronization after disconnects.
- Use persistent message history as the source of truth.
- Avoid relying on a WebSocket connection alone for delivery guarantees.
- Define message IDs and ordering behavior to handle duplicate events.

### 9.5 Reliability targets

Set measurable targets before production deployment. Initial proposed targets:

| Metric | Initial target |
|---|---|
| API availability | 99.5% monthly, once production monitoring is established |
| Typical API response time | p95 under 500 ms for ordinary database-backed endpoints under the agreed test load |
| Feed pagination | No unbounded queries; predictable cursor-based retrieval |
| Critical job reliability | Durable retries, visible failures, and recovery procedures |
| Data recovery | Documented backup schedule and tested restore procedure |
| Security | No known unresolved critical or high-severity release-blocking findings |

These are proposed objectives, not existing performance guarantees. Load testing should determine whether the targets are realistic for the deployment environment.

---

## 10. Testing strategy

### 10.1 Backend tests

**Unit tests**

- Domain policies and value objects.
- Use-case behavior.
- Validation and permission rules.
- Feed visibility decisions.
- Follow-request transitions.
- Story expiry rules.
- Refresh-token rotation and reuse detection.

**Integration tests**

- Repositories and PostgreSQL constraints.
- Transactions and rollback.
- Alembic migrations.
- Media-provider integration using controlled test doubles.
- Background-job persistence and retries.
- Redis-backed functionality where used.

**API tests**

- Request and response schemas.
- Authentication and role checks.
- Ownership and privacy enforcement.
- Pagination and filtering.
- Error envelopes and status codes.
- Rate limiting and upload validation.

### 10.2 Frontend tests

- Component tests with Vitest and React Testing Library.
- Form validation and error messages.
- Loading, empty, and error states.
- Route protection and session expiry behavior.
- API mutation and cache invalidation.
- Responsive navigation behavior.
- Accessible keyboard interaction.
- WebSocket reconnect and event reconciliation.

### 10.3 End-to-end tests

Use Playwright for complete user journeys:

1. Register and verify an account.
2. Log in and edit a profile.
3. Create a post and view it in the feed.
4. Like, comment, bookmark, and delete content.
5. Follow a public account.
6. Request to follow a private account and approve it.
7. Publish a story and verify expiry behavior.
8. Publish and play a Reel.
9. Send a message and verify conversation access rules.
10. Receive and mark notifications as read.
11. Report content and process the report with a moderator.
12. Attempt unauthorized actions and verify they are rejected.

### 10.4 Privacy and security regression tests

These are particularly important for a social platform:

- User A cannot edit or delete User B's content.
- A private post cannot be retrieved by an unauthorized user using its ID.
- Private content does not leak through search, hashtags, feeds, or recommendations.
- Blocked relationships are respected in all relevant features.
- Users cannot access another user's bookmarks or story-viewer list.
- Nonparticipants cannot read or subscribe to a conversation.
- Non-moderators cannot invoke moderation endpoints.
- Refresh-token reuse revokes the relevant session family according to policy.
- Duplicate likes, follows, and bookmarks are prevented.
- Expired stories cannot be retrieved even if a cleanup task has failed.
- A user without a required permission (e.g. `reports:review`) is denied; a user with it can act only within that permission's scope.
- Staff role and permission changes cannot be made through profile/account update endpoints, and are recorded in the audit trail.
- The `admin` role does not bypass privacy rules (e.g. private message contents) unless an explicit, audited exception exists.
- Moderators cannot grant themselves roles or exceed their assigned permissions.

### 10.5 Release quality gates

- All required automated tests pass.
- Frontend production build passes.
- Database migrations apply cleanly to an empty database and the supported upgrade path.
- PostgreSQL integration tests pass.
- No unresolved critical security issues.
- Error handling and structured logging work in production configuration.
- Backup and restore procedures have been exercised.
- Mobile and desktop layouts have been reviewed.

---

## 11. Development milestones

The milestones are ordered to reduce rework. They are not promises of fixed calendar durations.

### M1 — Foundation and architecture *(first priority)*

- Preserve existing core configuration, logging, and exceptions.
- Add database session and SQLModel metadata/base.
- Configure Alembic and PostgreSQL.
- Assemble FastAPI application, API router, health endpoint, and error handlers.
- Create Vite React TypeScript frontend with Tailwind CSS v4.
- Establish Memora design tokens, routing, API client, and test setup.

**Deliverable:** frontend and backend start locally, connect correctly, and pass initial tests.

### M2 — Authentication and account management

- User model and migration.
- Registration, login, refresh rotation, logout, and `/auth/me`.
- Password hashing, verification, reset, rate limiting, and session revocation.
- Role, Permission, UserRole, and RolePermission models and migrations, with seed data for initial staff roles.
- Reusable permission dependencies (e.g. `require_permission("reports:review")`).
- Login/register UI, session handling, and protected routes.

**Deliverable:** secure account lifecycle with API and browser tests.

### M3 — Profiles and social graph

- Profiles and privacy settings.
- Follow relationships and private-account requests.
- Blocking and relationship visibility rules.
- Shared resource-level authorization policies (ownership, follows, blocks, private content) reused by later features.
- Profile page, follow controls, follower/following lists.

**Deliverable:** users can establish and manage social connections safely.

### M4 — Media, posts, engagement, and feed

- Upload workflow and media metadata.
- Posts, likes, comments, bookmarks.
- Chronological feed and profile grid.
- Cursor pagination and authorization regression tests.

**Deliverable:** the first complete social-content experience.

### M5 — Stories and Reels

- Story publishing, expiry, and viewer tracking.
- Reel publishing and video playback.
- Processing status, media cleanup, and feed integration.

**Deliverable:** ephemeral content and short-form video.

### M6 — Messaging and notifications

- Conversations and message history.
- WebSocket authentication, delivery, and recovery.
- Notification persistence, unread counts, and preferences.
- Messaging and notification UI.

**Deliverable:** functional real-time communication backed by durable storage.

### M7 — Search and discovery

- User, post, and hashtag search.
- Mentions and hashtag indexing.
- Explore feed and discovery UI.
- Privacy regression tests across all search surfaces.

**Deliverable:** users can find permitted people and content.

### M8 — Moderation, hardening, and deployment

- Reports, moderation actions, and audit records.
- Admin workspace, role management, and permission-based checks with audited role changes.
- Load testing, observability, backup/restore, deployment, and release review.

**Deliverable:** production-oriented release candidate with operational documentation.

---

## 12. Acceptance criteria

Memora is considered ready for release only when the criteria below are satisfied.

### 12.1 Product acceptance

- [ ] Users can register, verify their email, sign in, refresh sessions, log out, and recover accounts.
- [ ] Users can create and edit profiles and configure privacy settings.
- [ ] Public and private follow workflows work correctly.
- [ ] Users can publish, edit, delete, like, comment on, and bookmark posts.
- [ ] The feed supports cursor pagination and displays only permitted content.
- [ ] Stories expire after 24 hours and expired stories cannot be accessed.
- [ ] Reels support publication, playback, and engagement.
- [ ] Users can exchange messages with authorized participants.
- [ ] Notifications persist, support unread counts, and update in real time where connected.
- [ ] Search supports users, posts, and hashtags without leaking restricted content.
- [ ] Users can report content and authorized moderators can review and act on reports.
- [ ] The application is usable on desktop and mobile browsers.

### 12.2 Engineering acceptance

- [ ] Clean architecture boundaries are maintained.
- [ ] Staff access uses database-backed roles and permissions; social access uses relationship and state-based policies; deny-by-default is enforced and tested.
- [ ] All database schema changes are represented by Alembic migrations.
- [ ] PostgreSQL integration tests pass.
- [ ] API schemas and OpenAPI documentation are maintained.
- [ ] Critical authorization and privacy regression tests pass.
- [ ] The frontend production build succeeds.
- [ ] Secrets are not committed to source control.
- [ ] Logs do not expose passwords, tokens, or other sensitive information.
- [ ] Background jobs handle retries and failures appropriately.
- [ ] Monitoring, deployment instructions, backup, and recovery procedures are documented.
- [ ] No unresolved release-blocking security issues remain.

### 12.3 Definition of done for every feature

A feature is not complete just because its UI appears to work. Each feature should include:

1. Database changes and migration, if needed.
2. Domain rules and application use case.
3. Repository or infrastructure implementation.
4. Request and response schemas.
5. API endpoint and authorization checks.
6. Frontend API integration and responsive UI.
7. Loading, empty, validation, and failure states.
8. Automated tests, including relevant privacy cases.
9. Logging and documentation where appropriate.

---

## 13. Deployment and environments

Maintain separate development, testing, and production configurations.

### Development

- FastAPI development server.
- Vite development server.
- Local PostgreSQL.
- Optional local Redis and a test media provider or isolated media account.
- `.env` for local secrets, excluded from version control.

### Testing

- Isolated PostgreSQL database.
- Predictable media-provider test doubles or dedicated test credentials.
- Automated migration and integration testing.
- Frontend component and browser tests.
- No real production email, payments, or destructive external actions.

### Production

- HTTPS and a properly configured reverse proxy.
- Application and worker processes with controlled resource limits.
- Managed PostgreSQL or a properly maintained PostgreSQL deployment.
- Durable background processing where required.
- CDN/media storage.
- Centralized logs, monitoring, alerts, backups, and tested recovery.
- Secure secret management and documented deployment/rollback procedures.

Docker can be introduced when the local development workflow is stable. It should simplify reproducibility rather than obscure how the application works.

---

## 14. Important technical decisions

These decisions should remain consistent unless a real requirement justifies changing them.

| Decision | Direction |
|---|---|
| Backend architecture | Clean architecture, modular monolith |
| Frontend | React + TypeScript + Vite |
| Staff dashboard | Separate `admin-frontend` app (same stack as the public frontend), deployed independently, using only authenticated FastAPI endpoints |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL |
| ORM and migrations | SQLModel + SQLAlchemy + Alembic |
| Authentication | Short-lived access tokens and rotating refresh sessions |
| Authorization | Hybrid: database-backed RBAC for staff, ReBAC for relationships, ABAC for privacy/state; deny by default; in-app policy layer (no external policy engine initially) |
| Media | Cloudinary or compatible storage provider |
| Feed pagination | Cursor-based |
| Realtime | WebSockets with persistent storage and recovery |
| Background processing | Durable worker system for critical jobs |
| Search | PostgreSQL initially |
| Testing | pytest, Vitest, React Testing Library, Playwright |
| Deployment | One backend application initially; extract services only when justified |

---

## 15. Immediate implementation plan

We should not try to implement all eight milestones at once. The next steps should establish a reliable foundation while preserving your current code.

### Already established

`app/core/config.py`, `app/core/logging.py`, and `app/core/exceptions.py` exist as the starting point. Keep these files and build around them.

### Next backend file: `app/infrastructure/database/session.py`

Create the SQLAlchemy engine, session factory, and database session dependency using the existing settings. Then add `database/base.py`, import table models for Alembic, and configure migrations.

### Frontend foundation

Create the Vite React TypeScript application, configure Tailwind CSS v4, establish Memora's design tokens, and build the application shell and routing.

### First complete feature: authentication

Implement the user persistence model, migration, registration, login, session lifecycle, API schemas, tests, and corresponding frontend screens.

### Authorization foundation

Alongside authentication, build the authorization layer in this order:

1. SQLModel database session and base metadata.
2. `User` model with account status and profile/privacy attributes.
3. `Role`, `Permission`, `UserRole`, and `RolePermission` models and migrations.
4. Reusable FastAPI dependencies such as `require_permission("reports:review")`.
5. Resource-level checks for post ownership, follows, blocks, and private content.
6. Audit logging, plus tests proving unauthorized users cannot access protected operations.

The exact file implementation should follow your current directory structure. Before introducing or moving files, we should verify what already exists so we don't duplicate modules or overwrite working code.

This PRD is the project specification. We can refer back to its requirements and acceptance criteria as each feature is implemented, tested, and completed.

---

## 16. Admin dashboard (admin-frontend)

**Memora Admin** is a separate internal staff application for administrators, moderators, and support staff. It lives in the `admin-frontend/` folder, uses React + TypeScript + Tailwind CSS v4, and connects to the existing FastAPI backend. It is **not** another social-media frontend: it is a secure operations console for managing reports, users, content moderation, platform health, staff permissions, and audit logs. This section extends the main platform PRD, which remains the source of truth for the whole platform.

### 16.1 Product vision

Build a polished, responsive, professional dashboard that enables authorized staff to operate Memora safely and efficiently. It must provide:

- A clear overview of platform activity and moderation workload.
- Fast, searchable workflows for reported content and accounts.
- Role-based navigation and action controls.
- Secure, auditable administrative operations.
- Consistent loading, empty, success, and error states.
- A design that feels like a modern SaaS operations platform rather than a generic template.

### 16.2 Staff roles

| Role | Main capabilities |
|---|---|
| Administrator | Platform administration, staff access, permissions, account actions, audit logs |
| Moderator | Review reports, moderate content, apply permitted enforcement actions |
| Support staff | Search accounts and assist with permitted account-related issues |
| Read-only analyst | View permitted analytics and reports without modifying data |

These are Memora's own proposed roles, implemented through the database-backed RBAC model in FR-16 and Section 8.2. Permissions must be enforced by FastAPI on every protected request. Ordinary Memora users must not be able to access the staff dashboard simply because they can sign in to the public application.

### 16.3 Functional requirements

#### AD-01 — Dashboard overview

- Show total users, new registrations, active accounts, published posts, and pending reports.
- Display recent moderation activity and workload summaries.
- Support date-range filters where the backend provides the data.
- Never fabricate metrics when the API returns no data.

#### AD-02 — Report management

- List reports with pagination, search, and filters by status, reason, and date.
- View the reported content, reporting user, reported account, and relevant context the staff member is authorized to see.
- Assign or claim reports, where supported by the backend.
- Dismiss invalid reports or take an authorized moderation action.
- Track pending, under-review, action-taken, dismissed, and other defined report states.

#### AD-03 — Content moderation

- Inspect reported posts, comments, and profiles.
- Remove or restore content only when the API supports the action and the staff member has permission.
- Require a reason for significant enforcement actions.
- Confirm destructive actions before submission.
- Display the result and record the action in the audit history.

#### AD-04 — User management

- Search by username or other permitted account identifiers.
- View account status, profile information, and relevant moderation history.
- Suspend, restrict, or restore accounts according to the available backend policies.
- Support reasoned decisions and confirmation dialogs.
- Prevent staff from changing protected fields through unrestricted profile editing.

#### AD-05 — Staff and permission management

- Display staff roles and their permissions.
- Allow authorized administrators to grant and revoke roles.
- Prevent unauthorized staff from granting themselves elevated permissions.
- Require confirmation for sensitive role changes.
- Record permission changes in audit logs.

#### AD-06 — Analytics and platform health

- Show user-growth and content-activity trends where supported.
- Summarize report volume, resolution time, and moderation outcomes.
- Display API or background-job health only when reliable monitoring endpoints exist.
- Restrict sensitive operational information to authorized staff.

#### AD-07 — Audit logs

- List sensitive administrative and moderation events.
- Include actor, action, target, timestamp, and outcome when available.
- Support filters by actor, event type, target, and date.
- Make audit records read-only in the admin interface.

#### AD-08 — Administration settings

- Provide a central location for supported platform settings.
- Restrict each setting to its authorized permission.
- Validate input and show clear success or failure messages.
- Never expose environment variables, secrets, database credentials, or signing keys in the UI.

### 16.4 Pages and routing

The application uses a persistent sidebar on desktop, a responsive navigation drawer on mobile, and a shared page header.

| Route | Page | Access |
|---|---|---|
| `/login` | Staff sign-in | Public route; staff authentication required afterward |
| `/` | Overview dashboard | Authorized staff |
| `/reports` | Reports queue | `reports:read` |
| `/reports/:reportId` | Report details | `reports:read` |
| `/moderation` | Content moderation | Appropriate moderation permissions |
| `/users` | User search and management | `users:read` |
| `/users/:userId` | User details | `users:read` |
| `/staff` | Staff and role management | `staff:manage` |
| `/analytics` | Platform analytics | `analytics:read` |
| `/audit-logs` | Audit event history | `audit:read` |
| `/settings` | Platform settings | `settings:read` or specific setting permissions |
| `/403` | Access denied | Authenticated users without access |
| `*` | Not found | All users |

These routes define the frontend plan; they are not a claim that the corresponding backend endpoints already exist. Connect each page only when its API contract is implemented. Permission codes used here (e.g. `reports:read`, `staff:manage`) must be reconciled with the permission codes seeded in the backend (e.g. `reports:review`, `content:remove`, `users:suspend`) so there is a single permission vocabulary.

### 16.5 Technology stack

Use the same frontend foundation as the public Memora app so development practices remain consistent.

| Area | Technology |
|---|---|
| Framework | React + TypeScript |
| Build tool | Vite |
| Styling | Tailwind CSS v4 |
| Routing | React Router |
| Server state and caching | TanStack Query |
| HTTP client | Axios |
| Forms | React Hook Form + Zod |
| Icons | Lucide React |
| Testing | Vitest + React Testing Library |
| Browser testing | Playwright |
| Backend | Existing FastAPI API |
| Database | PostgreSQL through the backend |

The admin frontend must not connect directly to PostgreSQL. All reads and changes go through authenticated API endpoints.

### 16.6 Folder structure

```
admin-frontend/
├── public/
├── src/
│   ├── main.tsx
│   ├── app/
│   │   ├── App.tsx
│   │   ├── router.tsx
│   │   └── providers.tsx
│   ├── layouts/
│   │   ├── AdminLayout.tsx
│   │   └── AuthLayout.tsx
│   ├── components/
│   │   ├── ui/
│   │   ├── navigation/
│   │   ├── tables/
│   │   ├── charts/
│   │   ├── forms/
│   │   └── feedback/
│   ├── features/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── reports/
│   │   ├── moderation/
│   │   ├── users/
│   │   ├── staff/
│   │   ├── analytics/
│   │   ├── audit-logs/
│   │   └── settings/
│   ├── services/
│   │   ├── api-client.ts
│   │   └── endpoints/
│   ├── hooks/
│   ├── lib/
│   ├── types/
│   └── styles/
│       └── index.css
├── tests/
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

Keep API services, reusable UI components, and individual feature pages separate. Don't create all the files at once; build and verify them incrementally.

### 16.7 Security requirements

Security is a core requirement, not a future enhancement.

- Backend authorization is authoritative. Every protected API request must check the user's current permissions and applicable resource rules.
- Use the existing authentication system where possible. Decide explicitly whether staff use the same login system with additional permissions or a separate staff authentication policy.
- Do not rely on a hidden sidebar item or disabled button to prevent unauthorized access.
- Do not store long-lived sensitive credentials in browser local storage without carefully evaluating the risks. Prefer secure, HttpOnly cookie-based refresh sessions when supported by the authentication design.
- Use confirmation dialogs for account suspension, content removal, and role changes.
- Do not allow the client to assign itself a role by submitting a modified request.
- Record sensitive actions in server-side audit logs.
- Avoid exposing private messages or private content to staff unless an explicit, audited policy permits the access.
- Test direct API requests from unauthorized users, not just navigation through the UI.

### 16.8 Design requirements

The dashboard should have a distinctive, professional SaaS admin aesthetic.

- Desktop-first information density, with responsive layouts for tablets and phones.
- Consistent spacing, typography, color tokens, and reusable components.
- Sidebar navigation with clear active states and permission-aware menu items.
- Tables with readable status indicators, search, filters, sorting, and pagination.
- Accessible dialogs, keyboard navigation, labels, focus states, and contrast.
- Clear loading skeletons, empty states, retry actions, and error messages.
- Confirmation for destructive actions and visible feedback after successful operations.
- Avoid excessive gradients, decorative cards, and unnecessary animations that make operational work slower.

### 16.9 Testing requirements

Before releasing each feature, test:

- Correct display of API data, including empty and error responses.
- Loading, retry, and pagination behavior.
- Form validation and destructive-action confirmations.
- Route protection and permission-based navigation.
- API rejection when a staff member lacks the required permission.
- Prevention of unauthorized role escalation.
- Audit logging for sensitive actions.
- Responsive layouts and keyboard accessibility.

### 16.10 Implementation milestones

| # | Milestone | Scope |
|---|---|---|
| A1 | Foundation | Initialize Vite, React, TypeScript, Tailwind v4, routing, shared layout, API client, and environment configuration. |
| A2 | Authentication and permissions | Connect staff sign-in, session handling, current-user permissions, protected routes, and access-denied states. |
| A3 | Dashboard and reports | Build the overview, report queue, report details, filters, and moderation workflow. |
| A4 | Users and staff management | Implement account search, authorized enforcement actions, role assignment, and permission-aware screens. |
| A5 | Analytics and audit | Add operational metrics, audit history, and supported settings. |
| A6 | Hardening and release | Complete authorization tests, responsive and accessibility checks, production environment configuration, and deployment. |

Build the admin foundation only after the backend authentication and permission contracts (main milestones M2 and M8) are defined, so the UI does not depend on imaginary endpoints.

### 16.11 Acceptance criteria

The first production-ready admin release is acceptable when:

- [ ] Staff can sign in and access only the screens and API actions permitted by their roles.
- [ ] Reports can be reviewed and processed through supported backend workflows.
- [ ] User and content actions require the appropriate permissions and confirmations.
- [ ] Sensitive administrative actions are auditable.
- [ ] The application handles expired sessions, API errors, and unavailable services gracefully.
- [ ] The dashboard is responsive and accessible.
- [ ] Automated tests cover critical UI workflows and backend authorization boundaries.
- [ ] The application uses environment-specific API configuration and can be deployed independently of the public frontend.
