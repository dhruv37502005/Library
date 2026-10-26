# 03 — Code Tour

This document is a guided walk through the repository.

The goal is not to explain every line. The goal is to show:

- where each responsibility lives
- how the layers connect
- which files are the best entry points
- which files are generated scaffolding
- where the important design decisions are implemented

If this is your first SAP CAP project, start with the reading path below instead of opening files randomly.

---

## 1. Recommended reading path

Read these files in this order:

1. `db/schema.cds`
2. `srv/cat-service.cds`
3. `srv/cat-service.js`
4. `srv/cat-service-ui.cds`
5. `db/notifications-schema.cds`
6. `srv/notification-service.cds`
7. `srv/notification-service.js`
8. `srv/lib/mailer.js`
9. `srv/lib/ans-client.js`
10. `mta.yaml`
11. `xs-security.json`
12. one Fiori app’s `manifest.json` and `annotations.cds`

That order follows the real runtime flow:

```text
Data model
   ↓
OData service contract
   ↓
Business rules
   ↓
Fiori metadata
   ↓
Events and notifications
   ↓
External delivery channels
   ↓
Cloud deployment and security
```

---

## 2. Repository map

```text
Library/
├── app/                           # Fiori Elements applications
│   ├── list_object_library/
│   ├── library-analytics/
│   ├── notifications-ui/
│   ├── loan-management/
│   └── library-overview/
├── db/                            # Persistent domain model + seed data
│   ├── schema.cds
│   ├── notifications-schema.cds
│   ├── data/
│   └── undeploy.json
├── srv/                           # OData contracts, handlers, UI metadata
│   ├── cat-service.cds
│   ├── cat-service.js
│   ├── cat-service-ui.cds
│   ├── notification-service.cds
│   ├── notification-service.js
│   └── lib/
│       ├── mailer.js
│       └── ans-client.js
├── docs/                          # Architecture and deployment documentation
├── notifications/PLAN.md          # Original design plan for notifications
├── .reset-recovery/PROGRESS.md    # Trial-reset and session recovery log
├── .github/workflows/             # CI/CD workflow definitions
├── mta.yaml                       # Cloud Foundry deployment model
├── xs-security.json               # XSUAA scopes and role definitions
├── package.json                   # Runtime, tooling and scripts
└── test.http                      # Manual HTTP request collection
```

---

# 3. Database layer — `db/`

## 3.1 `db/schema.cds`

This is the main domain model and the best starting point for understanding the project.

It defines the catalog, pricing, lending and small sales domains under the `smart.library` namespace.

### Main catalog entities

- `Authors`
- `Profiles`
- `Books`
- `Categories`
- `BookCategories`
- `BookTags`
- `Discounts`

### Lending context

The `Lending` context groups:

- `Members`
- `Loans`

A loan connects one book to one member and tracks:

- borrow date
- due date
- return date

A null `returnDate` means the book is still borrowed.

### Sales context

The `Sales` context currently contains a small `Orders` entity.

This is intentionally limited and acts as a domain-extension example rather than a complete sales module.

### CDS features demonstrated

#### UUID keys and managed fields

Entities use reusable CAP aspects:

```cds
entity Books : cuid, managed {
    ...
}
```

- `cuid` adds a UUID primary key.
- `managed` adds `createdAt`, `createdBy`, `modifiedAt`, and `modifiedBy`.

#### Custom types

Examples include:

- `Price`
- `BusinessID`
- `GenreType`
- structured `Address`

Custom types make domain intent clearer and avoid repeating primitive definitions.

#### Compositions and associations

An Author composes books and a profile.

A composition expresses ownership: the child belongs to the parent’s lifecycle.

Other relations, such as books to categories, use associations and explicit junction entities.

#### Calculated fields

`Books.availability` is computed through a CDS `case` expression from stock.

The database does not need a second stored availability value that could become inconsistent with `stock`.

#### Views

`BooksWithAuthor` exposes joined book and author data as a read-only database view.

#### Analytics

The model contains aggregation annotations such as:

- `@Aggregation.ApplySupported`
- `@Analytics.AggregatedProperty`
- dimensions for grouping
- measures for stock and price

These annotations provide the backend metadata required by the OData V4 Analytical List Page.

> The chart does not work from `@UI.Chart` alone. The database/service aggregation metadata and the analytics app’s dynamic-measure annotations are also required.

---

## 3.2 `db/notifications-schema.cds`

Notifications use a separate namespace:

```text
smart.notifications
```

