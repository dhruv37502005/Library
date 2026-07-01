using {smart.notifications.Notifications as db} from '../db/notifications-schema';

service NotificationsService @(path: '/notifications') {

    entity Notifications as projection on db.Notifications
        actions {
            action markAsRead() returns Notifications;
        };

    @readonly
    entity RawEvents     as projection on db.RawEvents;
}