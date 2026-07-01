# 📬 Notifications Service — Project Plan

> Locked design for the Event-Driven CAP learning project.
> This document is the source of truth for what we're building
> and — equally important — what we're deliberately NOT building
> in the first session.

---

## 🎯 Learning Goals

- Event-driven CAP patterns (`cds.emit()` + `cds.on()`)
- CAP in-process Outbox pattern (transactional event persistence)
- Idempotency via event-ID deduplication
- Fan-out pattern (one event → multiple derived notifications)
- Domain-actions-emit-events pattern

## 🏗️ Architecture

- **Layout:** Monorepo, sibling `notifications-srv/` next to `srv/`
- **Runtime:** Single CAP Node process, both services share the runtime
- **Transport:** CAP in-process Outbox (SAP-standard, persistent, retry-safe)
- **Delivery:** Mock via `cds.log` (real ANS/SendGrid deferred to future sessions)

```
Library CAP runtime (single process)
├── CatService (existing)
│   ├── borrowBook action → cds.emit('BookBorrowed')
│   └── returnBook action → cds.emit('BookReturned')
├── Outbox (in-process, persistent table)
└── NotificationsService (new)
    ├── on('BookBorrowed') → dedup + fan-out + mock deliver
    └── on('BookReturned') → dedup + fan-out + mock deliver
```

## 📊 Data Model

Two entities in `db/notifications-schema.cds` under `context Notifications`:

### `RawEvents` — Immutable event log
- `eventId` (unique — enables dedup)
- `eventType`, `payload` (JSON), `receivedAt`, `processedAt`, `processingError`

### `Notifications` — Derived user-facing records
- `recipient`, `recipientType` (MEMBER / ADMIN)
- `type`, `title`, `message`
- `relatedBook` (assoc), `sourceEvent` (assoc to RawEvents)
- `isRead`, `createdAt`, `readAt`

## 🎬 Events (Session 1)

| Event | Trigger | Fan-out |
|---|---|---|
| `BookBorrowed` | `CatService.borrowBook(book_ID, member_ID)` | Member notification + Admin notification |
| `BookReturned` | `CatService.returnBook(loan_ID)` | Member notification + Admin notification |

**LoanOverdue is intentionally deferred** — needs verified scheduler path first.

## 🖥️ Frontend

Single minimal Fiori Elements List Report:
- Path: `app/notifications-ui/`
- Entity: `NotificationsService.Notifications`
- Columns: recipient, type, title, message, isRead, createdAt
- Filters: recipient, isRead
- Action: `markAsRead`

## 🚫 Explicitly Out Of Scope

Deferred to future sessions — not lost, just not now:

- **LoanOverdue + scheduler** → Session after scheduler verification
- **Real email delivery (SAP Alert Notification Service)** → session `ND1`
- **Real email delivery (SendGrid/SMTP)** → session `ND2`
- **Event Mesh migration** (from in-process Outbox) → session `ET1`
- **Cross-project deploy** (Notifications as separate CF app) → session `ET2`
- **Notification preferences** (opt-in/out) → future session
- **Event replay** (reprocess past events) → future session
- **CPI Integration Suite** → independent `CPI1-CPI2` sprint (Accenture tenant access)
- **FLP integration** → future FLP session (blocked on IAS trust)
- **Auth (`@requires`)** → aligned with Library `xs-security` session
- **Object Page for Notifications** → only if genuinely useful

## 📏 Session Breakdown

**Session 1a (today):** Backend
- Schema + service definition + actions + handlers + local test

**Session 1b (next):** Frontend
- Fiori LR app + markAsRead action + end-to-end test

**Total estimate:** ~4-4.5 hours across both sessions.