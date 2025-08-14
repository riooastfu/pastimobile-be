import express from 'express';
import { sendToAll, sendToRole, sendToUsers, sendBirthdayNotifications, scheduleNotification, getScheduledNotifications, cancelScheduledNotification } from '../controllers/NotificationController.js';
import { verifyToken, checkPasswordExpiration, checkRole } from '../middleware/middleware.js';

const notificationRouter = express.Router();

// Immediate notification routes
notificationRouter.post('/send-to-all', [verifyToken, checkPasswordExpiration, checkRole([1])], sendToAll);
notificationRouter.post('/send-to-role', [verifyToken, checkPasswordExpiration, checkRole(['admin', 'hr'])], sendToRole);
notificationRouter.post('/send-to-users', [verifyToken, checkPasswordExpiration, checkRole([1])], sendToUsers);

// Scheduled notification routes
notificationRouter.post('/schedule', [verifyToken, checkPasswordExpiration, checkRole([1])], scheduleNotification);
notificationRouter.get('/scheduled', [verifyToken, checkPasswordExpiration, checkRole([1])], getScheduledNotifications);
notificationRouter.delete('/scheduled/:id', [verifyToken, checkPasswordExpiration, checkRole([1])], cancelScheduledNotification);

// Birthday notification routes
notificationRouter.post('/birthday/send', [verifyToken, checkPasswordExpiration, checkRole([1])], sendBirthdayNotifications);

export default notificationRouter;