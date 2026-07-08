const cds = require('@sap/cds')
const LOG = cds.log('ans')

// ─────────────────────────────────────────────────────────────
// SAP Alert Notification Service (ANS) client.
//
// Responsibilities:
//   1. Fetch OAuth2 access tokens from the ANS auth endpoint
//      (client-credentials grant) and cache them until expiry
//   2. POST events to the ANS Producer API — routed by ANS to
//      the pre-configured Action (email → dhruv.rathor.35@gmail.com)
//      based on the Conditions (severity=INFO + category=NOTIFICATION)
//      and Subscription set up in the BTP cockpit
//
// Design notes:
//   - Credentials come from cds.env.requires.ans.credentials, which
//     CAP auto-resolves from VCAP_SERVICES (alert-notification binding)
//   - sendEvent() never throws — returns { ok, status, error } so
//     handlers can persist deliveryStatus without try/catch, matching
//     the mailer.js contract
//   - Token cache: refresh 60s before expiry to avoid mid-request expiry
//   - No external HTTP library — uses native Node fetch (Node 18+)
// ─────────────────────────────────────────────────────────────

// Module-scoped cache. Populated on first successful token fetch.
// Structure: { token: string, expiresAt: number (ms since epoch) }
let tokenCache = null


/**
 * Return the currently-configured ANS credentials from CAP's env.
 * Throws (only) if credentials aren't wired — a startup config
 * error, not a runtime error, so throwing is appropriate here.
 */
function getCreds() {
    const creds = cds.env.requires?.ans?.credentials
    if (!creds || !creds.oauth_url || !creds.url) {
        throw new Error(
            'ANS credentials not found in cds.env.requires.ans.credentials. ' +
            'Ensure the Library-ANS service is bound to Library-srv, or that ' +
            'VCAP_SERVICES contains an alert-notification entry.'
        )
    }
    return creds
}


/**
 * Fetch an OAuth2 access token via client_credentials grant.
 * The oauth_url from the ANS service key already has
 * `?grant_type=client_credentials` appended — we just POST with
 * Basic auth (base64(client_id:client_secret)).
 *
 * Returns the token string on success, throws on failure.
 * (Callers catch via the sendEvent wrapper.)
 */
async function fetchToken() {
    const { oauth_url, client_id, client_secret } = getCreds()

    // Basic auth header: base64(client_id:client_secret)
    const authHeader = 'Basic ' +
        Buffer.from(`${client_id}:${client_secret}`).toString('base64')

    LOG.debug('Fetching new OAuth token from ANS...')

    const res = await fetch(oauth_url, {
        method: 'POST',
        headers: {
            'Authorization': authHeader,
            'Accept': 'application/json'
        }
    })

    if (!res.ok) {
        const body = await res.text().catch(() => '')
        throw new Error(
            `OAuth token fetch failed: HTTP ${res.status} ${res.statusText} — ${body.slice(0, 200)}`
        )
    }

    const data = await res.json()
    // Typical response: { access_token, token_type, expires_in }
    if (!data.access_token) {
        throw new Error('OAuth response missing access_token: ' + JSON.stringify(data).slice(0, 200))
    }

    // Cache. Refresh 60s before actual expiry (safety margin).
    const expiresInMs = (data.expires_in || 3600) * 1000
    tokenCache = {
        token: data.access_token,
        expiresAt: Date.now() + expiresInMs - 60_000
    }

    LOG.debug(`OAuth token cached until ${new Date(tokenCache.expiresAt).toISOString()}`)
    return tokenCache.token
}


/**
 * Get a valid token — from cache if fresh, or fetch new.
 */
async function getToken() {
    if (tokenCache && Date.now() < tokenCache.expiresAt) {
        return tokenCache.token
    }
    return await fetchToken()
}


/**
 * Send an event to ANS Producer API.
 *
 * @param {object} params
 * @param {string} params.eventType   - e.g., 'BookBorrowed'
 * @param {string} params.subject     - Email subject (via template)
 * @param {string} params.body        - Email body (via template)
 * @param {object} [params.tags]      - Extra event tags (e.g., member_name)
 * @param {object} [params.resource]  - Resource identifier
 *
 * Contract:
 *   Success -> { ok: true, status: <http status>, correlationId }
 *   Failure -> { ok: false, error: <message>, status?: <if HTTP failure> }
 *
 * Never throws — matches mailer.js contract so handlers can uniformly
 * persist deliveryStatus regardless of delivery channel.
 */
async function sendEvent({ eventType, subject, body, tags = {}, resource }) {
    try {
        const token = await getToken()
        const { url } = getCreds()

        // ANS Producer endpoint: <credentials.url>/cf/producer/v1/resource-events
        // The service key `url` is the base; we append the producer path.
        // Note: some regions include the producer path in `url` already —
        // if the URL ends without /producer, we append it defensively.
        const producerUrl = url.endsWith('/resource-events')
            ? url
            : `${url.replace(/\/$/, '')}/cf/producer/v1/resource-events`

        // ANS event payload — matches the shape our Conditions filter on
        // (severity=INFO, category=NOTIFICATION) plus our template fields
        const payload = {
            eventType,
            severity: 'INFO',
            category: 'NOTIFICATION',
            subject,
            body,
            resource: resource || {
                resourceName: 'Library',
                resourceType: 'Application'
            },
            tags: {
                'ans:correlationId': tags.correlationId || cds.utils.uuid(),
                'ans:status': 'CREATE_OR_UPDATE',
                ...tags
            }
        }

        const res = await fetch(producerUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        })

        if (!res.ok) {
            const errBody = await res.text().catch(() => '')
            return {
                ok: false,
                status: res.status,
                error: `ANS POST failed: HTTP ${res.status} ${res.statusText} — ${errBody.slice(0, 300)}`
            }
        }

        // ANS returns 202 Accepted (async delivery) — no body of value
        return {
            ok: true,
            status: res.status,
            correlationId: payload.tags['ans:correlationId']
        }

    } catch (err) {
        return {
            ok: false,
            error: String(err.message || err),
            code: err.code
        }
    }
}


module.exports = {
    sendEvent
}