This keeps event-processing records separate from the main catalog domain.

### `RawEvents`

`RawEvents` is the event-processing log.

Important fields include:

- `eventId`
- `eventType`
- serialized payload
- received and processed timestamps
- processing error

`eventId` is unique and acts as the idempotency guard.

If the same event is delivered twice, the second insert violates the unique constraint and processing is skipped.

### `Notifications`

This is the user-facing read model produced from incoming events.

A notification stores:

- recipient type (`MEMBER` or `ADMIN`)
- title and message
- related member and book
- source event
- read state
- delivery state
- delivery timestamp or error

One event normally produces two notification rows:

```text
BookBorrowed event
    ├── MEMBER notification
    └── ADMIN notification
```

### Why this model is separated

The catalog describes business state.

The notifications model describes reactions to business events.

Keeping them separate prevents email and alert concerns from leaking into the core catalog model.

### CAP v9 namespace lesson

An earlier version wrapped these entities in an additional `Notifications` context, producing names such as:

```text
smart.notifications.Notifications.Notifications
```

The context wrapper was removed, leaving the clearer names:

```text
smart.notifications.Notifications
smart.notifications.RawEvents
```

---

## 3.3 `db/data/`

The application uses CSV files for reproducible seed data.

The main dataset contains approximately:

- 1,000 books
- 592 authors
- real titles
- genres
- prices
- descriptions
- publication dates
- cover-image URLs

CAP loads the CSVs automatically:

- into in-memory SQLite during local development
- into the HANA HDI container through the database deployer on BTP

This matters because SAP BTP trial environments are temporary.

The project can rebuild its catalog directly from Git instead of depending on manual database imports.

Some dependent entities intentionally start empty, including:

- loans
- discounts
- tags
- profiles

These become populated through application activity.

---

## 3.4 `db/undeploy.json`

This file tells the HDI deployer which obsolete database artifacts may be removed during model evolution.

It specifically covers generated HANA artifacts such as:

- views
- indexes
- constraints
- draft tables
- calculation views

This prevents stale database objects from remaining after a CDS model changes.

---

# 4. Service layer — `srv/`

## 4.1 `srv/cat-service.cds`

This file defines the public catalog and lending OData contract.

The service exposes projections of database entities rather than exposing the database model directly.

That separation allows the service contract to evolve independently of the persistence model.

### Bound actions

Bound actions operate on one selected book.

#### `restock`

```text
POST Books(<bookId>)/CatService.restock
```

Input:

```json
{
  "quantity": 10
}
```

The action updates one book and returns the updated record.

#### `applyDiscount`

```text
POST Books(<bookId>)/CatService.applyDiscount
```

Input:

```json
{
  "percentage": 15,
  "startDate": "2026-10-01",
  "endDate": "2026-10-31"
}
```

This action creates a separate Discount record.

It does not overwrite the book’s canonical base price.

### Unbound actions

Unbound actions operate at service level rather than on one existing entity instance.

- `resetAllStock`
- `borrowBook`
- `returnBook`

`borrowBook` creates a new loan, so there is no existing Loan record to bind the action to.

### Functions

Read-only functions include:

- `getTotalBooks`
- `getExpensiveBooks`
- `getBookCountByGenre`

OData functions use GET and must not change persistent state.

### Authorization status

Production authentication is configured through XSUAA, but role checks are not currently declared through `@requires` or `@restrict` in the CDS service model.

The current deployed behavior proves that anonymous callers are rejected, but role-level Viewer/Admin enforcement remains a planned improvement.

---

## 4.2 `srv/cat-service.js`

This file implements business rules that cannot be expressed through plain CDS projections.

CAP still handles standard CRUD automatically.

Custom JavaScript handlers are added only where the domain needs more control.

## Book validation

Before creating a book, the handler checks that price and stock are not negative.

This prevents invalid state from reaching the database.

## `restock`

The restock handler:

1. reads the action quantity
2. extracts the book key from the final URL segment
3. checks that the book exists
4. confirms the resulting stock will not be negative
5. updates the stock
6. returns the refreshed book

The key is read using:

```js
req.params.at(-1).ID
```

Using the final segment matters when the action is called through a navigation path such as:

```text
Authors(<authorId>)/books(<bookId>)/CatService.restock
```

In that request, `req.params[0]` belongs to the author, while the final segment belongs to the book.

## Effective price after READ

An `after READ` handler enriches each returned book with the virtual field `effectivePrice`.

The handler:

