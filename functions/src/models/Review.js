import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    session: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Session',
        required: true
    },
    coach: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    player: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    comment: {
        type: String,
        maxLength: 500,
        trim: true
    }
}, {
    timestamps: true
});

// Ensure a player can review a session only once
reviewSchema.index({ session: 1, player: 1 }, { unique: true });

export default mongoose.model('Review', reviewSchema);