// Old: using {smart.notifications.Notifications as db} from '../db/notifications-schema';
// The context wrapper was removed to fix CAP v9 shadowing error, so we now
// alias the whole namespace. db.Notifications → smart.notifications.Notifications
using smart.notifications as db from '../db/notifications-schema';
service NotificationsService @(path: '/notifications') {

    entity Notifications as projection on db.Notifications
        actions {
            action markAsRead() returns Notifications;
        };

    @readonly
    entity RawEvents     as projection on db.RawEvents;
}