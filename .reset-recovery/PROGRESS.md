# Progress Log

> Append-only session log. Add a new entry at the **top** after every session.
> When picking up next time, the top entry tells you exactly where to resume.

---

## 2026-07-01 — FLP Attempt + Notifications Planning

**Time spent:** ~1h 15min (planning phase)
**Focus:** Managed FLP attempt (blocked), then pivoted to Notifications planning

**Done:**
- ✅ Verified sandbox FLP works via `cds watch` at `/com.dhruv.listobjectlibrary/test/flp.html`
- ✅ Added `crossNavigation.inbounds` to `list_object_library` manifest (kept, useful for later)
- ✅ Full Notifications project plan locked — see `notifications/PLAN.md`
- ✅ All 7 architecture decisions documented with reasoning

**Blocked:**
- ❌ **Managed FLP (Work Zone)** requires SAP Cloud Identity Services (IAS) tenant + OIDC trust — not configured on trial subaccount
  - Marked as deferred to dedicated session that covers IAS provisioning, OIDC trust setup, first CF deploy, then Work Zone site setup

**Decisions locked for Notifications Session 1:**
- Layout A (monorepo, sibling srv), schema in separate file (A2)
- 2 events: BookBorrowed, BookReturned (LoanOverdue deferred)
- Trigger via new `borrowBook` + `returnBook` actions on Library service
- Data model: Archetype C (RawEvents log + derived Notifications with fan-out)
- Fan-out: notify member + admin
- Transport: CAP in-process Outbox
- Idempotency: event-ID unique constraint on RawEvents
- Delivery: mock via `cds.log` (real integrations deferred to future sessions)
- Frontend: minimal Fiori LR with markAsRead action

**Next in this session (Phase 1 kickoff):**
1. Create `db/notifications-schema.cds`
2. Create `notifications-srv/notifications-service.cds`
3. Add `borrowBook` + `returnBook` actions to Library
4. Wire cds.emit() + configure Outbox
5. Write cds.on() handlers with dedup + fan-out
6. Test via test.http

**Deferred to future sessions:**
- Managed FLP (needs IAS + first CF deploy)
- Notifications frontend (Session 1b)
- All items listed as "Out Of Scope" in `notifications/PLAN.md`

---

## Template For Next Entry

```
## YYYY-MM-DD — [Sprint name]

**Time spent:** Xh
**Focus:** [one line]

**Done:**
- ✅ ...

**Blocked / Deferred:**
- ...

**Next session priorities:**
1. ...
```