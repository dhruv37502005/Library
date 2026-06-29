// ─────────────────────────────────────────────────────────────
// Loan Management — UI Annotations
//
// Cleaned up from Joule's auto-generated draft:
//   - Fixed import path (cat-service, not cat-service-ui)
//   - Added missing book + member columns to List Report
//   - Replaced internal audit fields in book Value Help with
//     semantically meaningful ones (title, genre, stock)
// ─────────────────────────────────────────────────────────────
using CatService as service from '../../srv/cat-service';

annotate service.Loans with @(

    // ── List Report table columns ──
    // Both Book and Member columns added so users can identify
    // the loan at a glance instead of guessing from dates alone.
    UI.LineItem : [
        { $Type: 'UI.DataField', Value: book_ID,    Label: 'Book'   },
        { $Type: 'UI.DataField', Value: member_ID,  Label: 'Member' },
        { $Type: 'UI.DataField', Value: borrowDate, Label: 'Borrowed On' },
        { $Type: 'UI.DataField', Value: dueDate,    Label: 'Due By' },
        { $Type: 'UI.DataField', Value: returnDate, Label: 'Returned On' }
    ],

    // ── Object Page header ──
    UI.HeaderInfo : {
        TypeName       : 'Loan',
        TypeNamePlural : 'Loans',
        Title          : { Value: book_ID },
        Description    : { Value: member_ID }
    },

    // ── Object Page facets + field group ──
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            { $Type: 'UI.DataField', Value: book_ID,    Label: 'Book' },
            { $Type: 'UI.DataField', Value: member_ID,  Label: 'Member' },
            { $Type: 'UI.DataField', Value: borrowDate, Label: 'Borrowed On' },
            { $Type: 'UI.DataField', Value: dueDate,    Label: 'Due By' },
            { $Type: 'UI.DataField', Value: returnDate, Label: 'Returned On' }
        ]
    },

    UI.Facets : [
        {
            $Type  : 'UI.ReferenceFacet',
            ID     : 'GeneratedFacet1',
            Label  : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup'
        }
    ],

    // ── Filter bar fields ──
    // member + returnDate filter so users can find e.g. "all unreturned
    // loans for Alice" via the standard Fiori filter UX.
    UI.SelectionFields : [
        member_ID,
        returnDate
    ]
);

// ─────────────────────────────────────────────────────────────
// Value Help — Book selection
// Only meaningful fields shown: title, genre, stock.
// (Removed internal audit fields approvedBy/approvedAt from Joule draft.)
// ─────────────────────────────────────────────────────────────
annotate service.Loans with {
    book @Common.ValueList : {
        $Type          : 'Common.ValueListType',
        CollectionPath : 'Books',
        Parameters     : [
            { $Type: 'Common.ValueListParameterInOut',
              LocalDataProperty: book_ID,
              ValueListProperty: 'ID' },
            { $Type: 'Common.ValueListParameterDisplayOnly',
              ValueListProperty: 'title' },
            { $Type: 'Common.ValueListParameterDisplayOnly',
              ValueListProperty: 'genre' },
            { $Type: 'Common.ValueListParameterDisplayOnly',
              ValueListProperty: 'stock' }
        ]
    }
};

// ─────────────────────────────────────────────────────────────
// Value Help — Member selection
// ─────────────────────────────────────────────────────────────
annotate service.Loans with {
    member @Common.ValueList : {
        $Type          : 'Common.ValueListType',
        CollectionPath : 'Members',
        Parameters     : [
            { $Type: 'Common.ValueListParameterInOut',
              LocalDataProperty: member_ID,
              ValueListProperty: 'ID' },
            { $Type: 'Common.ValueListParameterDisplayOnly',
              ValueListProperty: 'name' },
            { $Type: 'Common.ValueListParameterDisplayOnly',
              ValueListProperty: 'email' },
            { $Type: 'Common.ValueListParameterDisplayOnly',
              ValueListProperty: 'membershipType' }
        ]
    }
};

// ─────────────────────────────────────────────────────────────
// Text Associations + FK Labels
//
// Fiori renders the FK column (book_ID) as raw UUID by default.
// @Common.Text tells it: "navigate to the associated entity and
// show this property instead". TextArrangement #TextOnly hides
// the UUID entirely — users see only "1984" not "1984 (33333333-...)".
// ─────────────────────────────────────────────────────────────
annotate service.Loans with {
    book_ID @(
        Common.Label              : 'Book',
        Common.Text               : book.title,
        Common.TextArrangement    : #TextOnly
    );

    member_ID @(
        Common.Label              : 'Member',
        Common.Text               : member.name,
        Common.TextArrangement    : #TextOnly
    );
};