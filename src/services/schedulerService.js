import cron from 'node-cron';
import { processScheduledNotifications, sendTodayBirthdayNotifications } from '../controllers/notificationController.js';

class SchedulerService {
  constructor() {
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;

    // Run every minute to check for scheduled notifications
    cron.schedule('* * * * *', async () => {
      await processScheduledNotifications();
    });

    // Send birthday notifications at 9:00 AM every day
    cron.schedule('0 9 * * *', async () => {
      await sendTodayBirthdayNotifications();
    });

    this.isRunning = true;
    console.log('📅 Notification scheduler started (includes birthday notifications)');
  }


}

export default new SchedulerService();