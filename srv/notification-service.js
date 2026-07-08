const cds = require('@sap/cds')
const LOG = cds.log('notifications')

// ─── ND1: Real email delivery via Nodemailer + Ethereal ───
// Mailer lives in srv/lib/ (not srv/) so CAP doesn't try to
// auto-load it as a service. initMailer() runs once at boot.
const { initMailer, sendMail } = require('./lib/mailer')

// ─── ND1 phase 5c: SAP Alert Notification Service (ANS) client ───
// Sends events via SAP-native transport when NOTIFY_CHANNEL is 'ans' or 'both'.
const { sendEvent: sendAnsEvent } = require('./lib/ans-client')


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

    // Boot: ensure the Nodemailer transporter is ready before any event
    // handler runs. Idempotent — safe even though initMailer is called
    // from within the service impl.
    await initMailer()

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
        // let rawEventRow
        // try {
        //     rawEventRow = await INSERT.into(RawEvents).entries({
        //         eventId    : eventId,
        //         eventType  : 'BookBorrowed',
        //         payload    : JSON.stringify(msg.data),
        //         receivedAt : new Date()
        //     })
        // Pre-generate the RawEvents row ID so we can reliably use it
        // as the FK when inserting Notifications AND when re-querying
        // them to send emails. CAP v9's INSERT.entries() doesn't
        // reliably return the generated ID on the response object.
        const rawEventID = cds.utils.uuid()

        try {
            await INSERT.into(RawEvents).entries({
                ID         : rawEventID,
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
                    sourceEvent_ID  : rawEventID 
                },
                {
                    recipientType   : 'ADMIN',
                    member           : null,  // admin rows have no member link
                    type            : 'AdminBorrowAlert',
                    title           : `${msg.data.member_name} borrowed "${msg.data.book_title}"`,
                    message         : `Loan ${msg.data.loan_ID} created. ${dueText}`.trim(),
                    relatedBook_ID  : msg.data.book_ID,
                    sourceEvent_ID  : rawEventID 
                }
            ])

            /*// ─── Mock delivery ───
            LOG.info(`📧 [MOCK EMAIL] To ${msg.data.member_name}: You borrowed "${msg.data.book_title}"`)
            LOG.info(`📧 [MOCK EMAIL] To admin: ${msg.data.member_name} borrowed "${msg.data.book_title}"`)

            // ─── Mark event processed ───
            await UPDATE(RawEvents)
                .set({ processedAt: new Date() })
                .where({ ID: rawEventRow.ID })
            */
           // ─── Real delivery via Ethereal SMTP ───
            //
            // We iterate the 2 fresh Notifications rows we just inserted,
            // send an email per row, then patch each row's deliveryStatus.
            //
            // Design notes:
            //   - We await each send (sequential) rather than Promise.all
            //     because Ethereal test SMTP has low throughput anyway and
            //     sequential errors are simpler to reason about for learning.
            //   - sendMail() never throws — returns {ok, error, ...} — so we
            //     can update the row cleanly whether it succeeded or not.
            //   - Real recipient addresses would come from Members.email in
            //     production. For learning we fake addresses per recipientType.

            // Re-fetch the just-inserted Notification IDs to update them.
            // We need this because INSERT.entries() on a bulk insert doesn't
            // reliably return IDs on all CAP versions.
            const borrowedRows = await SELECT.from(Notifications)
                .where({ sourceEvent_ID: rawEventID  })


                // for 
            // for (const row of borrowedRows) {
            //     // Fake recipient address per type. Member gets member_ID
            //     // in local domain; admin gets a fixed test address.
            //     const recipientEmail = row.recipientType === 'MEMBER'
            //         ? `${msg.data.member_ID}@library.local`
            //         : 'admin@library.local'

            //     const result = await sendMail({
            //         to      : recipientEmail,
            //         subject : row.title,
            //         text    : row.message
            //     })

            //     if (result.ok) {
            //         LOG.info(`📧 Delivered to ${recipientEmail} — preview: ${result.previewUrl}`)
            //         await UPDATE(Notifications)
            //             .set({
            //                 deliveryStatus : 'SENT',
            //                 deliveredAt    : new Date()
            //             })
            //             .where({ ID: row.ID })
            //     } else {
            //         LOG.error(`❌ Delivery failed to ${recipientEmail}: ${result.error}`)
            //         await UPDATE(Notifications)
            //             .set({
            //                 deliveryStatus : 'FAILED',
            //                 deliveryError  : String(result.error).slice(0, 500)
            //             })
            //             .where({ ID: row.ID })
            //     }
            // }

            for (const row of borrowedRows) {
                // For MEMBER rows we synthesize an email from member_ID (learning setup).
                // In production, this would be Members.email fetched via the association.
                // For ADMIN rows we use a fixed admin address OR — when routing via ANS —
                // the actual configured recipient in the ANS Action (dhruv.rathor.35@gmail.com).
                const memberEmail = row.recipientType === 'MEMBER'
                    ? `${msg.data.member_ID}@library.local`
                    : 'admin@library.local'

                const result = await deliverNotification({
                    row,
                    memberEmail,
                    msg,
                    eventType: 'BookBorrowed'
                })

                if (result.ok) {
                    await UPDATE(Notifications)
                        .set({
                            deliveryStatus : 'SENT',
                            deliveredAt    : new Date()
                        })
                        .where({ ID: row.ID })
                } else {
                    await UPDATE(Notifications)
                        .set({
                            deliveryStatus : 'FAILED',
                            deliveryError  : String(result.error).slice(0, 500)
                        })
                        .where({ ID: row.ID })
                }
            }

            // ─── Mark event processed ───
            // We mark the event processed EVEN IF individual delivery
            // failed — the fan-out itself succeeded (rows exist), the
            // per-row delivery status carries the failure info.
            // This is the "best-effort delivery" pattern you asked for.
            await UPDATE(RawEvents)
                .set({ processedAt: new Date() })
                .where({ ID: rawEventID  })
        } catch (err) {
            // Downstream failure — record it on the RawEvents row so
            // we can see what went wrong without hunting through logs.
            await UPDATE(RawEvents)
                .set({ processingError: String(err.message).slice(0, 1000) })
                .where({ ID: rawEventID  })
            throw err
        }

        // ─────────────────────────────────────────────────────────────
    // Delivery dispatcher — routes a notification to one or more
    // channels based on the NOTIFY_CHANNEL env variable.
    //
    // Values:
    //   'ethereal' (default) — Nodemailer/Ethereal only
    //   'ans'                — SAP Alert Notification only
    //   'both'               — try both, treat SENT if ANY succeeds,
    //                          FAILED only if all fail
    //
    // Returns { ok, error } — same contract as individual senders,
    // so callers just update deliveryStatus based on the aggregate result.
    // ─────────────────────────────────────────────────────────────
    async function deliverNotification({ row, memberEmail, msg, eventType }) {
        const channel = (process.env.NOTIFY_CHANNEL || 'ethereal').toLowerCase()

        const results = []

        if (channel === 'ethereal' || channel === 'both') {
            const r = await sendMail({
                to      : memberEmail,
                subject : row.title,
                text    : row.message
            })
            results.push({ channel: 'ethereal', ...r })
            if (r.ok) LOG.info(`📧 [ethereal] Delivered to ${memberEmail} — preview: ${r.previewUrl}`)
            else      LOG.error(`❌ [ethereal] Failed to ${memberEmail}: ${r.error}`)
        }

        if (channel === 'ans' || channel === 'both') {
            const r = await sendAnsEvent({
                eventType,
                subject : row.title,
                body    : row.message,
                resource: {
                    resourceName: msg.data.book_title || 'Library',
                    resourceType: 'Book',
                    tags: {
                        book_ID: msg.data.book_ID
                    }
                },
                tags: {
                    member_name    : msg.data.member_name || 'unknown',
                    recipientType  : row.recipientType,
                    correlationId  : row.ID
                }
            })
            results.push({ channel: 'ans', ...r })
            if (r.ok) LOG.info(`📮 [ans] Event routed for ${memberEmail} — correlationId: ${r.correlationId}`)
            else      LOG.error(`❌ [ans] Failed for ${memberEmail}: ${r.error}`)
        }

        // Aggregate outcome: SENT if ANY channel succeeded, FAILED if all failed.
        const anySucceeded = results.some(r => r.ok)
        if (anySucceeded) {
            return { ok: true }
        } else {
            // Concat failure messages for debugging
            const combinedError = results.map(r => `${r.channel}: ${r.error}`).join(' | ')
            return { ok: false, error: combinedError }
        }
    }
    })


    // ─────────────────────────────────────────────────────────────
    // Event handler: BookReturned
    // Same pattern as BookBorrowed with different messages.
    // ─────────────────────────────────────────────────────────────
    catService.on('BookReturned', async (msg) => {
        const eventId = msg.data.eventId
        LOG.info(`📥 BookReturned received (eventId=${eventId})`)

        // let rawEventRow
        // try {
        //     rawEventRow = await INSERT.into(RawEvents).entries({
        //         eventId    : eventId,
        //         eventType  : 'BookReturned',
        //         payload    : JSON.stringify(msg.data),
        //         receivedAt : new Date()
        //     })
        // Pre-generate the RawEvents row ID so we can reliably use it
        // as the FK when inserting Notifications AND when re-querying
        // them to send emails. CAP v9's INSERT.entries() doesn't
        // reliably return the generated ID on the response object.
        const rawEventID = cds.utils.uuid()

        try {
            await INSERT.into(RawEvents).entries({
                ID         : rawEventID,
                eventId    : eventId,
                eventType  : 'BookBorrowed',
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
                    sourceEvent_ID  : rawEventID 
                },
                {
                    recipientType   : 'ADMIN',
                    member           : null,
                    type            : 'AdminReturnAlert',
                    title           : `${msg.data.member_name} returned "${msg.data.book_title}"`,
                    message         : `Loan ${msg.data.loan_ID} closed on ${msg.data.returnDate}.${lateNote}`,
                    relatedBook_ID  : msg.data.book_ID,
                    sourceEvent_ID  : rawEventID 
                }
            ])

            /* //MOCK DELIVERY
            LOG.info(`📧 [MOCK EMAIL] To ${msg.data.member_name}: You returned "${msg.data.book_title}"${lateNote}`)
            LOG.info(`📧 [MOCK EMAIL] To admin: ${msg.data.member_name} returned "${msg.data.book_title}"${lateNote}`)

            await UPDATE(RawEvents)
                .set({ processedAt: new Date() })
                .where({ ID: rawEventRow.ID })
            */
           // ─── Real delivery via Ethereal SMTP ───
            // Same pattern as BookBorrowed — see comments there.
            const returnedRows = await SELECT.from(Notifications)
                .where({ sourceEvent_ID: rawEventID  })

            for (const row of returnedRows) {
                const recipientEmail = row.recipientType === 'MEMBER'
                    ? `${msg.data.member_ID}@library.local`
                    : 'admin@library.local'

                const result = await sendMail({
                    to      : recipientEmail,
                    subject : row.title,
                    text    : row.message
                })

                if (result.ok) {
                    LOG.info(`📧 Delivered to ${recipientEmail} — preview: ${result.previewUrl}`)
                    await UPDATE(Notifications)
                        .set({
                            deliveryStatus : 'SENT',
                            deliveredAt    : new Date()
                        })
                        .where({ ID: row.ID })
                } else {
                    LOG.error(`❌ Delivery failed to ${recipientEmail}: ${result.error}`)
                    await UPDATE(Notifications)
                        .set({
                            deliveryStatus : 'FAILED',
                            deliveryError  : String(result.error).slice(0, 500)
                        })
                        .where({ ID: row.ID })
                }
            }

            await UPDATE(RawEvents)
                .set({ processedAt: new Date() })
                .where({ ID: rawEventID  })
        } catch (err) {
            await UPDATE(RawEvents)
                .set({ processingError: String(err.message).slice(0, 1000) })
                .where({ ID: rawEventID  })
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