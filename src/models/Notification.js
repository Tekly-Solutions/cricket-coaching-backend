import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },

    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      // Can be null for system notifications
    },

    type: {
      type: String,
      enum: [
        'booking_request',
        'booking_confirmed',
        'booking_cancelled',
        'session_reminder',
        'session_updated',
        'session_cancelled',
        'payment_received',
        'payment_pending',
        'new_review',
        'new_comment',
        'new_message',
        'achievement',
        'profile_completion',
        'system',
      ],
      required: true,
    },

    category: {
      type: String,
      enum: ['Mentions', 'Schedule', 'Performance', 'Payments', 'Other'],
      default: 'Other',
    },

    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },

    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // Related entities for navigation
    relatedEntity: {
      entityType: {
        type: String,
        enum: ['session', 'booking', 'payment', 'review', 'message', 'user'],
      },
      entityId: {
        type: mongoose.Schema.Types.ObjectId,
      },
    },

    isRead: {
      type: Boolean,
      default: false,
      index: true,
    },

    readAt: {
      type: Date,
    },

    // For grouping and priority
    priority: {
      type: String,
      enum: ['low', 'normal', 'high', 'urgent'],
      default: 'normal',
    },

    // Action button data (optional)
    actionButton: {
      text: String,
      action: String, // 'view', 'accept', 'reject', 'reply', etc.
      url: String,
    },

    // System notification metadata
    metadata: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },

    expiresAt: {
      type: Date,
      // Notifications can auto-delete after certain period
    },
  },
  { 
    timestamps: true,
    // Automatically delete expired notifications
    expireAfterSeconds: 0,
  }
);

// Indexes for performance
notificationSchema.index({ recipient: 1, createdAt: -1 });
notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, category: 1 });
notificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Virtual for time ago
notificationSchema.virtual('timeAgo').get(function() {
  const now = new Date();
  const diff = now - this.createdAt;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return 'Last Week';
});

// Helper method to mark as read
notificationSchema.methods.markAsRead = async function() {
  if (!this.isRead) {
    this.isRead = true;
    this.readAt = new Date();
    await this.save();
  }
  return this;
};

// Static method to create notification
notificationSchema.statics.createNotification = async function(data) {
  const notification = await this.create(data);
  // TODO: Emit socket event for real-time notification
  return notification;
};

// Static method to mark all as read for a user
notificationSchema.statics.markAllAsRead = async function(userId) {
  return this.updateMany(
    { recipient: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
};

export default mongoose.model('Notification', notificationSchema);
