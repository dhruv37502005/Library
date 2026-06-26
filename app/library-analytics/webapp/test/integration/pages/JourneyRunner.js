sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/dhruv/libraryanalytics/test/integration/pages/BooksList",
	"com/dhruv/libraryanalytics/test/integration/pages/BooksObjectPage"
], function (JourneyRunner, BooksList, BooksObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/dhruv/libraryanalytics') + '/test/flp.html#app-preview',
        pages: {
			onTheBooksList: BooksList,
			onTheBooksObjectPage: BooksObjectPage
        },
        async: true
    });

    return runner;
});

