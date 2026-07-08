const cds = require('@sap/cds')
const nodemailer = require('nodemailer')
const LOG = cds.log('mailer')

// ─────────────────────────────────────────────────────────────
// Mailer module — thin wrapper around Nodemailer + Ethereal.
//
// Design notes:
//   - We use Ethereal (nodemailer.createTestAccount()) for the learning
//     setup: zero signup, fresh inbox each server start, unlimited test
//     emails. Every message we "send" lands in the Ethereal inbox — never
//     touches a real recipient.
//   - The transporter is created ONCE at server startup and cached in
//     module scope. All handlers reuse this same transporter.
//   - We deliberately DO NOT persist the Ethereal creds anywhere — a
//     fresh inbox each `cds watch` restart is fine for learning and
//     avoids polluting .env with disposable secrets.
//   - The exported `initMailer()` is idempotent and safe to call from
//     multiple service impls without duplicating the transporter.
// ─────────────────────────────────────────────────────────────

// Module-scoped transporter. Populated on first initMailer() call.
let transporter = null

// The Ethereal account object — kept so we can print the inbox URL.
let testAccount = null


/**
 * Initialize the mailer. Idempotent — safe to call from every service
 * that needs to send email; subsequent calls short-circuit.
 *
 * Logs the Ethereal inbox URL prominently so you can open it in a browser
 * to see the "sent" emails.
 */
async function initMailer() {
    if (transporter) return transporter

    LOG.info('🔧 Creating Ethereal test account...')
    testAccount = await nodemailer.createTestAccount()

    transporter = nodemailer.createTransport({
        host: testAccount.smtp.host,   // typically smtp.ethereal.email
        port: testAccount.smtp.port,   // typically 587
        secure: testAccount.smtp.secure,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass
        }
    })

    // Loud, obvious log so it's easy to spot in the cds watch output.
    LOG.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    LOG.info('📬 Ethereal test inbox ready')
    LOG.info(`   User:   ${testAccount.user}`)
    LOG.info(`   Pass:   ${testAccount.pass}`)
    LOG.info(`   Inbox:  https://ethereal.email/messages`)
    LOG.info(`   Login:  https://ethereal.email/login`)
    LOG.info('   (Use the User/Pass above to log in and view sent emails)')
    LOG.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return transporter
}


/**
 * Send an email. Returns an object describing outcome so the caller
 * can persist delivery status without try/catching directly.
 *
 * Contract:
 *   Success -> { ok: true, messageId, previewUrl }
 *   Failure -> { ok: false, error: <message>, code: <if available> }
 *
 * We deliberately do NOT throw — the caller wants a status object so
 * it can update the Notification row's deliveryStatus/deliveryError
 * regardless of outcome. Throwing would force try/catch at every call
 * site and complicate the "best-effort delivery" pattern.
 */
async function sendMail({ to, subject, text, html }) {
    if (!transporter) {
        // Defensive — initMailer() should have run at boot. If someone
        // calls sendMail() before init, we return a clean failure rather
        // than crashing the request.
        return {
            ok: false,
            error: 'Mailer not initialized (initMailer was not called at startup)'
        }
    }

    try {
        const info = await transporter.sendMail({
            from: '"Library Notifications" <notifications@library.local>',
            to,
            subject,
            text,
            html: html || undefined
        })

        // Ethereal provides a per-message preview URL — extremely useful
        // for debugging. We include it in the success payload so it can
        // be logged by the caller.
        const previewUrl = nodemailer.getTestMessageUrl(info)

        return {
            ok: true,
            messageId: info.messageId,
            previewUrl: previewUrl
        }
    } catch (err) {
        return {
            ok: false,
            error: String(err.message || err),
            code: err.code   // e.g., 'EAUTH', 'ECONNECTION', 'ETIMEDOUT'
        }
    }
}


module.exports = {
    initMailer,
    sendMail
}