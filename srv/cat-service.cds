using smart.library as db from '../db/schema';

service CatService {
    // entity Authors as projection on db.Authors;
    entity Authors as projection on db.Authors {*,address};

    // entity Books as projection on db.Books;

    // custom Actions
    @cds.redirection.target
    entity Books   as projection on db.Books
        actions {
            action restock(quantity: Integer);
            action applyDiscount(percentage: Decimal(5, 2));
        };

    // unbound Action
    action   resetAllStock();

    // function (read-only)
    function getTotalBooks() returns Integer;

    // select expensive book (price > 300)
    function getExpensiveBooks() returns array of Books;

// group by genre
    function getBookCountByGenre() returns array of {
    genre : String;
    count : Integer;
};

// inner join 
entity BooksWithAuthor as projection on db.BooksWithAuthor;

}
