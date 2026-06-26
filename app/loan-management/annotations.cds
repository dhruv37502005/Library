using CatService as service from '../../srv/cat-service-ui';
annotate service.Loans with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'borrowDate',
                Value : borrowDate,
            },
            {
                $Type : 'UI.DataField',
                Label : 'dueDate',
                Value : dueDate,
            },
            {
                $Type : 'UI.DataField',
                Label : 'returnDate',
                Value : returnDate,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'borrowDate',
            Value : borrowDate,
        },
        {
            $Type : 'UI.DataField',
            Label : 'dueDate',
            Value : dueDate,
        },
        {
            $Type : 'UI.DataField',
            Label : 'returnDate',
            Value : returnDate,
        },
    ],
);

annotate service.Loans with {
    book @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Books',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : book_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'approvedBy',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'approvedAt',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'title',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'stock',
            },
        ],
    }
};

annotate service.Loans with {
    member @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'Members',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : member_ID,
                ValueListProperty : 'ID',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'email',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'joinDate',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'membershipType',
            },
        ],
    }
};

