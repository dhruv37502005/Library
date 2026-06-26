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

entity Discounts : cuid, managed {
    // We use an Association to link the discount to a specific book
    book       : Association to Books; 
    
    // Percentage can be a Decimal (e.g., 15.50 for 15.5%)
    percentage : Decimal(5, 2); 
    
    // Professional touch: Add validity dates
    startDate  : Date;
    endDate    : Date;
}


// ─────────────────────────────────────────────────────────────
// LENDING CONTEXT — Book borrowing/return tracking
// Added to demonstrate domain extension and to give Joule a
// CAP service to scaffold a 2nd Fiori app on top of.
// ─────────────────────────────────────────────────────────────
context Lending {

    // Members of the library who can borrow books.
    entity Members : cuid, managed {
        name           : String(100);
        email          : String(100) @unique;
        joinDate       : Date;
        membershipType : String(20) enum {
            STANDARD;
            PREMIUM;
            STUDENT;
        } default 'STANDARD';

        // Backreference — all loans by this member.
        loans : Association to many Loans on loans.member = $self;
    }

    // A single borrow record — links a Book to a Member with dates.
    // returnDate = null means the book is still out.
    entity Loans : cuid, managed {
        book       : Association to Books;
        member     : Association to Members;
        borrowDate : Date;
        dueDate    : Date;
        returnDate : Date;  // null until returned
    }
}

// ─────────────────────────────────────────────────────────────
// AGGREGATION SUPPORT FOR ANALYTICAL LIST PAGE (ALP)
// 
// ALP requires entity-set-level annotations declaring which
// properties are dimensions (grouping) vs measures (numeric).
// Without these, ALP wizard rejects the entity as "not analytical".
//
// @Aggregation.ApplySupported       — declares the entity supports $apply
// @Analytics.AggregatedProperty     — defines a measure (numeric KPI)
// @Common.Label                     — human-readable labels for chart axes
// ─────────────────────────────────────────────────────────────
annotate smart.library.Books with @(
    Aggregation.ApplySupported : {
        $Type                  : 'Aggregation.ApplySupportedType',
        Transformations        : [
            'aggregate',
            'topcount',
            'bottomcount',
            'identity',
            'concat',
            'groupby',
            'filter',
            'expand',
            'top',
            'skip',
            'orderby',
            'search'
        ],
        Rollup                 : #None,
        PropertyRestrictions   : true,
        GroupableProperties    : [ genre, status, author_ID ],
        AggregatableProperties : [
            { Property: stock },
            { Property: price }
        ]
    },

    Analytics.AggregatedProperty #totalStock : {
        $Type                : 'Analytics.AggregatedPropertyType',
        Name                 : 'totalStock',
        AggregatableProperty : stock,
        AggregationMethod    : 'sum',
        ![@Common.Label]     : 'Total Stock'
    },

    Analytics.AggregatedProperty #avgPrice : {
        $Type                : 'Analytics.AggregatedPropertyType',
        Name                 : 'avgPrice',
        AggregatableProperty : price,
        AggregationMethod    : 'average',
        ![@Common.Label]     : 'Average Price'
    },

    Analytics.AggregatedProperty #bookCount : {
        $Type                : 'Analytics.AggregatedPropertyType',
        Name                 : 'bookCount',
        AggregatableProperty : ID,
        AggregationMethod    : 'countdistinct',
        ![@Common.Label]     : 'Book Count'
    }
) {
    // Mark dimensions — these are the "group by" axes for charts
    @Common.Label : 'Genre'
    genre @Analytics.Dimension : true;

    @Common.Label : 'Status'
    status @Analytics.Dimension : true;

    @Common.Label : 'Author'
    author @Analytics.Dimension : true;

    // Mark measures — numeric values that can be summed/averaged
    @Common.Label : 'Stock'
    stock @Analytics.Measure : true @Aggregation.default : #SUM;

    @Common.Label : 'Price'
    price @Analytics.Measure : true @Aggregation.default : #AVG;
};