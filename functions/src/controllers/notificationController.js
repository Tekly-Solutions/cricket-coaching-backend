import Notification from '../models/Notification.js';
import { sendPushToUser } from '../utils/pushNotification.js';

/**
 * Get notifications for authenticated user
 * GET /api/notifications?category=all&unreadOnly=false&page=1&limit=20
 */
export const getNotifications = async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      category = 'all',
      unreadOnly = 'false',
      page = 1,
      limit = 20,
    } = req.query;

    // Build query
    const query = { recipient: userId };

    if (category !== 'all' && category !== 'All') {
      query.category = category;
    }

    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query
    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .populate('sender', 'fullName profileImage')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean(),
      Notification.countDocuments(query),
      Notification.countDocuments({ recipient: userId, isRead: false }),
    ]);

    // Add timeAgo to each notification
    const now = new Date();
    const notificationsWithTime = notifications.map(notif => {
      const diff = now - notif.createdAt;
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      let timeAgo;
      if (minutes < 1) timeAgo = 'Just now';
      else if (minutes < 60) timeAgo = `${minutes}m ago`;
      else if (hours < 24) timeAgo = `${hours}h ago`;
      else if (days === 1) timeAgo = 'Yesterday';
      else if (days < 7) timeAgo = `${days} days ago`;
      else timeAgo = 'Last Week';

      return {
        ...notif,
        timeAgo,
        // Format avatar/icon data for frontend
        avatar: notif.sender?.profileImage,
        iconData: _getIconData(notif.type),
      };
    });

    res.json({
      success: true,
      data: {
        notifications: notificationsWithTime,
        unreadCount,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / parseInt(limit)),
        },
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message,
    });
  }
};

/**
 * Get unread count
 * GET /api/notifications/unread-count
 */
export const getUnreadCount = async (req, res) => {
  try {
    const userId = req.user.userId;

    const count = await Notification.countDocuments({
      recipient: userId,
      isRead: false,
    });

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get unread count',
      error: error.message,
    });
  }
};

/**
 * Mark notification as read
 * PUT /api/notifications/:id/read
 */
export const markAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const notification = await Notification.findOne({
      _id: id,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    await notification.markAsRead();

    res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification,
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message,
    });
  }
};

/**
 * Mark all notifications as read
 * PUT /api/notifications/mark-all-read
 */
export const markAllAsRead = async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await Notification.markAllAsRead(userId);

    res.json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount,
      },
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message,
    });
  }
};

/**
 * Delete notification
 * DELETE /api/notifications/:id
 */
export const deleteNotification = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const notification = await Notification.findOneAndDelete({
      _id: id,
      recipient: userId,
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted',
    });
  } catch (error) {
    console.error('Delete notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message,
    });
  }
};

/**
 * Create notification (system/internal use)
 * POST /api/notifications
 */
export const createNotification = async (req, res) => {
  try {
    const {
      recipient,
      sender,
      type,
      category,
      title,
      description,
      relatedEntity,
      actionButton,
      priority,
    } = req.body;

    const actualRecipient = recipient || req.user.userId;

    const notification = await Notification.createNotification({
      recipient: actualRecipient,
      sender,
      type,
      category,
      title,
      description,
      relatedEntity,
      actionButton,
      priority: priority || 'normal',
    });

    if (req.body.sendPush) {
      sendPushToUser(actualRecipient, {
        title: title || 'New Notification',
        body: description || '',
        data: { route: actionButton?.url || '/notifications' },
      });
    }

    res.status(201).json({
      success: true,
      message: 'Notification created',
      data: notification,
    });
  } catch (error) {
    console.error('Create notification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create notification',
      error: error.message,
    });
  }
};

// Helper function to map notification types to icons
function _getIconData(type) {
  const iconMap = {
    booking_request: { icon: 'calendar_today', color: 'orange', bg: 'orange50' },
    booking_confirmed: { icon: 'check_circle', color: 'green', bg: 'green50' },
    booking_cancelled: { icon: 'cancel', color: 'red', bg: 'red50' },
    session_reminder: { icon: 'alarm', color: 'blue', bg: 'blue50' },
    session_updated: { icon: 'update', color: 'orange', bg: 'orange50' },
    session_cancelled: { icon: 'event_busy', color: 'red', bg: 'red50' },
    payment_received: { icon: 'payment', color: 'green', bg: 'green50' },
    payment_pending: { icon: 'hourglass_empty', color: 'orange', bg: 'orange50' },
    new_review: { icon: 'star', color: 'yellow', bg: 'yellow50' },
    new_comment: { icon: 'comment', color: 'blue', bg: 'blue50' },
    new_message: { icon: 'mail', color: 'blue', bg: 'blue50' },
    achievement: { icon: 'emoji_events', color: 'orange', bg: 'orange50' },
    system: { icon: 'info', color: 'grey', bg: 'grey50' },
  };

  return iconMap[type] || iconMap.system;
}