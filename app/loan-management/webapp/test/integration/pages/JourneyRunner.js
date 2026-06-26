sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"loanmanagement/test/integration/pages/LoansList",
	"loanmanagement/test/integration/pages/LoansObjectPage"
], function (JourneyRunner, LoansList, LoansObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('loanmanagement') + '/test/flp.html#app-preview',
        pages: {
			onTheLoansList: LoansList,
			onTheLoansObjectPage: LoansObjectPage
        },
        async: true
    });

    return runner;
});

