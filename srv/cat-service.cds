using smart.library as db from '../db/schema';

/**
 * CatService — single public-facing OData service.
 *
 * Currently exposes ALL entities with full CRUD for learning/demo purposes.
 * Authorization annotations (@requires, @restrict) intentionally absent —
 * will be added in the next session once xs-security.json defines roles.
 *
 * Future plan: split into CatService (public, read-mostly) + AdminService
 * (admin-only writes) when the second Fiori app is introduced.
 */
service CatService {

    // ─── Core catalog entities ───
    // Projection without a column list = expose every field as-is.
    // Equivalent to `projection on db.X { * }`.
    entity Authors          as projection on db.Authors;
    entity Profiles         as projection on db.Profiles;
    entity Categories       as projection on db.Categories;

    // ─── Junction (many-to-many link) entities ───
    // Exposed for full CRUD so we can demonstrate manual link/unlink
    // of Books<->Categories and Books<->Tags via REST.
    entity BookCategories   as projection on db.BookCategories;
    entity BookTags         as projection on db.BookTags;

    // ─── Pricing entity ───
    // Exposed read+write. The applyDiscount action below is the *preferred*
    // way to create discounts (validates dates), but direct POST is also
    // allowed for testing/admin scenarios.
    entity Discounts        as projection on db.Discounts;

    // ─── Read-only CDS view ───
    // Defined in db/schema.cds as a join between Books and Authors.
    // No write semantics — views are inherently read-only at OData level.
    entity BooksWithAuthor  as projection on db.BooksWithAuthor;

    // ─── Books entity with bound actions ───
    // @cds.redirection.target tells CAP: "when other services project Books,
    // resolve navigation/$expand against THIS exposure" — useful when
    // multiple services expose the same DB entity.
    @cds.redirection.target
    entity Books as projection on db.Books
        actions {

            // Restock — increases stock by `quantity`.
            // Validation that quantity > 0 lives in the JS handler.
            action restock(quantity : Integer) returns Books;

            // Apply Discount — inserts a row into Discounts entity.
            // Does NOT mutate Books.price (that stays as the canonical base price).
            // Returns the newly-created Discount so the caller sees the result.
            //
            // Why 3 params instead of just `percentage`?
            // A discount without a validity window is meaningless in real systems,
            // so we force the caller to provide startDate + endDate.
            action applyDiscount(
                percentage : Decimal(5, 2),
                startDate  : Date,
                endDate    : Date
            ) returns Discounts;
        };

    // ─── Unbound action ───
    // "Unbound" = not tied to a specific entity instance.
    // Called as POST /resetAllStock (no entity key in URL).
    action   resetAllStock();

    // ─── Functions (read-only by OData spec) ───
    // Use `function` (not `action`) when the operation does not modify state.
    // OData allows GET on functions, which makes them browser-testable.
    function getTotalBooks()       returns Integer;
    function getExpensiveBooks()   returns array of Books;

    // Function with inline structured return type — handy for ad-hoc aggregations
    // without needing to define a separate entity.
    function getBookCountByGenre() returns array of {
        genre : String;
        count : Integer;
    };

    // ─── Lending domain entities (added for 2nd Fiori app) ───
    entity Members as projection on db.Lending.Members;
    entity Loans   as projection on db.Lending.Loans;
}