import Session from '../models/Session.js';
import User from '../models/User.js';
import CoachProfile from '../models/CoachProfile.js';
import PlayerProfile from '../models/PlayerProfile.js';
import GuardianProfile from '../models/GuardianProfile.js';
import Activity from '../models/Activity.js';

/**
 * Helper: Get unique players count for a coach
 */
async function getUniquePlayersCount(coachId) {
    const sessions = await Session.find({ coach: coachId });
    const playerIds = new Set();

    sessions.forEach(session => {
        session.assignedPlayers?.forEach(ap => {
            if (ap.player) playerIds.add(ap.player.toString());
        });
    });

    return playerIds.size;
}

/**
 * Helper: Calculate coach rating (placeholder - implement reviews later)
 */
async function getCoachRating(coachId) {
    // TODO: Implement when reviews/ratings are added
    // For now, return a default or calculated value
    const coachProfile = await CoachProfile.findOne({ userId: coachId });
    return coachProfile?.rating || 4.5; // Default rating
}

/**
 * GET /api/dashboard/coach
 * Returns coach dashboard data
 */
export const getCoachDashboard = async (req, res) => {
    try {
        const userId = req.user.userId;
        const now = new Date();
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

        // Get stats
        const totalSessions = await Session.countDocuments({ coach: userId });
        const totalPlayers = await getUniquePlayersCount(userId);
        const rating = await getCoachRating(userId);

        // Calculate Total Earnings (from Bookings, for robustness)
        // We fetch all sessions first to match bookings
        const allCoachSessions = await Session.find({ coach: userId }).select('_id');
        const allSessionIds = allCoachSessions.map(s => s._id);

        const totalEarningsResult = await import('../models/Booking.js').then(m => m.default.aggregate([
            {
                $match: {
                    session: { $in: allSessionIds },
                    status: { $in: ['confirmed', 'completed'] }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$pricing.total' }
                }
            }
        ]));

        const totalEarnings = totalEarningsResult[0]?.total || 0;

        // --- Today's Summary Calculations ---

        // 1. Today's Sessions Count
        const todaySessionsCount = await Session.countDocuments({
            coach: userId,
            'timeSlots.startTime': { $gte: startOfDay, $lt: endOfDay },
            status: { $nin: ['cancelled'] }
        });

        // 2. Today's Earnings (from Bookings for today's sessions)
        // Find sessions happening today
        const todaySessions = await Session.find({
            coach: userId,
            'timeSlots.startTime': { $gte: startOfDay, $lt: endOfDay },
            status: { $nin: ['cancelled'] }
        }).select('_id');

        const todaySessionIds = todaySessions.map(s => s._id);

        const todayEarningsResult = await import('../models/Booking.js').then(m => m.default.aggregate([
            {
                $match: {
                    session: { $in: todaySessionIds },
                    status: { $in: ['confirmed', 'completed'] }
                }
            },
            {
                $group: {
                    _id: null,
                    total: { $sum: '$pricing.total' }
                }
            }
        ]));

        const todayEarnings = todayEarningsResult[0]?.total || 0;

        // 3. Today's Students Count (Unique players in today's bookings)
        const todayStudentsResult = await import('../models/Booking.js').then(m => m.default.distinct('player', {
            session: { $in: todaySessionIds },
            status: { $in: ['confirmed', 'completed'] }
        }));

        const todayStudentsCount = todayStudentsResult.length;

        // --- End Today's Summary ---

        // Get upcoming sessions (next 2-3)
        const upcomingSessions = await Session.find({
            coach: userId,
            'timeSlots.startTime': { $gt: now },
            status: { $nin: ['cancelled', 'completed'] },
        })
            .sort({ 'timeSlots.startTime': 1 })
            .limit(3)
            .populate({
                path: 'assignedPlayers.player',
                select: 'fullName userId',
                populate: { path: 'userId', select: 'fullName' }
            })
            .lean();

        // Get recent activity (last 5)
        const recentActivity = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    totalSessions,
                    totalPlayers,
                    totalEarnings,
                    rating: parseFloat(rating.toFixed(1)),
                },
                todaySummary: {
                    sessions: todaySessionsCount,
                    earnings: todayEarnings,
                    students: todayStudentsCount
                },
                upcomingSessions,
                recentActivity,
            },
        });
    } catch (error) {
        console.error('Coach dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch coach dashboard',
        });
    }
};

