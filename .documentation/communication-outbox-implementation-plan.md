# Communication Outbox & Resilient Email Delivery — Implementation Plan

**Status:** Proposed
**Owner:** TBD
**Last updated:** 2026-05-19

## Acronyms

| Acronym | Meaning |
| --- | --- |
| ACS | Azure Communication Services |
| ASB | Azure Service Bus |
| DB | Database |
| DI | Dependency Injection |
| DKIM | DomainKeys Identified Mail |
| DLQ | Dead-Letter Queue |
| DMARC | Domain-based Message Authentication, Reporting, and Conformance |
| DNS | Domain Name System |
| EF / EF Core | Entity Framework Core |
| GA | General Availability |
| PII | Personally Identifiable Information |
| POCO | Plain Old CLR Object |
| SPF | Sender Policy Framework |
| TTL | Time To Live |
| UX | User Experience |
| VDAB | Xorbix Visual Databricks App Builder |
| 2FA | Two-Factor Authentication |

## 1. Background

Today, all outbound email in VDAB flows synchronously through `EmailSenderService` directly into the Azure Communication Services (ACS) `EmailClient`. There is no persistence, no queue, no retry, and no observability beyond log lines. Specifically:

- `TenantInviteService.CreateInvitesAsync` calls `SendInviteEmailSafeAsync` inline after `AddRangeAsync`. A crash between the DB commit and the ACS call drops the email permanently.
- `VerificationChallengeService.SendVerificationCodeAsync` stores the code in the distributed cache with an absolute expiration of `UtcNow + 5 minutes`, **then** calls `_emailSender.SendVerificationCodeAsync`. The TTL clock starts before ACS has even accepted the message.
- Billing notifications (`SendBillingPaymentFailedAsync` etc.) are fired from Stripe webhook handlers with the same direct-call shape.

This creates three risks at production scale:

1. **ACS throttling.** Default ACS Email limits are ~10 messages/second per resource and a daily quota; bursts (large invite batches, billing webhook storms) generate 429s that we silently log and drop.
2. **Lost messages.** Any transient ACS failure, app restart mid-send, or network blip permanently loses the email — there is no record we ever tried.
3. **Inaccurate 2FA UX.** Code TTL starts before delivery; users on a slow mail path effectively get less than the advertised 5 minutes.

## 2. Goals

- **Durable**: Every email request is persisted before any send is attempted. No email is lost to a process crash or ACS outage.
- **Resilient**: Transient ACS failures (429s, 5xx, network) are retried with exponential backoff. Permanent failures attributable to the sender domain (reputation, domain-config, content-policy rejections, hard suppression on that domain) fall back to the Azure-managed sender domain before being quarantined. Other permanent failures (malformed recipient, recipient hard-bounce) are quarantined immediately. Quarantined messages are not retried and are surfaced for human review.
- **Prioritized**: Authentication-class messages (2FA, password reset, email confirmation) are never blocked behind transactional or bulk messages.
- **Observable**: Every message has a queryable lifecycle: `Pending → Dispatched → Sent → Delivered` (or `Failed / DeadLettered`), with timestamps and a stable correlation id.
- **Accurate 2FA TTL**: The 5-minute code expiration starts when ACS accepts the send, not when the user clicks the button.
- **No new dual-write bugs**: Outbox write and business write share a DB transaction. The broker enqueue happens *after* the DB commit, from a background dispatcher.

## 3. Non-goals

- Replacing ACS as the email provider.
- Building a separate "retry bus." Retries are handled by the same broker (Service Bus) using scheduled redelivery and DLQ.
- Building a user-facing email preferences / unsubscribe center (separate effort).
- Supporting non-email channels (SMS, push) — but the schema and queue topology are designed so adding them later is additive.

## 4. Architecture

