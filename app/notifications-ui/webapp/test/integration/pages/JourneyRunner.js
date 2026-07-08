sap.ui.define([
    "sap/fe/test/JourneyRunner",
	"com/dhruv/notificationsui/test/integration/pages/NotificationsList",
	"com/dhruv/notificationsui/test/integration/pages/NotificationsObjectPage"
], function (JourneyRunner, NotificationsList, NotificationsObjectPage) {
    'use strict';

    var runner = new JourneyRunner({
        launchUrl: sap.ui.require.toUrl('com/dhruv/notificationsui') + '/test/flp.html#app-preview',
        pages: {
			onTheNotificationsList: NotificationsList,
			onTheNotificationsObjectPage: NotificationsObjectPage
        },
        async: true
    });

    return runner;
});

