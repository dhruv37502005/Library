using CatService as service from '../../srv/cat-service';

// ─────────────────────────────────────────────────────────────
// OVP CARD 1 — Expensive Books (List Card)
//
// Pattern: For OVP list cards, we need:
//   1. UI.PresentationVariant — defines sort + which lineItem to use
//   2. UI.SelectionVariant    — defines the filter (e.g., price > 300)
//   3. UI.LineItem            — the actual columns shown in the card
// The OVP card in manifest.json then references all three by qualifier.
// ─────────────────────────────────────────────────────────────
annotate service.Books with @(

    // ── Presentation: sort by price descending, show top 5 ──
    UI.PresentationVariant #ExpensiveBooks : {
        $Type           : 'UI.PresentationVariantType',
        SortOrder       : [
            { Property: price, Descending: true }
        ],
        Visualizations  : [ '@UI.LineItem#ExpensiveBooks' ],
        MaxItems        : 5
    },

    // ── Filter: only books with price > 300 ──
    UI.SelectionVariant #ExpensiveBooks : {
        $Type      : 'UI.SelectionVariantType',
        Text       : 'Expensive Books',
        SelectOptions : [
            {
                $Type       : 'UI.SelectOptionType',
                PropertyName: price,
                Ranges      : [
                    {
                        $Type   : 'UI.SelectOptionRangeType',
                        Sign    : #I,            // Include
                        Option  : #GT,           // Greater Than
                        Low     : 300
                    }
                ]
            }
        ]
    },

    // ── LineItem: columns shown in the list card ──
    UI.LineItem #ExpensiveBooks : [
        { $Type: 'UI.DataField', Value: title, Label: 'Book' },
        { $Type: 'UI.DataField', Value: price, Label: 'Price' }
    ]
);