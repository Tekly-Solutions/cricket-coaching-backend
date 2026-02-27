import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import CoachProfile from '../models/CoachProfile.js';

// Create a review
export const createReview = async (req, res) => {
    try {
        const { sessionId, coachId, rating, comment } = req.body;
        const playerId = req.user.userId;

        // Check if player actually booked and completed this session
        // For simplicity, we might just check if a booking exists for now.
        // Ideally, check if booking status is 'completed' or 'confirmed' and date is past.
        const booking = await Booking.findOne({
            session: sessionId,
            player: playerId,
            status: { $in: ['confirmed', 'completed'] }
        });

        if (!booking) {
            return res.status(403).json({
                status: 'error',
                message: 'You can only review sessions you have booked.'
            });
        }

        // Check if review already exists
        const existingReview = await Review.findOne({
            session: sessionId,
            player: playerId
        });

        if (existingReview) {
            return res.status(400).json({
                status: 'error',
                message: 'You have already reviewed this session.'
            });
        }

        const review = await Review.create({
            session: sessionId,
            coach: coachId,
            player: playerId,
            rating,
            comment
        });

        // Update coach's average rating
        await updateCoachAverageRating(coachId);

        res.status(201).json({
            status: 'success',
            data: review
        });
    } catch (error) {
        console.error('Create review error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to create review'
        });
    }
};

// Get reviews for a coach
export const getCoachReviews = async (req, res) => {
    try {
        const { coachId } = req.params;
        const { page = 1, limit = 10 } = req.query;

        const reviews = await Review.find({ coach: coachId })
            .populate('player', 'fullName profilePhoto')
            .populate('session', 'title')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await Review.countDocuments({ coach: coachId });

        res.status(200).json({
            status: 'success',
            results: reviews.length,
            total,
            page: parseInt(page),
            pages: Math.ceil(total / limit),
            data: reviews
        });
    } catch (error) {
        console.error('Get reviews error:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to fetch reviews'
        });
    }
};

// Helper to update coach average rating
const updateCoachAverageRating = async (coachId) => {
    try {
        const stats = await Review.aggregate([
            { $match: { coach: new mongoose.Types.ObjectId(coachId) } },
            {
                $group: {
                    _id: '$coach',
                    avgRating: { $avg: '$rating' },
                    count: { $sum: 1 }
                }
            }
        ]);

        if (stats.length > 0) {
            // Find the coach profile associated with this user ID
            // Note: coachId in Review is the User ID of the coach
            await CoachProfile.findOneAndUpdate(
                { userId: coachId },
                {
                    rating: stats[0].avgRating.toFixed(1),
                    // We could also store reviewCount if needed
                }
            );
        }
    } catch (error) {
        console.error('Error updating coach rating:', error);
    }
};