1. calculates today’s date
2. looks for active discounts
3. selects the highest percentage if multiple discounts overlap
4. calculates the reduced price
5. leaves the original base price unchanged

### Why compute it at read time?

Benefits:

- always correct for the current date
- no stale stored effective price
- deleting or expiring a discount restores the base price automatically

Trade-off:

- the current implementation performs a discount query per book row
- this creates an N+1 query pattern
- a production optimization would fetch active discounts in one batch and map them by book ID

The current implementation was kept intentionally simple for learning.

## `applyDiscount`

This handler validates:

- percentage is greater than zero
- percentage is no more than 50
- start and end dates are present
- end date is not before start date
- target book exists

It then inserts a row into `Discounts`.

The base `Books.price` value is never mutated.

## `borrowBook`

The borrow workflow:

1. validates `book_ID` and `member_ID`
2. confirms both records exist
3. confirms stock is available
4. creates a Loan with a 14-day due date
5. decrements stock
6. emits `BookBorrowed`
7. returns the created Loan

The event payload contains the identifiers, names and dates required by the notification consumer.

## `returnBook`

The return workflow:

1. validates the loan exists
2. rejects already-returned loans
3. sets `returnDate`
4. restores one stock unit
5. calculates whether the return is overdue
6. emits `BookReturned`
7. returns the updated Loan

The catalog service publishes facts.

It does not decide who gets emailed or how notifications are delivered.

That responsibility belongs to the NotificationsService.

---

## 4.3 `srv/cat-service-ui.cds`

This file contains shared Fiori Elements annotations for CatService.

It turns the raw OData model into usable List Report and Object Page experiences.

### Authors

The annotations define:

- searchable author names
- selection fields
- table columns
- alphabetical sorting
- Object Page header
- general-information facet
- Books navigation facet
- country value help

### Books

The annotations define:

- Object Page facets
- title and author header
- cover image as the page hero
- cover thumbnails in the table
- book detail fields
- base and effective price
- Restock and Apply Discount action buttons
- basic chart intent

`coverImageUrl` is rendered as an image through:

```cds
@UI.IsImageUrl
```

### Generated action UI

This annotation creates an Object Page action:

```cds
{
    $Type  : 'UI.DataFieldForAction',
    Label  : 'Apply Discount',
    Action : 'CatService.applyDiscount'
}
```

Fiori Elements reads the action parameter signature from OData metadata and generates the input dialog automatically.

No custom controller or manually coded form is required.

### Shared versus app-specific annotations

Annotations appear in two places:

- `srv/cat-service-ui.cds`: shared service annotations
- `app/*/annotations.cds`: app-specific and floorplan-specific annotations

For the analytics app, the full chart depends on three pieces:

1. aggregation metadata in `db/schema.cds`
2. shared chart intent in `srv/cat-service-ui.cds`
3. analytics-specific dynamic measures in `app/library-analytics/annotations.cds`

---

## 4.4 `srv/notification-service.cds`

This file defines the notification OData facade at:

```text
/notifications
```

It exposes two entities.

### `Notifications`

This is the UI-facing notification feed.

It includes the bound action:

```cds
markAsRead()
```

The action updates one notification and returns the refreshed record so Fiori Elements can update the row.

### `RawEvents`

`RawEvents` is exposed as read-only.

Clients can inspect the event-processing log but cannot manually change it through OData.

That protects the audit and idempotency history from user edits.

---

## 4.5 `srv/notification-service.js`

This is the event-consumer implementation.

It connects to CatService and subscribes to:

- `BookBorrowed`
- `BookReturned`

### Event-processing pattern

For each event, the handler:

1. receives an event containing a unique `eventId`
2. inserts the event into `RawEvents`
3. skips processing if the unique event ID already exists
4. creates a MEMBER notification
5. creates an ADMIN notification
6. attempts delivery
7. stores the delivery result
8. marks the event processed

### Idempotency

The event is inserted before notification rows are created.

If the same event is received again, the database unique constraint rejects the repeated `eventId`.

The handler detects the duplicate and returns without creating additional notification rows.

### Fan-out

One domain event creates two notification records:

```text
BookBorrowed
├── BorrowConfirmation for MEMBER
└── AdminBorrowAlert for ADMIN
```

The same pattern is used for return confirmations.

### Best-effort delivery

Each notification stores:

- `deliveryStatus`
- `deliveredAt`
- `deliveryError`

Delivery failure does not delete the notification record.

This creates an inspectable trail of what the system attempted and what failed.

### Delivery-channel selection

