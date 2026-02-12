import mongoose from 'mongoose';

const bookingSchema = new mongoose.Schema(
    {
        player: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'PlayerProfile',
            required: true,
        },
        session: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Session',
            required: true,
        },
        occurrenceDate: {
            type: Date,
            required: true,
        },
        status: {
            type: String,
            enum: ['pending', 'confirmed', 'cancelled', 'completed'],
            default: 'confirmed',
        },
        paymentMethod: {
            type: String,
            enum: ['card', 'apple_pay', 'google_pay', 'test'],
            required: true,
        },
        pricing: {
            sessionFee: {
                type: Number,
                required: true,
            },
            serviceFee: {
                type: Number,
                default: 2.50,
            },
            tax: {
                type: Number,
                default: 0.00,
            },
            discount: {
                type: Number,
                default: 0.00,
            },
            total: {
                type: Number,
                required: true,
            },
        },
        promoCode: {
            type: String,
            uppercase: true,
        },
        cancelledAt: {
            type: Date,
        },
        cancelReason: {
            type: String,
        },
    },
    {
        timestamps: true,
    }
);

// Index for faster queries
bookingSchema.index({ player: 1, occurrenceDate: -1 });
bookingSchema.index({ session: 1 });
bookingSchema.index({ status: 1 });

// Virtual for booking reference number
bookingSchema.virtual('referenceNumber').get(function () {
    return `BK${this._id.toString().slice(-8).toUpperCase()}`;
});

// Ensure virtuals are included in JSON
bookingSchema.set('toJSON', { virtuals: true });
bookingSchema.set('toObject', { virtuals: true });

export default mongoose.model('Booking', bookingSchema);
