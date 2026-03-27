sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/dhruv/listobjectlibrary/test/integration/pages/AuthorsList",
	"com/dhruv/listobjectlibrary/test/integration/pages/AuthorsObjectPage",
	"com/dhruv/listobjectlibrary/test/integration/pages/BooksObjectPage"
], function (JourneyRunner, AuthorsList, AuthorsObjectPage, BooksObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/dhruv/listobjectlibrary') + '/test/flp.html#app-preview',
        pages: {
			onTheAuthorsList: AuthorsList,
			onTheAuthorsObjectPage: AuthorsObjectPage,
			onTheBooksObjectPage: BooksObjectPage
        },
        async: true
    });

    return runner;
});

