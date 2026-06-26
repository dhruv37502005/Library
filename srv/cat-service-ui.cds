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
        Description    : { Value : author.name }
    },

    UI.LineItem : [
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

