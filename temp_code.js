/**
 * GET /api/search/coaches/:id/availability
 * Get available time slots for a coach
 * Query params:
 *   - startDate: ISO date string
 *   - endDate: ISO date string
 */
export const getCoachAvailability = async (req, res) => {
    try {
        const { id } = req.params;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                status: 'error',
                message: 'Start date and end date are required',
            });
        }

        const start = new Date(startDate);
        const end = new Date(endDate);

        // 1. Fetch Coach Profile
        let coach = await CoachProfile.findOne({ userId: id });
        if (!coach) {
            coach = await CoachProfile.findById(id);
        }

        if (!coach) {
            return res.status(404).json({
                status: 'error',
                message: 'Coach not found',
            });
        }

        // 2. Fetch Existing Sessions (Group & Private)
        const existingSessions = await Session.find({
            coach: coach.userId, // Sessions are linked to User ID
            status: { $in: ['published', 'confirmed'] }, // confirmed for private/on-the-fly? "published" is for group. We need to check Session schema. status enum: ['draft', 'published', 'cancelled', 'completed']. Private sessions might be "published" or we might need a new status "booked"?
            // Actually, private sessions created on the fly should probably be 'published' or 'confirmed'? Reference Implementation Plan: "Create a new Session...".
            // Let's assume they are 'published'.
            'timeSlots.startTime': { $gte: start, $lte: end },
        }).select('timeSlots durationMinutes');

        // 3. Generate Available Slots
        const availability = [];
        const daySchedules = coach.availability?.recurringSchedule?.daySchedules || {};
        const blockedDates = coach.availability?.blockedDates || [];

        // Loop through each day in range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const dayOfWeek = d.getDay(); // 0 = Sunday, 1 = Monday...
            // Adjust to our map: 0=Mon, 6=Sun in storing?
            // Wait, CoachProfile.js says: 0=Monday, ... 6=Sunday.
            // JS getDay(): 0=Sunday, 1=Monday.
            // So map JS day to Profile day: (dayOfWeek + 6) % 7.
            const profileDayIndex = (dayOfWeek + 6) % 7;

            const schedules = daySchedules.get(profileDayIndex.toString());

            if (!schedules || schedules.length === 0) continue;

            // Check if Date is Blocked
            const isBlocked = blockedDates.some(bd => {
                const blockStart = new Date(bd.startDate);
                const blockEnd = new Date(bd.endDate);
                // Check if 'd' is within block range (ignoring time for full day blocks? model has start/end datetime)
                // Let's assume strict overlap check
                const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
                const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
                return (blockStart < dayEnd && blockEnd > dayStart);
            });

            if (isBlocked) continue;

            // Generate slots for this day
            for (const schedule of schedules) {
                // Parse "09:00 AM" to Date object for this day
                const slotStart = parseTime(d, schedule.start);
                const slotEnd = parseTime(d, schedule.end);

                // Break into hourly slots (or sessionDuration)
                const sessionDuration = coach.defaultPricing?.sessionDuration || 60;

                let currentSlot = new Date(slotStart);
                while (currentSlot.getTime() + sessionDuration * 60000 <= slotEnd.getTime()) {
                    const nextSlot = new Date(currentSlot.getTime() + sessionDuration * 60000);

                    // Check overlap with existing sessions
                    const isBooked = existingSessions.some(session => {
                        return session.timeSlots.some(ts => {
                            const sStart = new Date(ts.startTime);
                            const sEnd = new Date(ts.endTime);
                            // Overlap logic: (StartA < EndB) and (EndA > StartB)
                            return (currentSlot < sEnd && nextSlot > sStart);
                        });
                    });

                    if (!isBooked) {
                        availability.push({
                            startTime: currentSlot.toISOString(),
                            endTime: nextSlot.toISOString(),
                            isAvailable: true,
                        });
                    }

                    currentSlot = nextSlot;
                }
            }
        }

        return res.status(200).json({
            status: 'success',
            data: availability,
        });

    } catch (error) {
        console.error('Get availability error:', error);
        return res.status(500).json({
            status: 'error',
            message: 'Failed to get availability',
        });
    }
};

// Helper: Parse "09:00 AM" to Date
function parseTime(date, timeStr) {
    const d = new Date(date);
    const [time, modifier] = timeStr.split(' ');
    let [hours, minutes] = time.split(':');

    if (hours === '12') {
        hours = '00';
    }
    if (modifier === 'PM') {
        hours = parseInt(hours, 10) + 12;
    }

    d.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);
    return d;
}
