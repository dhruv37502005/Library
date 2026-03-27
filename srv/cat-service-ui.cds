using CatService as service from './cat-service';

//////////////////////////////////////////////////////////////
// AUTHORS — LIST REPORT CONFIGURATION
// Controls the first page table + filter bar
//////////////////////////////////////////////////////////////

annotate service.Authors with @(

    // Enables global search bar
    Search.searchable : true,
    Search.defaultSearchElement : name,

    // Filter bar fields
    UI.SelectionFields : [
        name,
        country
    ],

    // Page title
    UI.HeaderInfo : {
        TypeName : 'Author',
        Title : { Value : name }
    },

    // Table columns in list page   
    UI.LineItem : [
        { Value: name },
        { Value: country }
    ],

    // Default sorting
    UI.PresentationVariant : {
        SortOrder : [
            { Property : name, Descending : false }
        ]
    }
);

//////////////////////////////////////////////////////////////
// AUTHORS — OBJECT PAGE STRUCTURE
// Defines sections inside Author details screen
//////////////////////////////////////////////////////////////

annotate service.Authors with @(

    UI.Facets : [
        {
            // Form section
            $Type  : 'UI.ReferenceFacet',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#General'
        },
        {
            // Child table section
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Books',
            Target : 'books/@UI.LineItem'
        }
    ],

    // Form fields layout
    UI.FieldGroup #General : {
        Data : [
            { Value: name },
            { Value: country },
            { Value: businessId },
            { Value: address_street },
            { Value: address_city },
            { Value: address_zipCode }
        ]
    }
);

//////////////////////////////////////////////////////////////
// AUTHORS — FIELD LABELS + VALUE HELP
// Improves readability and filter usability
//////////////////////////////////////////////////////////////

annotate service.Authors with {


    // Dropdown suggestion for country filter
    country @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Authors',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : country,
                ValueListProperty : country
            }
        ]
    };
};

//////////////////////////////////////////////////////////////
// BOOKS — OBJECT PAGE + TABLE BEHAVIOR
//////////////////////////////////////////////////////////////

annotate service.Books with @(

    // Book detail page sections
    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'General Information',
            Target : '@UI.Identification'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Author',
            Target : 'author/@UI.Identification'
        }
    ],

    // Book page header
    UI.HeaderInfo : {
        TypeName       : 'Book',
        TypeNamePlural : 'Books',
        Title          : { Value : title },
        Description    : { Value : author.name }
    },

    // Books table inside Author page
    UI.LineItem : [
        { Value: title },
        { Value: author.name, Label: 'Author' },
        { Value: genre },
        { Value: price },
        { Value: stock },
        { Value: status }
    ],

    // Book detail fields
    UI.Identification : [
        { Value: title },
        { Value: description },
        { Value: publishedAt },
        { Value: availability },
        { Value: genre },
        { Value: price },
        { Value: stock },
        { Value: status }
    ],

    // Status indicator
    UI.DataPoint #Availability : {
        Value : availability
    }
);

//////////////////////////////////////////////////////////////
// BOOKS — ANALYTICS (CHART)
//////////////////////////////////////////////////////////////

annotate service.Books with @(
    UI.Chart : {
        ChartType : #Column,
        Dimensions : [ genre ],
        Measures : [ stock ]
    }
);

//////////////////////////////////////////////////////////////
// BOOKS — ACTION BUTTONS (OBJECT PAGE TOOLBAR)
//////////////////////////////////////////////////////////////

annotate service.Books actions {

    restock @(
        UI.DataFieldForAction : {
            Label : 'Restock',
            Action : 'CatService.restock'
        }
    );

    applyDiscount @(
        UI.DataFieldForAction : {
            Label : 'Apply Discount',
            Action : 'CatService.applyDiscount'
        }
    );
};

//////////////////////////////////////////////////////////////
// BOOKS — VALUE HELP (AUTHOR SELECTION DURING CREATE)
//////////////////////////////////////////////////////////////

annotate service.Books with {
    author_ID @Common.ValueList : {
        CollectionPath : 'Authors',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : author_ID,
                ValueListProperty : ID
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : name
            }
        ]
    };
};