```
┌──────────────────────┐    DB tx     ┌───────────────────────┐
│  Caller (Service)    │ ───────────▶ │  Postgres: business   │
│  e.g. InviteService  │              │  + CommunicationOutbox│
└──────────┬───────────┘              └───────────┬───────────┘
           │                                       │
           │  (no direct ACS call)                 │ polled
           ▼                                       ▼
                                          ┌──────────────────┐
                                          │ OutboxDispatcher │
                                          │ (HostedService)  │
                                          └────────┬─────────┘
                                                   │ enqueue
                              ┌────────────────────┼────────────────────┐
                              ▼                    ▼                    ▼
                   ┌────────────────────┐ ┌──────────────────┐ ┌──────────────┐
                   │ sb://comm-auth     │ │ sb://comm-trans  │ │ sb://comm-   │
                   │ (2FA, pw reset,    │ │ (invites, billing│ │ bulk         │
                   │  email confirm)    │ │  welcome)        │ │ (future)     │
                   └──────────┬─────────┘ └─────────┬────────┘ └──────┬───────┘
                              │                     │                 │
                              ▼                     ▼                 ▼
                     ┌────────────────────────────────────────────────────┐
                     │ EmailWorker (HostedService, per-queue concurrency) │
                     │  - token-bucket rate limiter (per ACS resource)    │
                     │  - classifies failures: transient vs            │
                     │      sender-domain-permanent vs hard-permanent    │
                     │  - on sender-domain-permanent: swap to fallback   │
                     │      domain and re-enqueue                        │
                     │  - on transient: schedule redelivery w/ backoff    │
                     │  - on permanent: complete + mark outbox Failed     │
                     │  - on success: mark outbox Sent, store OperationId │
                     └─────────────────────┬──────────────────────────────┘
                                           │
                                           ▼
                                   ┌──────────────┐
                                   │ Azure        │
                                   │ Communication│
                                   │ Services     │
                                   └──────┬───────┘
                                          │
                                          ▼ (async, minutes later)
                                   ┌──────────────┐
                                   │ Event Grid:  │
                                   │ Delivery /   │
                                   │ Bounce /     │
                                   │ Engagement   │
                                   └──────┬───────┘
                                          │ webhook
                                          ▼
                                ┌────────────────────────┐
                                │ Event Grid receiver    │
                                │ updates outbox row     │
                                │ Sent → Delivered /     │
                                │ Sent → Bounced         │
                                └────────────────────────┘
```

### 4.1 Components

| Component | Project | Type |
| --- | --- | --- |
| `CommunicationOutbox` entity + repository | `DataAccess` / `Models` | EF + repo pair |
| `ICommunicationOutboxService` | `Services` | New service. The **only** entry point callers use to request a send. |
| `EmailSenderService` (existing) | `Services` | **Internalized.** No longer called by callers — only by `EmailWorker`. Renamed to `EmailDeliveryService` (or kept, but visibility scoped). |
| `CommunicationOutboxDispatcher` | `Services` | `BackgroundService`. Polls `Pending` rows, enqueues to Service Bus, marks `Dispatched`. |
| `EmailWorker` | `Services` | `BackgroundService` per queue (`auth`, `transactional`, `bulk`). Pulls messages, calls `EmailDeliveryService`, updates outbox. |
| `AcsEventGridController` | `Server` | Webhook endpoint receiving ACS delivery/bounce/engagement events. Updates outbox. |
| Azure Service Bus namespace + 3 queues | infra (AppHost / Bicep) | New. Three queues with per-queue settings. |

### 4.2 Queues

Three queues, not priorities on one queue. Service Bus has no native message priority — separate queues with dedicated worker pools is the canonical pattern.

| Queue | Class | MaxDeliveryCount | Lock duration | TTL | Worker concurrency |
| --- | --- | ---: | --- | --- | ---: |
| `comm-auth` | 2FA, password reset, email confirmation, email change | 5 | 1 min | 1 hour | 16 |
| `comm-transactional` | Tenant invites, welcome, billing notifications, duplicate registration, admin password reset | 10 | 2 min | 24 hours | 8 |
| `comm-bulk` | (Reserved — no current senders) | 10 | 2 min | 72 hours | 4 |

Each queue has its own DLQ (automatic on ASB) and its own ACS rate budget so a bulk surge cannot starve 2FA.

## 5. Data model

### 5.1 `CommunicationOutbox` table (schema: `comm`)

