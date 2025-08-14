import admin from '../config/firebase.js';
import Users from '../model/Users.js';
import AuthRoleHt from '../model/AuthRoleHt.js';
import FcmToken from '../model/FcmToken.js';
import PersDataKaryawan from "../model/PersDataKaryawan.js";
import PersDepartemen from "../model/PersDepartemen.js";
import ScheduledNotification from '../model/ScheduledNotification.js';
import { Op, Sequelize } from 'sequelize';

const sendToTokens = async (tokens, title, body, data = {}) => {
  if (!tokens.length) return { success: false, message: 'No tokens found' };

  try {
    const messages = tokens.map(token => ({
      notification: { title, body },
      data: { ...data, timestamp: Date.now().toString() },
      token: token
    }));

    const response = await admin.messaging().sendEach(messages);
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount
    };
  } catch (error) {
    console.error('Firebase messaging error:', error);
    return { success: false, error: error.message };
  }
};

export const sendToAll = async (req, res) => {
  const { title, body, data } = req.body;
  
  const tokens = await FcmToken.findAll({
    where: { is_active: true },
    attributes: ['token']
  });
  const tokenList = tokens.map(t => t.token);

  const result = await sendToTokens(tokenList, title, body, data);
  res.json(result);
};

export const sendToRole = async (req, res) => {
  const { role, title, body, data } = req.body;
  
  const tokens = await FcmToken.findAll({
    where: { is_active: true },
    include: [{
      model: Users,
      include: [{
        model: AuthRoleHt,
        where: { id_role: role }
      }]
    }],
    attributes: ['token']
  });
  const tokenList = tokens.map(t => t.token);

  const result = await sendToTokens(tokenList, title, body, data);
  res.json(result);
};

export const sendToUsers = async (req, res) => {
  const { userIds, title, body, data } = req.body;
  
  const tokens = await FcmToken.findAll({
    where: {
      karyawanid: { [Op.in]: userIds },
      is_active: true
    },
    attributes: ['token']
  });
  const tokenList = tokens.map(t => t.token);

  const result = await sendToTokens(tokenList, title, body, data);
  res.json(result);
};

export const sendBirthdayNotifications = async (req, res, next) => {
  try {
    const today = new Date();
    const todayString = today.toISOString().slice(5, 10);

    // Find employees with birthday today
    const birthdayEmployees = await PersDataKaryawan.findAll({
      attributes: ['nama_karyawan', 'tanggal_lahir', 'perusahaan'],
      include: [{
        model: PersDepartemen,
        attributes: ['desc'],
        required: false
      }],
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('tanggal_lahir'), '%m-%d'),
            todayString
          ),
          Sequelize.literal("tanggal_keluar = '0000-00-00'")
        ]
      }
    });

    if (birthdayEmployees.length === 0) {
      return res.json({ success: true, message: 'No birthdays today' });
    }

    // Get all active FCM tokens
    const tokens = await FcmToken.findAll({
      where: { is_active: true },
      attributes: ['token']
    });
    const tokenList = tokens.map(t => t.token);

    if (!tokenList.length) {
      return res.json({ success: true, message: 'No active tokens found' });
    }

    // Send notification
    const birthdayNames = birthdayEmployees.map(emp => emp.nama_karyawan).join(', ');
    const title = '🎉 Birthday Celebration!';
    const body = `Today is ${birthdayNames}'s birthday! Let's wish them well! 🎂`;

    const result = await sendToTokens(tokenList, title, body, {
      type: 'birthday',
      employees: birthdayNames,
      date: today.toISOString().split('T')[0]
    });

    console.log(`🎂 Birthday notification sent for: ${birthdayNames}`, result);
    res.json({ ...result, employees: birthdayNames });
  } catch (error) {
    next(error);
  }
};

export const scheduleNotification = async (req, res, next) => {
  try {
    const { title, body, data, target_type, target_value, scheduled_at } = req.body;
    const userId = req.user.id;

    // Validate scheduled time is in the future
    const scheduledTime = new Date(scheduled_at);
    if (scheduledTime <= new Date()) {
      return res.status(400).json({ success: false, message: 'Scheduled time must be in the future' });
    }

    const notification = await ScheduledNotification.create({
      title,
      body,
      data: data || {},
      target_type,
      target_value,
      scheduled_at: scheduledTime,
      created_by: userId
    });

    res.json({ success: true, data: notification, message: 'Notification scheduled successfully' });
  } catch (error) {
    next(error);
  }
};

