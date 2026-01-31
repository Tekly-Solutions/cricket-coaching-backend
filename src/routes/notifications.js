import express from 'express';
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification,
} from '../controllers/notificationController.js';
import { hybridAuth } from '../middlewares/hybridAuth.js';

const router = express.Router();

// All notification routes require authentication
// Supports both Firebase tokens and JWT tokens
router.use(hybridAuth);

// Get notifications for authenticated user
router.get('/', getNotifications);

// Get unread count
router.get('/unread-count', getUnreadCount);

// Mark all as read
router.put('/mark-all-read', markAllAsRead);

// Mark specific notification as read
router.put('/:id/read', markAsRead);

// Delete notification
router.delete('/:id', deleteNotification);

// Create notification (for system/internal use)
router.post('/', createNotification);

export default router;