The environment variable `NOTIFY_CHANNEL` decides the transport:

```text
ethereal  → Nodemailer/Ethereal only
ans       → SAP Alert Notification only
both      → attempt both
```

This allows free local testing and SAP-native cloud delivery without duplicating the business logic.

### `markAsRead`

The bound action sets:

- `isRead = true`
- `readAt = current timestamp`

It returns the updated row for immediate Fiori refresh.

---

# 5. Delivery integrations — `srv/lib/`

## 5.1 `srv/lib/mailer.js`

This is a thin wrapper around Nodemailer and Ethereal.

### Initialization

`initMailer()`:

1. creates an Ethereal test account
2. creates and caches the SMTP transporter
3. logs the temporary inbox credentials and URLs
4. returns the existing transporter on later calls

No disposable Ethereal credentials are stored in Git or `.env`.

A fresh account is created whenever the server restarts.

### Sending

`sendMail()` returns a status object instead of throwing:

```text
Success → { ok: true, messageId, previewUrl }
Failure → { ok: false, error, code }
```

This lets the event handler persist delivery status in a consistent way.

Ethereal never sends messages to real recipients.

It captures them in a test inbox.

---

## 5.2 `srv/lib/ans-client.js`

This module sends events to SAP Alert Notification Service.

Its responsibilities are:

1. resolve credentials from the Cloud Foundry service binding
2. request an OAuth2 access token through the client-credentials flow
3. cache the token until shortly before expiry
4. construct the ANS resource-event payload
5. post the event to the Producer API
6. return a status object rather than throwing

### Credential resolution

CAP reads the ANS binding from `VCAP_SERVICES`.

The package configuration maps the binding through:

```json
"ans": {
  "kind": "rest",
  "vcap": {
    "label": "alert-notification"
  }
}
```

No ANS client ID or client secret is committed to the repository.

### Token caching

The client caches the access token and refreshes it before expiry.

This prevents requesting a new token for every notification.

### Delivery contract

Like the mailer, the ANS client returns:

```text
Success → { ok: true, status, correlationId }
Failure → { ok: false, error, status? }
```

Using the same response style lets the notification handler treat both channels consistently.

---

# 6. Frontend layer — `app/`

The project contains five Fiori app folders.

They are metadata-driven applications rather than large freestyle UI5 codebases.

Most behavior comes from:

- CAP service metadata
- CDS annotations
- each app’s `manifest.json`
- app-specific `annotations.cds`

## 6.1 `app/list_object_library`

The main catalog app.

It provides:

- Authors List Report
- Author Object Page
- Books navigation
- Book Object Page
- cover images
- restock and discount actions

This is the best app to open first when exploring the project.

## 6.2 `app/library-analytics`

An Analytical List Page for stock and pricing analysis.

The chart depends on:

- backend aggregation annotations
- OData V4 dynamic measures
- app-specific analytics annotations

This app documents an important V4 lesson: classic chart measures alone are not enough.

## 6.3 `app/notifications-ui`

Displays notification records and delivery status.

This app consumes NotificationsService rather than CatService.

It includes the row-level `markAsRead` action.

## 6.4 `app/loan-management`

Displays lending records and borrow/return workflows.

The app works locally.

At the time of writing, its Cloud Foundry UI packaging is incomplete because the folder does not contain the `ui5-deploy.yaml` and zip configuration used by the other deployed apps.

## 6.5 `app/library-overview`

This app is retained as a documented dead end.

SAP Overview Page uses OData V2, while CatService exposes OData V4.

The app is preserved because the failed path is a useful platform-compatibility lesson.

## Generated test scaffolds

Several apps include generated OPA5 integration-test files under:

```text
webapp/test/integration/
```

These files are generator scaffolds.

They should not be interpreted as an operational automated-test suite until they are configured and executed in CI.

---

# 7. Root configuration

## 7.1 `package.json`

The root package defines both local and cloud runtime dependencies.

### Runtime dependencies

- `@sap/cds`
- `@cap-js/hana`
- `@sap/xssec`
- `express`
- `nodemailer`

### Local development dependencies

- `@cap-js/sqlite`
- `@sap/cds-dk`
- `cds-plugin-ui5`
- `mbt`
- `rimraf`

### Useful commands

Run the complete project locally:

```bash
npm run watch
```

Open the main catalog app automatically:

```bash
npm run watch-list_object_library
```

Open individual apps:

```bash
npm run watch-loan-management
npm run watch-library-analytics
npm run watch-notifications-ui
```