/**
 * GET /api/dashboard/player
 * Returns player dashboard data
 */
export const getPlayerDashboard = async (req, res) => {
    try {
        const userId = req.user.userId;
        const now = new Date();

        // Get player's sessions (where they are assigned)
        const allSessions = await Session.find({
            'assignedPlayers.player': userId,
        }).lean();

        const upcomingSessionsCount = await Session.countDocuments({
            'assignedPlayers.player': userId,
            'timeSlots.startTime': { $gt: now },
            status: { $nin: ['cancelled', 'completed'] },
        });

        const completedSessionsCount = await Session.countDocuments({
            'assignedPlayers.player': userId,
            status: 'completed',
        });

        // Calculate total training hours (from completed sessions)
        let totalMinutes = 0;
        allSessions
            .filter(s => s.status === 'completed')
            .forEach(session => {
                session.timeSlots?.forEach(slot => {
                    totalMinutes += slot.durationMinutes || 60;
                });
            });
        const hoursTraining = Math.round(totalMinutes / 60);

        // Get upcoming sessions (next 3)
        const upcomingSessions = await Session.find({
            'assignedPlayers.player': userId,
            'timeSlots.startTime': { $gt: now },
            status: { $nin: ['cancelled', 'completed'] },
        })
            .sort({ 'timeSlots.startTime': 1 })
            .limit(3)
            .populate('coach', 'fullName')
            .lean();

        // Get recent activity
        const recentActivity = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    upcomingSessions: upcomingSessionsCount,
                    completedSessions: completedSessionsCount,
                    hoursTraining,
                },
                upcomingSessions,
                recentActivity,
                performanceMetrics: {
                    // TODO: Add real performance data when implemented
                    attendance: 95,
                    skillLevel: 7,
                    improvement: 15,
                },
            },
        });
    } catch (error) {
        console.error('Player dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch player dashboard',
        });
    }
};

/**
 * GET /api/dashboard/guardian
 * Returns guardian dashboard data
 */
export const getGuardianDashboard = async (req, res) => {
    try {
        const userId = req.user.userId;
        const now = new Date();

        // Get guardian profile with managed players
        const guardianProfile = await GuardianProfile.findOne({ userId })
            .populate({
                path: 'players',
                populate: {
                    path: 'userId',
                    select: 'fullName email'
                }
            })
            .lean();

        if (!guardianProfile) {
            console.log('⚠️ Guardian profile not found for userId:', userId);
            return res.json({
                success: true,
                data: {
                    managedPlayers: [],
                    upcomingSessions: [],
                    recentActivity: [],
                    stats: {
                        totalPlayers: 0,
                        activeSessions: 0,
                        completedSessions: 0,
                    }
                }
            });
        }

        const managedPlayerIds = guardianProfile?.players?.map(
            player => player._id
        ) || [];

        // Map players for the response
        const managedPlayers = guardianProfile?.players || [];

        // Get sessions for all managed players
        const upcomingSessions = await Session.find({
            'assignedPlayers.player': { $in: managedPlayerIds },
            'timeSlots.startTime': { $gt: now },
            status: { $nin: ['cancelled', 'completed'] },
        })
            .sort({ 'timeSlots.startTime': 1 })
            .limit(5)
            .populate('coach', 'fullName')
            .populate({
                path: 'assignedPlayers.player',
                select: 'fullName userId',
                populate: { path: 'userId', select: 'fullName' }
            })
            .lean();

        // Get recent activity for guardian
        const recentActivity = await Activity.find({ userId })
            .sort({ createdAt: -1 })
            .limit(5)
            .lean();

        return res.status(200).json({
            success: true,
            data: {
                stats: {
                    managedPlayers: managedPlayerIds.length,
                    upcomingSessions: upcomingSessions.length,
                },
                managedPlayers: managedPlayers,
                upcomingSessions,
                recentActivity,
            },
        });
    } catch (error) {
        console.error('Guardian dashboard error:', error);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch guardian dashboard',
        });
    }
};