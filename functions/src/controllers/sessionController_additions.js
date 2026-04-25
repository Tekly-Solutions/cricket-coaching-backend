// Additional Session Controller Methods for Attendance Flow

/**
 * POST /api/sessions/:id/start
 * Mark a session as in-progress
 */
export const startSession = async (req, res) => {
    try {
        const session = await Session.findOneAndUpdate(
            {
                _id: req.params.id,
                coach: req.user.userId,
                status: { $in: ['draft', 'published'] }
            },
            {
                $set: { status: 'in-progress' }
            },
            { new: true }
        ).populate('assignedPlayers.player', 'fullName profilePhoto');

        if (!session) {
            return res.status(404).json({
                status: 'error',
                message: 'Session not found or already started/completed',
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Session started',
            data: session
        });
    } catch (error) {
        console.error('Start session error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to start session',
        });
    }
};

/**
 * POST /api/sessions/:id/complete
 * Complete a session with overall notes
 */
export const completeSession = async (req, res) => {
    try {
        const { sessionNotes } = req.body;

        const session = await Session.findOneAndUpdate(
            {
                _id: req.params.id,
                coach: req.user.userId,
                status: { $in: ['in-progress', 'published', 'draft'] }
            },
            {
                $set: {
                    status: 'completed',
                    sessionNotes: sessionNotes || ''
                }
            },
            { new: true }
        ).populate('assignedPlayers.player', 'fullName profilePhoto');

        if (!session) {
            return res.status(404).json({
                status: 'error',
                message: 'Session not found or cannot be completed',
            });
        }

        return res.status(200).json({
            status: 'success',
            message: 'Session completed successfully',
            data: session
        });
    } catch (error) {
        console.error('Complete session error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to complete session',
        });
    }
};

// Also update updateSessionAttendance to support note field:
// In the existing updateSessionAttendance function, modify the update logic:
// const updateFields = {
//   'assignedPlayers.$.attended': attended
// };
// if (req.body.note !== undefined) {
//   updateFields['assignedPlayers.$.note'] = req.body.note;
// }
// Then use updateFields in the $set operation
