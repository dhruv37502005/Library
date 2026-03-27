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

  // Bound Action - Apply Discount
  this.on('applyDiscount', Books, async (req) => {

    const { percentage } = req.data
    const bookID = req.params[0].ID

    if (percentage <= 0 || percentage > 50) {
      req.error(400, 'Discount must be between 1 and 50 percent')
    }

    const book = await SELECT.one.from(Books).where({ ID: bookID })

    const newPrice = book.price - (book.price * percentage / 100)

    await UPDATE(Books)
      .set({ price: newPrice })
      .where({ ID: bookID })

    return { message: 'Discount applied successfully' }

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
