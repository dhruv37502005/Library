module.exports = cds.service.impl(async function () {


  const { Books } = this.entities

  //  Validation Check Constraint
  this.before('CREATE', Books, (req) => {
    if (req.data.stock < 0) {
      req.error('Stock cannot be negative')
    }
  })

  // Override READ
  this.on('READ', Books, async (req, next) => {
    const result = await next() // calls default DB logic
    
    return result
  })

  // Bound Action - Restock
  this.on('restock', Books, async (req) => {
    const { quantity } = req.data
    const bookID = req.params[0].ID

    const book = await SELECT.one.from(Books).where({ ID: bookID })

    if (!book) {
      req.error(404, 'Book not found')
    }

    if (book.stock + quantity < 0) {
      req.error(400, 'Stock cannot become negative')
    }


    await UPDATE(Books)
      .set({ stock: { '+=': quantity } })
      .where({ ID: bookID })

    return { message: 'Stock updated successfully' }
  })

  // ─────────────────────────────────────────────────────────────
// AFTER READ — Compute effectivePrice per book on every read
//
// Why `after` and not `on`?
//   - `on('READ')` would replace CAP's default DB read entirely (we'd
//     have to fetch books ourselves).
//   - `after('READ')` lets CAP do the standard fetch first, then we
//     enrich each row. Cleaner separation of concerns.
//
// Active discount rule:
//   - Today's date must fall within [startDate, endDate]
//   - If multiple discounts qualify, pick the one with highest percentage
//
// Why per-row (not batch)?
//   - You said the *learning goal* is "compute on page load per record",
//     not pre-aggregate. This loop mirrors that intent.
//   - For a real production scenario, this would be N+1 query risk —
//     we'd batch-fetch active discounts once and map by book_ID.
//     Noted, not implemented (kept minimal per scope).
// ─────────────────────────────────────────────────────────────
this.after('READ', Books, async (data) => {
    // `data` is either a single object (Books(<id>) request) or an array
    // (Books list request). Normalize to array for one loop.
    const rows = Array.isArray(data) ? data : [data]

    // Today as ISO date string (YYYY-MM-DD) — matches the Date type of
    // Discounts.startDate / endDate.
    const today = new Date().toISOString().split('T')[0]

    for (const book of rows) {
        // Defensive: skip nulls (can happen on $expand of missing nav)
        // and rows that didn't include the price field in the projection.
        if (!book || book.ID == null) continue

        // Look up the best active discount for THIS book.
        // orderBy('percentage desc') + SELECT.one = "give me the largest %".
        const activeDiscount = await SELECT.one
            .from('smart.library.Discounts')
            .where({
                book_ID   : book.ID,
                startDate : { '<=': today },
                endDate   : { '>=': today }
            })
            .orderBy('percentage desc')

        // Compute effective price.
        // If no active discount → effective price = base price (no change).
        // If price wasn't selected (e.g., $select=title only) → leave undefined.
        if (book.price == null) {
            continue
        }
        if (activeDiscount) {
            const factor = 1 - Number(activeDiscount.percentage) / 100
            // Round to 2 decimals to match Decimal(10,2) declaration.
            book.effectivePrice = Number((book.price * factor).toFixed(2))
        } else {
            book.effectivePrice = book.price
        }
    }
})

// ─────────────────────────────────────────────────────────────
// BOUND ACTION — applyDiscount
//
// Architecture decision:
//   - Books.price is the canonical base price and is NEVER mutated by this action.
//   - Discounts are stored as separate rows in the Discounts entity, each with
//     a percentage + validity window (startDate, endDate).
//   - Multiple discounts can coexist for the same book (e.g., overlapping
//     campaigns) — caller / UI is responsible for picking the "active" one.
//
// Why this matters:
//   - Reversible: deleting a Discount row restores effective price automatically.
//   - Auditable: every discount has its own ID + managed timestamps (createdAt/By).
//   - No compound-discount bug: applying 20% twice doesn't stack into 36% off
//     the discounted price.
// ─────────────────────────────────────────────────────────────
this.on('applyDiscount', Books, async (req) => {
  const { Discounts } = this.entities
  const { percentage, startDate, endDate } = req.data

  // req.params is an array of key segments — for a bound action on Books,
  // it's a single-element array with the Book's primary key.
  const bookID = req.params[0].ID

  // ── Validation ──
  // Reject invalid input early — before any DB roundtrip.
  if (percentage <= 0 || percentage > 50) {
    req.error(400, 'Discount percentage must be between 0.01 and 50')
    return
  }
  if (!startDate || !endDate) {
    req.error(400, 'Both startDate and endDate are required')
    return
  }
  // Cross-field validation: endDate must not be before startDate.
  // CDS does not natively support cross-field constraints, so this is
  // enforced at the handler level.
  if (new Date(endDate) < new Date(startDate)) {
    req.error(400, 'endDate must be on or after startDate')
    return
  }

  // Verify the target book exists. Without this, INSERT would still succeed
  // (since book_ID is just a string FK), but the discount would orphan-link
  // to a non-existent book.
  const book = await SELECT.one.from(Books).where({ ID: bookID })
  if (!book) {
    req.error(404, 'Book not found')
    return
  }

  // ── Persist the discount ──
  // Note: we write `book_ID` (the foreign key column), not `book` (the
  // navigation property). CAP's INSERT.entries expects flat column names.
  await INSERT.into(Discounts).entries({
    book_ID    : bookID,
    percentage : percentage,
    startDate  : startDate,
    endDate    : endDate
  })

  // Return the freshly-inserted row so the caller sees the generated ID
  // and managed fields (createdAt/createdBy filled in by CAP).
  return await SELECT.one.from(Discounts)
    .where({ book_ID: bookID, startDate, endDate })
})


  // Validate Price and Stock
  this.before(['CREATE'], Books, (req) => {

    if (req.data.price !== undefined && req.data.price < 0) {
      req.error(400, 'Price cannot be negative')
    }

    if (req.data.stock !== undefined && req.data.stock < 0) {
      req.error(400, 'Stock cannot be negative')
    }

  })

  // Unbound Action
  this.on('resetAllStock', async (req) => {
    await UPDATE(Books).set({ stock: 0 })
    return { message: 'All stock reset to zero' }
  })

  // Function (read-only)
  this.on('getTotalBooks', async (req) => {
    const result = await SELECT.from(Books)
    return result.length
  })

  this.on('getExpensiveBooks', async () => {
    return await SELECT.from(Books)
      .where({ price: { '>': 300 } })
      .orderBy('price desc')
  })

  this.on('getBookCountByGenre', async () => {
    return await SELECT.from(Books)
      .columns('genre', { count: 'ID' })
      .groupBy('genre')
  })

  // log
  this.before('READ', Books, (req) => {
    console.log(req.query)
  })


})
