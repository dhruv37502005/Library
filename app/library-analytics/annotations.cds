using CatService as service from '../../srv/cat-service';

annotate service.Books with @(

    UI.SelectionFields : [ genre, status, author_ID ],

    // Qualifier #Analytics — coexists with the LineItem in cat-service-ui.cds
    UI.LineItem #Analytics : [
        { $Type: 'UI.DataField', Value: title,        Label: 'Title'   },
        { $Type: 'UI.DataField', Value: genre,        Label: 'Genre'   },
        { $Type: 'UI.DataField', Value: status,       Label: 'Status'  },
        { $Type: 'UI.DataField', Value: price,        Label: 'Price'   },
        { $Type: 'UI.DataField', Value: stock,        Label: 'Stock'   },
        { $Type: 'UI.DataField', Value: availability, Label: 'Availability' }
    ],

    UI.Chart #StockByGenre : {
    $Type               : 'UI.ChartDefinitionType',
    Title               : 'Stock by Genre',
    ChartType           : #Column,
    Dimensions          : [ genre ],
    DimensionAttributes : [
        { $Type: 'UI.ChartDimensionAttributeType', Dimension: genre, Role: #Category }
    ],
    // ─── V4 sap.fe charts need DynamicMeasures pointing to AggregatedProperty ───
    // We defined Analytics.AggregatedProperty #totalStock in schema.cds.
    // The chart references it via the annotation path with @ prefix.
    DynamicMeasures     : [
        '@Analytics.AggregatedProperty#totalStock'
    ],
    MeasureAttributes   : [
        {
            $Type           : 'UI.ChartMeasureAttributeType',
            DynamicMeasure  : '@Analytics.AggregatedProperty#totalStock',
            Role            : #Axis1
        }
    ]
},

    UI.PresentationVariant #Analytics : {
        $Type          : 'UI.PresentationVariantType',
        SortOrder      : [ { Property: price, Descending: true } ],
        Visualizations : [
            '@UI.Chart#StockByGenre',
            '@UI.LineItem#Analytics'
        ]
    }
);