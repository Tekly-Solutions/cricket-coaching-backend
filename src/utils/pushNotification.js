import admin from '../config/firebase.js';
import User from '../models/User.js';

/**
 * Send a push notification to a user (by their MongoDB User._id).
 * Automatically removes stale/invalid tokens.
 *
 * @param {string|ObjectId} userId  - MongoDB User._id
 * @param {{ title: string, body: string, data?: Record<string,string> }} payload
 */
export async function sendPushToUser(userId, { title, body, data = {} }) {
  try {
    const user = await User.findById(userId).select('fcmTokens preferences');
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) return;

    // Respect per-user push preference
    if (user.preferences?.pushNotifications === false) return;

    const tokens = [...new Set(user.fcmTokens)]; // de-dup

    const message = {
      notification: { title, body },
      data: { ...data, click_action: 'FLUTTER_NOTIFICATION_CLICK' },
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);

    // Remove tokens that are no longer valid
    const staleTokens = [];
    response.responses.forEach((resp, idx) => {
      if (!resp.success) {
        const code = resp.error?.code;
        if (
          code === 'messaging/registration-token-not-registered' ||
          code === 'messaging/invalid-registration-token'
        ) {
          staleTokens.push(tokens[idx]);
        }
      }
    });

    if (staleTokens.length > 0) {
      await User.findByIdAndUpdate(userId, {
        $pull: { fcmTokens: { $in: staleTokens } },
      });
    }

    console.log(
      `🔔 Push sent to user ${userId}: ${response.successCount} success, ${response.failureCount} fail`
    );
  } catch (err) {
    // Never let a push failure break the main flow
    console.error('sendPushToUser error:', err.message);
  }
}