```
Id                  uuid                  PK
CorrelationId       uuid                  not null  -- stable across retries, attached to ASB MessageId
Channel             varchar(16)           not null  -- 'Email' for now
Priority            varchar(16)           not null  -- 'Auth' | 'Transactional' | 'Bulk' (drives queue selection)
TemplateKey         varchar(64)           not null  -- e.g. 'VerificationCode.html'
RecipientEmail      varchar(256)          not null
RecipientUserId     uuid                  null
TenantId            uuid                  null
Subject             varchar(256)          not null
PayloadJson         jsonb                 not null  -- template replacements + any required context
Status              varchar(24)           not null  -- Pending | Dispatched | Sent | Delivered | Bounced | Failed | DeadLettered | Suppressed
AttemptCount        int                   not null default 0
NextAttemptAt       timestamptz           null
LastError           text                  null
LastErrorClass      varchar(24)           null      -- 'Transient' | 'SenderDomainPermanent' | 'HardPermanent' | null
SenderDomain        varchar(64)           not null  -- 'vdab.ai' (primary) | '<azure-managed>' (fallback). Current domain in use for the next attempt.
SenderDomainAttempts jsonb                not null default '[]' -- audit trail: [{domain, attemptCount, lastError, failedAt}]
FallbackUsed        boolean               not null default false  -- true once we have switched to the Azure-managed domain
AcsOperationId      varchar(64)           null      -- from EmailSendOperation.Id, used to reconcile Event Grid events
EnqueuedAt          timestamptz           null      -- when dispatcher pushed to ASB
SentAt              timestamptz           null      -- when ACS accepted (Status -> Sent). 2FA TTL anchors here.
DeliveredAt         timestamptz           null      -- when Event Grid reported delivered
FailedAt            timestamptz           null
CreatedOn           timestamptz           not null
ModifiedOn          timestamptz           not null
```

Indexes:
- `(Status, Priority, CreatedOn)` — dispatcher poll path.
- `(AcsOperationId)` — Event Grid reconciliation.
- `(CorrelationId)` — log/UX lookups.
- `(RecipientEmail, CreatedOn DESC)` — admin/support queries.
- `(SenderDomain, Status, CreatedOn)` — domain-health dashboards and bounce-rate alerts per domain.

### 5.2 Status machine

```
            ┌──────────────────────────────────────────┐
            ▼                                          │
[Pending] ─► [Dispatched] ─► [Sent] ─► [Delivered]    │
    │            │            │           │           │
    │            │            │           ▼           │
    │            │            │       (terminal OK)   │
    │            │            ▼                       │
    │            │       [Bounced]  (terminal, perm.) │
    │            │            │                       │
    │            ▼            ▼                       │
    │      [Failed: transient] ──── retry (NextAttemptAt set, back to Dispatched)
    │            │
    │            ▼
    │      [Failed: sender-domain-permanent]
    │            │
    │            ├── if FallbackUsed = false ─► swap SenderDomain to Azure-managed,
    │            │                              reset AttemptCount for the new domain,
    │            │                              FallbackUsed = true, back to [Dispatched]
    │            │
    │            └── if FallbackUsed = true ──► [Quarantined]
    ▼            
[Quarantined]          [DeadLettered]  (terminal, requires human)
```

`Quarantined` replaces the old terminal "Failed: permanent" state. It is reached either (a) immediately on a hard-permanent failure (malformed recipient, recipient hard-bounce — domain swap would not help) or (b) after the Azure-managed fallback domain has also exhausted its retries with a sender-domain-permanent failure.

`Suppressed` is a pre-send terminal state set when the recipient is on the ACS suppression list (looked up before enqueue).

## 6. API and call-site changes (no code in this doc — descriptive)

### 6.1 New service contract

```csharp
public interface ICommunicationOutboxService
{
    Task<Result<Guid>> EnqueueEmailAsync(
        EmailEnvelope envelope,
        CommunicationPriority priority,
        CancellationToken ct = default);
}
```

`EmailEnvelope` carries: template key, recipient, subject, payload dictionary, optional correlation id, optional tenant/user context. The method does **only** the DB insert (status `Pending`) inside the caller's `TransactionScope`. It does **not** touch Service Bus.

### 6.2 Call-site migration

Every existing direct call to `IEmailSenderService` is replaced with a call to `ICommunicationOutboxService.EnqueueEmailAsync`. Concrete sites:

| Caller | Today | After |
| --- | --- | --- |
| `VerificationChallengeService.SendVerificationCodeAsync` | `_emailSender.SendVerificationCodeAsync` | Enqueue with `Priority.Auth`. **TTL anchoring change (see §8).** |
| `TenantInviteService.CreateInvitesAsync` / `ResendInviteAsync` | `SendInviteEmailSafeAsync` | Enqueue with `Priority.Transactional`. |
| Registration / email confirmation flows | `SendConfirmationEmailAsync`, `SendConfirmationLinkAsync` | `Priority.Auth`. |
| `SendPasswordResetCodeAsync`, `SendPasswordResetLinkAsync`, `SendAdminPasswordResetAsync` | direct | `Priority.Auth`. |
| `SendWelcomeEmailAsync`, `SendDuplicateRegistrationAttemptAsync`, `SendEmailChangeConfirmationAsync` | direct | `Priority.Transactional`. |
| Stripe billing notifications (`SendBillingPaymentFailedAsync` etc.) | direct | `Priority.Transactional`. |

`IEmailSenderService` is **not** deleted. It is repositioned as the internal "render + call ACS" helper used exclusively by `EmailWorker`, and its DI registration changes to internal scope.

## 7. Dispatcher and worker behavior

### 7.1 `CommunicationOutboxDispatcher`