Build the MTA:

```bash
npm run build
```

This script creates:

```text
mta_archives/archive.mtar
```

Deploy that exact build output:

```bash
npm run deploy
```

A direct `mbt build` may produce a versioned MTAR filename instead.

### Profiles

Production uses XSUAA:

```json
"[production]": {
  "auth": "xsuaa"
}
```

Local development uses CAP’s local development behavior because no explicit development auth profile or mock users are currently declared.

### npm workspaces

All folders under `app/*` are configured as npm workspaces.

This lets the root install and build process manage the Fiori app dependencies together.

---

## 7.2 `xs-security.json`

This file defines XSUAA security artifacts:

### Scopes

- `Viewer`
- `Admin`

### Role templates

- Viewer
- Admin

The Admin role template also includes the Viewer scope.

### Role collections

- `Library_Viewer`
- `Library_Admin`

These role definitions exist in XSUAA.

The service model does not yet apply role-level `@requires` or `@restrict` checks, so current enforcement is authentication-level, not authorization-level.

---

## 7.3 `mta.yaml`

This is the deployment blueprint.

It defines application modules and managed BTP services.

### Application modules

- `Library-srv`
- `Library-db-deployer`
- `Library-app-content`
- one HTML5 build module per Fiori app

### Service resources

- XSUAA
- HANA HDI container
- SAP Alert Notification
- HTML5 Apps Repository
- Destination service
- Connectivity service

The `Library-srv` module is bound to the services it requires.

The database deployer creates and updates database artifacts, then stops after completing its task.

---

# 8. DevOps and project support files

## 8.1 `.github/workflows/`

The repository contains workflow definitions for:

- Cloud Foundry deployment
- release processing
- testing

Treat these as repository automation definitions.

Whether each workflow is operational depends on the GitHub secrets, environments and triggers configured for the repository.

Do not commit credentials directly into workflow YAML.

## 8.2 `test.http`

This file contains manual HTTP requests for service testing.

It is useful for:

- calling OData entities
- testing actions and functions
- verifying validation
- reproducing API behavior without the UI

## 8.3 `notifications/PLAN.md`

This preserves the original event-driven notification design.

It documents earlier decisions, scope boundaries and intended phases.

It is useful for understanding why the implementation looks the way it does.

## 8.4 `.reset-recovery/PROGRESS.md`

This is the append-only session and recovery log.

It records:

- completed work
- blocked items
- platform dead ends
- next-session priorities

This became especially useful because BTP trial environments reset and must be reconstructed.

---

# 9. Where to look for specific concepts

| Question | Start here |
|---|---|
| How is a Book stored? | `db/schema.cds` |
| How is the API exposed? | `srv/cat-service.cds` |
| Where is stock updated? | `srv/cat-service.js` → `restock` |
| How are active discounts calculated? | `srv/cat-service.js` → `after READ Books` |
| How does borrowing work? | `srv/cat-service.js` → `borrowBook` |
| Where are events consumed? | `srv/notification-service.js` |
| How are duplicates prevented? | `db/notifications-schema.cds` + `notification-service.js` |
| How are emails sent locally? | `srv/lib/mailer.js` |
| How is ANS called? | `srv/lib/ans-client.js` |
| How do Fiori action buttons appear? | `srv/cat-service-ui.cds` |
| How does the ALP chart work? | `db/schema.cds` + `app/library-analytics/annotations.cds` |
| How is the cloud deployment assembled? | `mta.yaml` |
| Where are roles defined? | `xs-security.json` |
| How do I run one UI directly? | root `package.json` scripts |

---

# 10. What is handwritten versus generated

## Handwritten or heavily customised

- domain models under `db/`
- service definitions and handlers under `srv/`
- notification delivery clients
- shared UI annotations
- MTA and security configuration
- seed-data preparation
- architecture and recovery documentation

## Generator-created and then reviewed

- Fiori application scaffolds
- `manifest.json` files
- app-local annotation files
- OPA5 test skeletons
- `.appGenInfo.json`
- UI5 tooling configuration

The generated files are not treated as automatically correct.

For example:

- the Overview Page exposed an OData V2/V4 compatibility limit
- the Analytical List Page required manual aggregation and dynamic-measure work
- loan-management still needs Cloud Foundry packaging configuration

That is part of the project’s learning value.

---

## Next document

After understanding the code structure, continue with:

- [Architecture and design decisions](02-architecture.md)
- [Deploying from scratch](04-deploy-from-scratch.md)