# Code Tour

This document helps a reviewer navigate the repository and understand *why* the code is structured this way.

## 1. Database Layer (`db/`)
* **`schema.cds`**: The single source of truth. Defines entities, reusable types (`Price`, `BusinessID`), and associations. Notice the use of `managed` (auto-timestamps) and `cuid` (auto-UUIDs).
* **`notifications-schema.cds`**: Separated to demonstrate domain separation. Handles event logs and user alerts.
* **`data/*.csv`**: Realistic seed data (1,000 books, 592 authors). Loaded automatically by the HANA HDI deployer.

## 2. Service Layer (`srv/`)
* **`cat-service.cds`**: The core API. Notice the `@requires` and `@restrict` annotations. Authorization is enforced at the CDS level, not in JavaScript.
* **`cat-service.js`**: Contains the business logic. Look at the `this.after('READ', Books)` handler—it computes `effectivePrice` on the fly using active discounts. Look at the `borrowBook` action—it decrements stock and emits an event.
* **`notification-service.js`**: The event consumer. It listens for `BookBorrowed`, implements idempotency (using `RawEvents.eventId` unique constraint), and fans out notifications to the Member and Admin.
* **`lib/`**: Contains standalone integrations: `mailer.js` (Ethereal SMTP) and `ans-client.js` (SAP Alert Notification Service OAuth2 flow).

## 3. Frontend Layer (`app/`)
* **`annotations.cds`**: The magic of Fiori Elements. Look at `srv/cat-service-ui.cds` to see how we turn `coverImageUrl` into an actual image using `@UI.IsImageUrl`, and how we build the Object Page header.
* **`app/*`**: Five distinct Fiori Elements apps (List Report, ALP, OVP). No custom UI5 controllers—everything is metadata-driven.