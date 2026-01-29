import mongoose from 'mongoose';

const activitySchema = new mongoose.Schema(
    {
        userId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true,
            index: true,
        },

        type: {
            type: String,
            enum: [
                'session_completed',
                'session_created',
                'player_joined',
                'player_left',
                'injury_update',
                'schedule_change',
                'performance_logged',
                'attendance_marked',
            ],
            required: true,
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

        // Related entity (session, player, etc.)
        relatedEntity: {
            entityType: {
                type: String,
                enum: ['session', 'player', 'user', 'booking'],
            },
            entityId: {
                type: mongoose.Schema.Types.ObjectId,
            },
        },

        // For display purposes
        icon: {
            type: String,
            enum: ['run', 'injury', 'calendar', 'star', 'person', 'cricket'],
            default: 'cricket',
        },

        metadata: {
            type: Map,
            of: mongoose.Schema.Types.Mixed,
        },
    },
    { timestamps: true }
);

// Indexes for performance
activitySchema.index({ userId: 1, createdAt: -1 });
activitySchema.index({ 'relatedEntity.entityId': 1 });

export default mongoose.model('Activity', activitySchema);
