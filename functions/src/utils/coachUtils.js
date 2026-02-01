import Session from '../models/Session.js';
import mongoose from 'mongoose';

/**
 * Calculate completion ratio for a coach
 * @param {string} coachId - Coach's user ID
 * @returns {Promise<{ totalSessions: number, completedSessions: number, cancelledSessions: number, completionRatio: number }>}
 */
export const calculateCoachCompletionRatio = async (coachId) => {
  if (!mongoose.Types.ObjectId.isValid(coachId)) {
    return { totalSessions: 0, completedSessions: 0, cancelledSessions: 0, completionRatio: 0 };
  }

  try {
    const stats = await Session.aggregate([
      {
        $match: {
          coach: new mongoose.Types.ObjectId(coachId),
          status: { $in: ['completed', 'cancelled'] }, // only count relevant statuses
        },
      },
      {
        $group: {
          _id: null,
          totalSessions: { $sum: 1 },
          completedSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
          },
          cancelledSessions: {
            $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalSessions: 0,
      completedSessions: 0,
      cancelledSessions: 0,
    };

    const relevantTotal = result.completedSessions + result.cancelledSessions;
    const completionRatio = relevantTotal > 0
      ? Number(((result.completedSessions / relevantTotal) * 100).toFixed(1))
      : 0;

    return {
      totalSessions: result.totalSessions,
      completedSessions: result.completedSessions,
      cancelledSessions: result.cancelledSessions,
      completionRatio,
    };
  } catch (error) {
    console.error('Completion ratio calculation error:', error);
    return { totalSessions: 0, completedSessions: 0, cancelledSessions: 0, completionRatio: 0 };
  }
};