export const getScheduledNotifications = async (req, res, next) => {
  try {
    const notifications = await ScheduledNotification.findAll({
      where: {
        status: {
          [Op.in]: ['pending', 'sent']
        }
      },
      order: [['scheduled_at', 'ASC']]
    });

    res.json({ success: true, data: notifications, message: 'Scheduled notifications retrieved' });
  } catch (error) {
    next(error);
  }
};

export const cancelScheduledNotification = async (req, res, next) => {
  try {
    const { id } = req.params;

    const notification = await ScheduledNotification.findByPk(id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    if (notification.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Can only cancel pending notifications' });
    }

    await notification.update({ status: 'cancelled' });

    res.json({ success: true, data: {}, message: 'Notification cancelled successfully' });
  } catch (error) {
    next(error);
  }
};

export const processScheduledNotifications = async () => {
  try {
    const now = new Date();
    
    const notifications = await ScheduledNotification.findAll({
      where: {
        status: 'pending',
        scheduled_at: {
          [Op.lte]: now
        }
      }
    });

    for (const notification of notifications) {
      await sendScheduledNotification(notification);
    }
  } catch (error) {
    console.error('📅 Scheduler error:', error);
  }
};

export const sendScheduledNotification = async (notification) => {
  try {
    let result;
    let tokenList = [];

    switch (notification.target_type) {
      case 'all':
        const allTokens = await FcmToken.findAll({
          where: { is_active: true },
          attributes: ['token']
        });
        tokenList = allTokens.map(t => t.token);
        break;
      case 'role':
        const roleTokens = await FcmToken.findAll({
          where: { is_active: true },
          include: [{
            model: Users,
            include: [{
              model: AuthRoleHt,
              where: { id_role: notification.target_value.roleId }
            }]
          }],
          attributes: ['token']
        });
        tokenList = roleTokens.map(t => t.token);
        break;
      case 'users':
        const userTokens = await FcmToken.findAll({
          where: {
            karyawanid: { [Op.in]: notification.target_value.userIds },
            is_active: true
          },
          attributes: ['token']
        });
        tokenList = userTokens.map(t => t.token);
        break;
    }

    result = await sendToTokens(tokenList, notification.title, notification.body, notification.data || {});

    // Update notification status
    await notification.update({
      status: result.success ? 'sent' : 'failed',
      sent_at: new Date()
    });

    console.log(`📅 Scheduled notification ${notification.id} sent:`, result);
  } catch (error) {
    console.error(`📅 Failed to send scheduled notification ${notification.id}:`, error);
    
    await notification.update({
      status: 'failed',
      sent_at: new Date()
    });
  }
};

export const sendTodayBirthdayNotifications = async () => {
  try {
    const today = new Date();
    const todayString = today.toISOString().slice(5, 10);

    const birthdayEmployees = await PersDataKaryawan.findAll({
      attributes: ['nama_karyawan'],
      where: {
        [Op.and]: [
          Sequelize.where(
            Sequelize.fn('DATE_FORMAT', Sequelize.col('tanggal_lahir'), '%m-%d'),
            todayString
          ),
          Sequelize.literal("tanggal_keluar = '0000-00-00'")
        ]
      }
    });

    if (birthdayEmployees.length === 0) {
      console.log('🎂 No birthdays today');
      return;
    }

    const tokens = await FcmToken.findAll({
      where: { is_active: true },
      attributes: ['token']
    });
    const tokenList = tokens.map(t => t.token);

    const birthdayNames = birthdayEmployees.map(emp => emp.nama_karyawan).join(', ');
    const title = '🎉 Birthday Celebration!';
    const body = `Today is ${birthdayNames}'s birthday! Let's wish them well! 🎂`;

    const result = await sendToTokens(tokenList, title, body, {
      type: 'birthday',
      employees: birthdayNames,
      date: today.toISOString().split('T')[0]
    });

    console.log(`🎂 Birthday notification sent for: ${birthdayNames}`, result);
  } catch (error) {
    console.error('🎂 Birthday notification error:', error);
  }
};