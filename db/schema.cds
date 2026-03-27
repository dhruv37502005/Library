namespace smart.library;

using {
    cuid,
    managed
} from '@sap/cds/common';


//---Authors---

// structure type
type Address {
    street  : String(100);
    city    : String(50);
    zipCode : String(10);
}

type BusinessID : String(20);

// @assert.unique: ['businessId'] //Unique Constraint
entity Authors : cuid, managed {
    name       : String(100);
    country    : String(50);
    books      : Composition of many Books
                     on books.author = $self; // Composition One-to-Many
    address    : Address; // Structured Type
    businessId : BusinessID @unique;
    // profile    : Association to one Profiles; // Association One-to-one
    profile : Composition of one Profiles
            on profile.author = $self;

}

// Custom Type Definition
type Price      : Decimal(10, 2);
type GenreType  : String(50);
// literals
type stock      : Integer default 0;

type BookStatus : String enum {
    AVAILABLE;
    OUT_OF_STOCK;
    DISCONTINUED;
}


entity Profiles : cuid, managed {
    bio     : String(500);
    website : String(200);
    author  : Association to one Authors;
}


//---Books---

entity Books : cuid, managed, AuditInfo {  //cuid Primary Key
    title        : String(150);
    stock        : stock;
    // price       : Decimal(10,2);
    author       : Association to Authors; // Foreign Key
    // genre       : String(50);
    price        : Price not null; // Using custom type and Not Null
    genre        : GenreType default 'General'; // Using custom type with literals
    // tags         : array of String; // Arrayed type
    tags : Composition of many BookTags
        on tags.book = $self;
    // Calculated Element
    // availability : String = case
@Core.Computed
availability : String = case
                                when stock > 0
                                     then 'Available'
                                else 'Out of Stock'
                            end;
    status       : BookStatus default 'AVAILABLE';
    categories   : Association to many BookCategories
                       on categories.book = $self;
    description  : LargeString;
    publishedAt  : Date;
    lastSoldAt   : Timestamp;
    isActive     : Boolean default true;
}

entity BookTags : cuid {
    book : Association to Books;
    tag  : String(50);
}


entity Categories : cuid {
    name  : String(100);
    // books : Association to many Books
    //             on books.ID = $self.books.ID; // Association Many-to-Many
    links : Association to many BookCategories
                on links.category = $self;
}

entity BookCategories : cuid {
    book     : Association to Books;
    category : Association to Categories;
}


// Views
entity BooksView as
    select from Books {
        ID,
        title,
        price,
        author.name as authorName
    };

aspect AuditInfo {
    approvedBy : String;
    approvedAt : Timestamp;
}


// // Delimited identifiers
// entity ![Order] : cuid, managed {
//     ![orderNumber]  : String(20);
//     ![total-amount] : Decimal(10,2);
// }

// Context
// smart.library.Sales.Orders
context Sales {
    entity Orders : cuid, managed {
        orderDate : Date;
        amount    : Decimal(10, 2);
    }
}


// join db view 
entity BooksWithAuthor as select from Books {
    ID,
    title,
    price,
    author.name as authorName
};


