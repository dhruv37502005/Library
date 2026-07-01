const cds = require('@sap/cds')
const LOG = cds.log('notifications')

/**
 * NotificationsService — event consumer + facade for Notifications UI.
 *
 * This service:
 *   1. Subscribes to BookBorrowed / BookReturned events emitted by CatService
 *      via the CAP in-process Outbox
 *   2. Applies event-ID deduplication (idempotency) via RawEvents unique constraint
 *   3. Creates fan-out Notifications rows (member + admin) per event
 *   4. Marks the RawEvents row as processed
 *   5. Handles the markAsRead bound action for the UI
 *
 * Failure model:
 *   - Duplicate event (same eventId) → skip silently, log info
 *   - Handler exception → rethrows so Outbox retries; RawEvents row keeps
 *     `processingError` set for debugging
 */
module.exports = cds.service.impl(async function () {

    const { Notifications, RawEvents } = this.entities

    // The emitter (CatService) is a peer service in the same runtime.
    // We use cds.connect.to() to subscribe to its events.
    const catService = await cds.connect.to('CatService')


    // ─────────────────────────────────────────────────────────────
    // Event handler: BookBorrowed
    //
    // Fan-out: 2 Notifications rows
    //   - Member row: "You borrowed 'X'. Due back on Y."
    //   - Admin row:  "Alice borrowed 'X'."
    // ─────────────────────────────────────────────────────────────
    catService.on('BookBorrowed', async (msg) => {
        const eventId = msg.data.eventId
        LOG.info(`📥 BookBorrowed received (eventId=${eventId})`)

        // ─── Idempotency step ───
        // Try to insert into RawEvents. The unique constraint on eventId
        // makes duplicate deliveries fail here → we skip processing.
        let rawEventRow
        try {
            rawEventRow = await INSERT.into(RawEvents).entries({
                eventId    : eventId,
                eventType  : 'BookBorrowed',
                payload    : JSON.stringify(msg.data),
                receivedAt : new Date()
            })
        } catch (err) {
            // CDS/HANA/SQLite all surface unique-constraint violations
            // with different codes. We check for the message pattern.
            if (String(err.message).match(/unique|duplicate/i)) {
                LOG.info(`↩︎  Event ${eventId} already processed — skipping (idempotency)`)
                return
            }
            throw err  // any other error → outbox will retry
        }

        // ─── Fan-out ───
        const dueText = msg.data.dueDate
            ? `Due back on ${msg.data.dueDate}.`
            : ''

        try {
            await INSERT.into(Notifications).entries([
                {
                    recipientType   : 'MEMBER',
                    member_ID       : msg.data.member_ID,
                    type            : 'BorrowConfirmation',
                    title           : `You borrowed "${msg.data.book_title}"`,
                    message         : `Enjoy the read! ${dueText}`.trim(),
                    relatedBook_ID  : msg.data.book_ID,
                    sourceEvent_ID  : rawEventRow.ID
                },
                {
                    recipientType   : 'ADMIN',
                    member           : null,  // admin rows have no member link
                    type            : 'AdminBorrowAlert',
                    title           : `${msg.data.member_name} borrowed "${msg.data.book_title}"`,
                    message         : `Loan ${msg.data.loan_ID} created. ${dueText}`.trim(),
                    relatedBook_ID  : msg.data.book_ID,
                    sourceEvent_ID  : rawEventRow.ID
                }
            ])

            // ─── Mock delivery ───
            LOG.info(`📧 [MOCK EMAIL] To ${msg.data.member_name}: You borrowed "${msg.data.book_title}"`)
            LOG.info(`📧 [MOCK EMAIL] To admin: ${msg.data.member_name} borrowed "${msg.data.book_title}"`)

            // ─── Mark event processed ───
            await UPDATE(RawEvents)
                .set({ processedAt: new Date() })
                .where({ ID: rawEventRow.ID })

        } catch (err) {
            // Downstream failure — record it on the RawEvents row so
            // we can see what went wrong without hunting through logs.
            await UPDATE(RawEvents)
                .set({ processingError: String(err.message).slice(0, 1000) })
                .where({ ID: rawEventRow.ID })
            throw err
        }
    })


    // ─────────────────────────────────────────────────────────────
    // Event handler: BookReturned
    // Same pattern as BookBorrowed with different messages.
    // ─────────────────────────────────────────────────────────────
    catService.on('BookReturned', async (msg) => {
        const eventId = msg.data.eventId
        LOG.info(`📥 BookReturned received (eventId=${eventId})`)

        let rawEventRow
        try {
            rawEventRow = await INSERT.into(RawEvents).entries({
                eventId    : eventId,
                eventType  : 'BookReturned',
                payload    : JSON.stringify(msg.data),
                receivedAt : new Date()
            })
        } catch (err) {
            if (String(err.message).match(/unique|duplicate/i)) {
                LOG.info(`↩︎  Event ${eventId} already processed — skipping (idempotency)`)
                return
            }
            throw err
        }

        const lateNote = msg.data.wasOverdue
            ? ' (returned late — please return earlier next time!)'
            : ''

        try {
            await INSERT.into(Notifications).entries([
                {
                    recipientType   : 'MEMBER',
                    member_ID       : msg.data.member_ID,
                    type            : 'ReturnConfirmation',
                    title           : `You returned "${msg.data.book_title}"`,
                    message         : `Thank you!${lateNote}`,
                    relatedBook_ID  : msg.data.book_ID,
                    sourceEvent_ID  : rawEventRow.ID
                },
                {
                    recipientType   : 'ADMIN',
                    member           : null,
                    type            : 'AdminReturnAlert',
                    title           : `${msg.data.member_name} returned "${msg.data.book_title}"`,
                    message         : `Loan ${msg.data.loan_ID} closed on ${msg.data.returnDate}.${lateNote}`,
                    relatedBook_ID  : msg.data.book_ID,
                    sourceEvent_ID  : rawEventRow.ID
                }
            ])

            LOG.info(`📧 [MOCK EMAIL] To ${msg.data.member_name}: You returned "${msg.data.book_title}"${lateNote}`)
            LOG.info(`📧 [MOCK EMAIL] To admin: ${msg.data.member_name} returned "${msg.data.book_title}"${lateNote}`)

            await UPDATE(RawEvents)
                .set({ processedAt: new Date() })
                .where({ ID: rawEventRow.ID })

        } catch (err) {
            await UPDATE(RawEvents)
                .set({ processingError: String(err.message).slice(0, 1000) })
                .where({ ID: rawEventRow.ID })
            throw err
        }
    })


    // ─────────────────────────────────────────────────────────────
    // Bound action: markAsRead
    //
    // Called by the Fiori UI (row-level action). Sets isRead=true
    // and readAt=now. Returns the updated Notification so Fiori
    // Elements auto-refreshes the row.
    // ─────────────────────────────────────────────────────────────
    this.on('markAsRead', 'Notifications', async (req) => {
        const notificationID = req.params[0].ID

        await UPDATE(Notifications)
            .set({
                isRead : true,
                readAt : new Date()
            })
            .where({ ID: notificationID })

        return await SELECT.one.from(Notifications).where({ ID: notificationID })
    })
})