- Background service, single instance per app instance (idempotent via row-level locks).
- Every N ms (configurable, default 500 ms) selects up to `BatchSize` rows where `Status = Pending OR (Status = Failed AND LastErrorClass = 'Transient' AND NextAttemptAt <= now())`, ordered by `Priority` then `CreatedOn`.
- Uses Postgres `SELECT … FOR UPDATE SKIP LOCKED` so multiple app instances can run safely.
- For each row: builds the ASB message (with `MessageId = Id`, enabling ASB's built-in duplicate detection), publishes to the queue matching `Priority`, updates row to `Dispatched` with `EnqueuedAt = now()`.

### 7.2 `EmailWorker` (one per queue class)

- `ServiceBusProcessor` with concurrency from §4.2.
- For each message:
	1. Load the outbox row by `Id`. If status is already `Sent` or terminal, complete the message (idempotency on worker crash).
	2. Check ACS suppression list. If suppressed → status `Suppressed`, complete message.
	3. Enforce **client-side rate limit** (token bucket per ACS resource, sized at 8 msg/s to leave headroom under the 10 msg/s ACS limit).
	4. Call `EmailDeliveryService.SendAsync(envelope)`.
	5. **On success**: store `AcsOperationId`, set `Status = Sent`, `SentAt = now()`, `AttemptCount += 1`, complete message.
	6. **On transient failure** (429 with `Retry-After`, 5xx, network, `OperationStatus.NotStarted` after timeout): set `Status = Failed`, `LastErrorClass = Transient`, compute `NextAttemptAt = now() + backoff(AttemptCount)` (exponential with jitter, capped at 10 min; honor `Retry-After` if present), increment attempt count, **abandon** the ASB message (or complete + rely on dispatcher to re-enqueue — pick one and stay consistent; recommendation: complete + dispatcher re-enqueue, keeps backoff visible in DB).
	7. **On sender-domain-permanent failure** (see §7.4 for classification): append the current attempt to `SenderDomainAttempts`. If `FallbackUsed = false`, swap `SenderDomain` to the configured Azure-managed domain, set `FallbackUsed = true`, reset `AttemptCount = 0`, `LastErrorClass = null`, `Status = Pending`, `NextAttemptAt = now()`, complete the ASB message (dispatcher will re-enqueue under the new domain). Emit `comm.outbox.domain_fallback` metric. If `FallbackUsed = true` (the fallback domain also hit a sender-domain-permanent failure), set `Status = Quarantined`, `LastErrorClass = SenderDomainPermanent`, `FailedAt = now()`, complete message, emit alert metric.
	8. **On hard-permanent failure** (malformed recipient address, recipient hard-bounce, ACS suppression hit mid-send — failures where swapping the sender domain cannot help): `Status = Quarantined`, `LastErrorClass = HardPermanent`, `FailedAt = now()`, complete message, emit alert metric.
	9. **On MaxDeliveryCount exhaustion**: ASB moves message to DLQ automatically. A separate DLQ-monitor service marks the outbox row `DeadLettered` and raises an alert.

### 7.3 Backoff policy

`backoff(n) = min(2^n * 1s, 10 min) ± 25% jitter`, overridden by `Retry-After` header when present. Auth queue uses a tighter cap (max 2 min) so 2FA codes don't backoff past their own TTL.

### 7.4 Failure classification

The worker maps every ACS / transport error into exactly one of three classes. The mapping is the single source of truth for retry, fallback, and quarantine behavior.

| Class | Examples | Action |
| --- | --- | --- |
| `Transient` | HTTP 429, 5xx, network timeout, `OperationStatus.NotStarted` after timeout, ACS internal `ServiceUnavailable` | Retry on same domain with backoff (§7.3). |
| `SenderDomainPermanent` | HTTP 403 with sender/domain reason, sender domain not verified, sender domain reputation block, content rejected by sender-side policy, `EmailDeliveryReportReceived` status `Failed`/`Bounced` with classification `SenderRejected` / `PolicyViolation`, suppression hit on the *sender's* domain | If primary domain: swap to fallback domain and re-enqueue. If already on fallback: quarantine. |
| `HardPermanent` | HTTP 400 malformed recipient, recipient hard-bounce (`InvalidAddress`, `MailboxFull` after retries), `EmailDeliveryReportReceived` status `Bounced` with classification `RecipientNotFound` / `InvalidRecipient`, ACS suppression list hit on recipient | Quarantine immediately. Domain swap cannot help. |

Classification lives in a single helper (`EmailFailureClassifier`) so it is testable in isolation and so the inputs from synchronous ACS responses and asynchronous Event Grid reports both funnel through the same logic.

### 7.5 Sender-domain fallback

Two domains are configured:

- **Primary**: `vdab.ai` (custom domain attached to the ACS resource).
- **Fallback**: the Azure-managed domain (`<random>.azurecomm.net`-style) provisioned automatically with the ACS resource.

Rules:

- Every new outbox row is created with `SenderDomain = vdab.ai`, `FallbackUsed = false`.
- The fallback path is one-way: once `FallbackUsed = true`, the row never returns to the primary domain. (A nightly retry of failed rows is **not** in scope; resends are explicit, see §7.6.)
- The fallback applies per-message, not globally. We do not flip an entire queue to the fallback domain on a single bad message — but we *do* monitor the per-domain bounce rate (§12) and a kill-switch (§15) can temporarily route all new sends through the fallback if `vdab.ai` is in a reputation incident.
- Templates must render correctly under both domains. The `From:` display name stays the same; only the address changes. Verify before Phase F ships.
- Auth-class messages use the same fallback policy, but because Auth TTLs are tight, the worker performs the domain swap and re-dispatch synchronously (without going back through the dispatcher poll loop) when the current message is on the `comm-auth` queue. The row is still updated atomically.

### 7.6 Operator resend from quarantine

Quarantined rows are inspected via the admin UI (§14, Phase E). An operator can:
- Mark a quarantined row "resend on fallback" — creates a *new* outbox row, copying payload, with `SenderDomain = <azure-managed>`, `FallbackUsed = true`, same `CorrelationId`.
- Mark a quarantined row "resend on primary" (only meaningful after fixing the underlying domain issue) — creates a new row with `SenderDomain = vdab.ai`, `FallbackUsed = false`.

This keeps the audit trail intact (the original quarantined row is preserved) and avoids ad-hoc DB edits.

## 8. 2FA TTL anchoring

Current behavior: TTL clock starts at `UtcNow` in `SendVerificationCodeAsync` *before* the email is sent.

New behavior:

1. `VerificationChallengeService` generates the code and inserts it into the cache with status `PendingSend` and a **provisional** absolute expiration of `now + send_timeout + code_ttl` (e.g., `now + 30s + 5min`). This keeps the code from living forever if the send never completes.
2. It enqueues the email via `ICommunicationOutboxService` with `Priority.Auth` and stores the outbox `CorrelationId` alongside the cached code entry.
3. The API response to the user includes the *provisional* expiration, with a UI hint "expires 5 minutes after delivery."
4. When `EmailWorker` flips the outbox row to `Sent`, a post-send hook (either a transactional outbox event or a direct cache update keyed by `CorrelationId`) updates the cached code's absolute expiration to `SentAt + 5 min`. If the user is still on the verification screen, the frontend polls a small endpoint (or uses an existing one) to refresh the countdown.
5. If the send fails permanently before `Sent`, the code is invalidated and the UX prompts to request a new one.

**Tradeoff acknowledged**: "Sent" means ACS accepted, not that the user received it. The strict version (anchor to Event Grid `Delivered`) is feasible later but adds UX complexity (a "sending…" → "sent" → "delivered" state) and depends on Event Grid latency. We start with `Sent` anchoring; revisit if delivery latency is measurably bad.

## 9. Event Grid integration (delivery / bounce / engagement)

- Configure ACS to publish `Microsoft.Communication.EmailDeliveryReportReceived` and `Microsoft.Communication.EmailEngagementTrackingReportReceived` to an Event Grid topic.
- Subscribe a webhook in the `Server` project (`/api/webhooks/acs-email`) authenticated via Event Grid validation handshake + a shared secret / managed identity.
- On `Delivered`: outbox row → `Delivered`, `DeliveredAt = eventTime`.
- On `Bounced` / `Failed` / `Suppressed` / `FilteredSpam`: feed the event through `EmailFailureClassifier` (§7.4) using the bounce classification as input.
  - `Transient` → re-enqueue (Auth: tight cap; otherwise normal backoff).
  - `SenderDomainPermanent` → apply the fallback logic from §7.5 (swap to Azure-managed domain and re-enqueue, or quarantine if fallback was already used).
  - `HardPermanent` → outbox row → `Quarantined`, `FailedAt = eventTime`, `LastError = bounceClassification`. If recipient hard-bounce, also add the recipient to a local suppression cache so the dispatcher refuses future sends with `Status = Suppressed`.
- All lookups are keyed by `AcsOperationId`.

This is what gives us real delivery metrics and protects sender reputation.

## 10. Configuration

New section `Communication`:

```jsonc
"Communication": {
    "Outbox": {
        "DispatcherPollIntervalMs": 500,
        "DispatcherBatchSize": 100,
        "AcsClientRateLimitPerSecond": 8
    },
    "ServiceBus": {
        "Namespace": "...",
        "Queues": {
            "Auth": "comm-auth",
            "Transactional": "comm-transactional",
            "Bulk": "comm-bulk"
        }
    },
    "Senders": {
        "Primary": {
            "Domain": "vdab.ai",
            "FromAddress": "no-reply@vdab.ai",
            "DisplayName": "Xorbix VDAB"
        },
        "Fallback": {
            "Domain": "<azure-managed-domain>.azurecomm.net",
            "FromAddress": "DoNotReply@<azure-managed-domain>.azurecomm.net",
            "DisplayName": "Xorbix VDAB"
        },
        "ForceFallback": false
    },
    "Backoff": {
        "AuthMaxDelaySeconds": 120,
        "DefaultMaxDelaySeconds": 600,
        "JitterPercent": 25
    },
    "EventGrid": {
        "WebhookPath": "/api/webhooks/acs-email"
    }
}
```

Bound through `IOptions<CommunicationConfiguration>` per repo standards (POCO in `Models/Config/`).

## 11. Infrastructure

- New Azure Service Bus namespace (Standard tier minimum; Premium if duplicate detection + sessions are needed at scale).
- Three queues, properties per §4.2.
- ACS resource: enable engagement tracking + Event Grid topic subscription.
- **Custom email domain `vdab.ai`** provisioned on the ACS resource:
  - DNS records (TXT for domain verification, SPF, DKIM × 2, and DMARC) configured at the `vdab.ai` registrar.
  - Domain verified through ACS and connected as a sender domain.
  - At least one `MailFrom` address registered (e.g., `no-reply@vdab.ai`).
  - Reputation pre-warmed before cutover: ramp Phase F sends gradually (Auth first, then Transactional, then Bulk) over a documented warm-up window.
- The Azure-managed domain provisioned with the ACS resource is kept connected (it would otherwise be deprovisionable) and used as the fallback per §7.5.
- AppHost: register the Service Bus resource and wire connection string into the Server project per existing patterns.
- Bicep / AppHost wiring lives alongside existing ACS provisioning.

## 12. Observability

Metrics (Application Insights / OpenTelemetry):

- `comm.outbox.enqueued` (counter, tags: `priority`, `template`, `sender_domain`)
- `comm.outbox.sent` (counter, tags: `sender_domain`)
- `comm.outbox.failed` (counter, tags: `class=transient|sender_domain_permanent|hard_permanent`, `sender_domain`)
- `comm.outbox.domain_fallback` (counter, tags: `template`, `reason` — fires every time a row swaps from `vdab.ai` to the Azure-managed domain)
- `comm.outbox.quarantined` (counter, tags: `class`, `sender_domain`)
- `comm.outbox.deadlettered` (counter)
- `comm.outbox.pending_age_seconds` (histogram — alert on p95 > 30s for `Auth`)
- `comm.acs.send_duration_seconds` (histogram, tags: `sender_domain`)
- `comm.acs.rate_limit_hits` (counter — 429s observed)
- `comm.delivery.delivered_age_seconds` (histogram — Sent → Delivered, tags: `sender_domain`)
- `comm.delivery.bounced` (counter, tags: `classification`, `sender_domain`)

Dashboards: per-queue depth, per-template send/bounce rate, DLQ counts.

Alerts:
- DLQ depth on `comm-auth` > 0.
- p95 `pending_age_seconds` on `comm-auth` > 30s.
- Bounce rate per template > 5% over 1h.
- ACS rate-limit hit rate > 10/min sustained.
- `comm.outbox.domain_fallback` rate > 1% of `comm.outbox.enqueued` over 15 min (early signal of a `vdab.ai` reputation or config incident).
- `vdab.ai` bounce rate > 2% over 1h (sender-reputation guardrail; the Azure-managed fallback should not be approaching this).
- Quarantine rate by class > 0.5% of enqueued over 1h.

## 13. Security

- Outbox `PayloadJson` may contain links with one-time tokens (invite, password reset, 2FA code). Treat the table as sensitive: row-level encryption for `PayloadJson` is **out of scope for v1** (the DB is already access-controlled and tokens are short-lived), but a follow-up task should evaluate column encryption.
- Event Grid webhook endpoint validates the CloudEvents signature and rejects requests without a managed-identity-issued token.
- Service Bus uses managed identity, not connection strings, in non-local environments (matches existing patterns).
- No PII in log lines beyond what we already log (`UserId`, hashed email is preferred over raw email where feasible).

## 14. Migration strategy

Rollout is gated behind a feature flag `Communication:UseOutbox` so we can cut over gradually.

**Phase A — Foundation (no behavior change)**
1. Add `CommunicationOutbox` table + EF migration + repository pair.
2. Add `ICommunicationOutboxService` with `EnqueueEmailAsync` that writes the row and **synchronously** invokes `EmailSenderService` (no broker yet). Flag-gated.
3. Migrate callers to `ICommunicationOutboxService`. Behavior preserved when flag is off (passthrough to old service). With flag on, every send is now durably recorded.

**Phase B — Broker + workers**
4. Provision Service Bus + three queues.
5. Implement `CommunicationOutboxDispatcher` and `EmailWorker` (one binary, three processors).
6. Switch `ICommunicationOutboxService` to "insert row + return" (broker-driven). Workers do the actual sends.
7. Implement client-side rate limiting and retry/backoff.

**Phase C — Delivery feedback**
8. Configure ACS engagement tracking + Event Grid subscription.
9. Implement `AcsEventGridController` webhook → outbox status updates.
10. Implement suppression cache fed by bounce events.

**Phase D — 2FA TTL anchoring**
11. Rework `VerificationChallengeService` to anchor TTL on `SentAt`, with provisional expiration and UI countdown refresh.

**Phase E — Operations**
12. DLQ monitor service.
13. Admin UI page: list outbox rows with filters (status, recipient, template, date range, sender domain, fallback used), with "resend on primary" / "resend on fallback" actions (each creates a new row with the same correlation id; see §7.6).
14. Dashboards + alerts wired up, including the per-domain bounce/fallback metrics in §12.

**Phase F — Custom sender domain + fallback**
15. Provision `vdab.ai` as a custom ACS sender domain (DNS, verification, MailFrom registration — see §11). Keep the Azure-managed domain connected as the fallback.
16. Add the `Senders` configuration section (§10) and a `SenderDomainResolver` that returns the From-address pair (`vdab.ai` primary, Azure-managed fallback) used by the worker for each attempt.
17. Implement `EmailFailureClassifier` (§7.4) and wire it into both the worker's synchronous error path and the Event Grid webhook.
18. Implement the fallback logic in §7.5 (domain swap on `SenderDomainPermanent`; synchronous swap-and-redispatch for the `comm-auth` queue).
19. Add the `Communication:Senders:ForceFallback` kill switch (§15) and the per-domain alerts in §12.
20. Reputation warm-up: ramp through Auth → Transactional → Bulk under documented daily volume caps before declaring `vdab.ai` GA.

## 15. Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Dispatcher becomes a bottleneck | `SELECT … FOR UPDATE SKIP LOCKED` allows horizontal scaling. Configurable batch size + poll interval. |
| Workers double-send on crash between ACS-accept and row-update | `AcsOperationId` reconciliation on restart: if an outbox row has `Dispatched` status and ACS reports the operation succeeded, the row is reconciled to `Sent` without re-sending. |
| Outbox table growth | Background pruning job: delete rows in terminal state (`Delivered`, `Bounced`, `Quarantined`, `DeadLettered`, `Suppressed`) older than 90 days. Auth-class messages with terminal state can be pruned after 7 days. `Quarantined` rows tied to a sender-domain incident are kept at least 30 days for forensics. |
| ASB Standard tier duplicate detection window is 30s — too short for slow retries | Rely on the outbox `Id` + worker-side idempotency check (reload row, skip if already `Sent`) rather than purely on ASB dedup. |
| Event Grid webhook flooding | Service Bus-buffer the Event Grid notifications too if volume warrants (later optimization). |
| `vdab.ai` reputation incident causes mass fallback churn | `Communication:Senders:ForceFallback = true` kill switch routes all new sends directly to the Azure-managed domain (skipping the primary attempt) until the incident is resolved. Per-domain bounce-rate alerts (§12) catch this early. |
| Misclassification routes a recipient-side error into the fallback domain and damages its reputation too | `EmailFailureClassifier` is unit-tested per error code with a default-deny policy: anything not explicitly mapped to `SenderDomainPermanent` is treated as `Transient` (retry on same domain) or `HardPermanent` (quarantine), never as a domain swap. |
| Fallback domain (`*.azurecomm.net`) hurts brand perception | Acceptable as a degraded mode. The `comm.outbox.domain_fallback` alert means an operator should be investigating `vdab.ai` health on the same business day. Operator resend tools (§7.6) let us re-send specific rows on `vdab.ai` once the issue is fixed. |
| Local dev experience for the fallback path | `Senders` config in `appsettings.Local.json` points both Primary and Fallback at the Azure-managed domain so local runs don't depend on DNS. Classifier and fallback wiring remain exercised in tests via `EmailFailureClassifier` unit tests and a fake ACS client. |
| Local dev experience | When ASB connection string is absent (mirroring how email currently degrades), dispatcher runs in "inline" mode and calls the worker function directly — keeps `dotnet run` flows working with no Azure dependency. |

## 16. Open questions

- Do we want a global "communications kill switch" config flag (panic stop bulk + transactional, keep auth) for incident response? Recommendation: yes, scope under §15 pruning task. (Separate from the `ForceFallback` switch in §10/§15 which addresses sender-domain incidents specifically.)
- Should we ever attempt automatic recovery back to `vdab.ai` for rows that were already fallback-swapped (e.g., a nightly job that retries on the primary once `vdab.ai` health is green)? Recommendation: **no** for v1 — keep the swap one-way and rely on explicit operator resend (§7.6). Revisit only if operator burden is measurable.
- Should we differentiate the `From:` display name on the fallback domain so users can visibly see it's a fallback path? Recommendation: no — keep the brand consistent. The address itself already changes.
- Should the outbox carry `ScheduledFor` for future-dated sends (e.g., trial-ending reminders)? Recommendation: yes, add the column in Phase A so we don't have to migrate later. Dispatcher honors it.
- Multi-channel readiness (SMS / push later): schema already has `Channel`. Worker is per-channel. No changes needed in Phase A–E.

## 17. Out of scope (separate tickets)

- User-facing email preferences and unsubscribe.
- Per-recipient throttling / "do not contact more than X / day" rules.
- A/B testing of templates.
- Internationalization of templates.
