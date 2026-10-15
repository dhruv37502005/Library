using CatService as service from './cat-service';

//////////////////////////////////////////////////////////////
// AUTHORS — LIST REPORT CONFIGURATION
//////////////////////////////////////////////////////////////

annotate service.Authors with @(

    Search.searchable           : true,
    Search.defaultSearchElement : name,

    UI.SelectionFields : [
        name,
        country
    ],

    UI.HeaderInfo : {
        TypeName : 'Author',
        Title    : { Value : name }
    },

    UI.LineItem : [
        { Value: name    },
        { Value: country }
    ],

    UI.PresentationVariant : {
        SortOrder : [
            { Property : name, Descending : false }
        ]
    }
);

//////////////////////////////////////////////////////////////
// AUTHORS — OBJECT PAGE + IDENTIFICATION (fixes Author tab)
//////////////////////////////////////////////////////////////

annotate service.Authors with @(

    // ✅ THIS IS THE FIX — author/@UI.Identification now resolves
    UI.Identification : [
        { Value: name            },
        { Value: country         },
        { Value: businessId      },
        { Value: address_street  },
        { Value: address_city    },
        { Value: address_zipCode }
    ],

    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#General'
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Books',
            Target : 'books/@UI.LineItem'
        }
    ],

    UI.FieldGroup #General : {
        Data : [
            { Value: name            },
            { Value: country         },
            { Value: businessId      },
            { Value: address_street  },
            { Value: address_city    },
            { Value: address_zipCode }
        ]
    }
);

//////////////////////////////////////////////////////////////
// AUTHORS — FIELD LABELS + VALUE HELP
//////////////////////////////////////////////////////////////

annotate service.Authors with {
    country @Common.ValueList : {
        $Type          : 'Common.ValueListType',
        CollectionPath : 'Authors',
        Parameters     : [
            {
                $Type             : 'Common.ValueListParameterInOut',
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

    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'General Information',
            Target : '@UI.Identification'        // ✅ Books own @UI.Identification
        },
        {
            $Type  : 'UI.ReferenceFacet',
            Label  : 'Author',
            Target : 'author/@UI.Identification' // ✅ Now resolves — Authors has it
        }
    ],

    UI.HeaderInfo : {
        TypeName       : 'Book',
        TypeNamePlural : 'Books',
        Title          : { Value : title       },
        Description    : { Value : author.name },
        // Added Session P1: renders coverImageUrl as the Object Page hero image.
        // Fiori Elements V4 reads ImageUrl from @UI.HeaderInfo; the field must be
        // an Edm.String containing a URL (which coverImageUrl already is).
        ImageUrl       : coverImageUrl
    },

        UI.LineItem : [
        // Added Session P1: cover thumbnail. Renders as <img> because
        // coverImageUrl is annotated with @UI.IsImageUrl below.
        { Value: coverImageUrl, Label: 'Cover' },
        { Value: title,       Label: 'Title'  },
        { Value: author.name, Label: 'Author' },
        { Value: genre,       Label: 'Genre'  },
        { Value: price,       Label: 'Price'  },
        { Value: stock,       Label: 'Stock'  },
        { Value: status,      Label: 'Status' }
    ],

    UI.Identification : [
    // ─── Action buttons rendered in Object Page header toolbar ───
    // $Type 'DataFieldForAction' tells Fiori Elements: this is not a data
    // field, it's a button that invokes the named bound action.
    // Fiori auto-generates a dialog from the action's parameter signature
    // (percentage, startDate, endDate) — no manual form needed.
    {
        $Type  : 'UI.DataFieldForAction',
        Label  : 'Apply Discount',
        Action : 'CatService.applyDiscount'
    },
    {
        $Type  : 'UI.DataFieldForAction',
        Label  : 'Restock',
        Action : 'CatService.restock'
    },

    // ─── Data fields (rendered as labeled values in General Info group) ───
    { Value: title          },
    { Value: description    },
    { Value: publishedAt    },
    { Value: availability   },
    { Value: genre          },
    { Value: price,          Label: 'Base Price'      },
    { Value: effectivePrice, Label: 'Effective Price' },
    { Value: stock          },
    { Value: status         }
],

    UI.DataPoint #Availability : {
        Value : availability
    }
);

//////////////////////////////////////////////////////////////
// BOOKS — ANALYTICS (CHART)
//////////////////////////////////////////////////////////////

annotate service.Books with @(
    UI.Chart : {
        ChartType  : #Column,
        Dimensions : [ genre ],
        Measures   : [ stock ]
    }
);

//////////////////////////////////////////////////////////////
// BOOKS — ACTION BUTTONS
//////////////////////////////////////////////////////////////

annotate service.Books actions {
    restock @(
        UI.DataFieldForAction : {
            Label  : 'Restock',
            Action : 'CatService.restock'
        }
    );
    applyDiscount @(
        UI.DataFieldForAction : {
            Label  : 'Apply Discount',
            Action : 'CatService.applyDiscount'
        }
    );
};

// ─────────────────────────────────────────────────────────────
// Session P1: coverImageUrl field-level semantics
//
// @UI.IsImageUrl tells Fiori Elements to render the string as an
// image (<img src="...">) rather than plain text. This is what
// makes the thumbnail column and hero image actually appear.
//
// @Common.Text provides the alt-text fallback (uses `title`).
// @Common.Label sets the column header when used in @UI.LineItem.
//
// Syntax note: `annotate X with { field @(...) }` is the correct
// form for field-level annotations. `annotate X.field @(...)` also
// works but is less readable when multiple fields are involved.
// ─────────────────────────────────────────────────────────────
annotate service.Books with {
    coverImageUrl @(
        UI.IsImageUrl : true,
        Common.Label  : 'Cover'
    )
};