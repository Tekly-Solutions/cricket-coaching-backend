import User from '../models/User.js';
import CoachProfile from '../models/CoachProfile.js';
import PlayerProfile from '../models/PlayerProfile.js';
import GuardianProfile from '../models/GuardianProfile.js';

/**
 * Get current user's profile
 * GET /api/users/profile
 */
export const getProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;

        // Find user and populate role-specific profile
        let user;

        if (userRole === 'coach') {
            user = await User.findById(userId)
                .select('-password')
                .populate('coachProfile');
        } else if (userRole === 'player') {
            user = await User.findById(userId)
                .select('-password')
                .populate('playerProfile');
        } else if (userRole === 'guardian') {
            user = await User.findById(userId)
                .select('-password')
                .populate('guardianProfile');
        } else {
            user = await User.findById(userId).select('-password');
        }

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.json({ user });
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Update current user's profile
 * PUT /api/users/profile
 */
export const updateProfile = async (req, res) => {
    try {
        const userId = req.user._id;
        const userRole = req.user.role;
        const { fullName, email, phone, profileImage, bio, specializations, achievements, playingPosition, skillLevel } = req.body;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user fields
        if (fullName) user.fullName = fullName;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (profileImage) user.profileImage = profileImage;

        await user.save();

        // Update role-specific profile
        if (userRole === 'coach' && user.coachProfile) {
            const coachProfile = await CoachProfile.findById(user.coachProfile);
            if (coachProfile) {
                if (bio) coachProfile.bio = bio;
                if (specializations) coachProfile.specializations = specializations;
                if (achievements) coachProfile.achievements = achievements;
                await coachProfile.save();
            }
        } else if (userRole === 'player' && user.playerProfile) {
            const playerProfile = await PlayerProfile.findById(user.playerProfile);
            if (playerProfile) {
                if (playingPosition) playerProfile.playingPosition = playingPosition;
                if (skillLevel) playerProfile.skillLevel = skillLevel;
                await playerProfile.save();
            }
        } else if (userRole === 'guardian' && user.guardianProfile) {
            // Guardian profile updates if needed
            const guardianProfile = await GuardianProfile.findById(user.guardianProfile);
            if (guardianProfile) {
                // Add any guardian-specific fields here
                await guardianProfile.save();
            }
        }

        // Fetch updated user with populated profile
        let updatedUser;
        if (userRole === 'coach') {
            updatedUser = await User.findById(userId)
                .select('-password')
                .populate('coachProfile');
        } else if (userRole === 'player') {
            updatedUser = await User.findById(userId)
                .select('-password')
                .populate('playerProfile');
        } else if (userRole === 'guardian') {
            updatedUser = await User.findById(userId)
                .select('-password')
                .populate('guardianProfile');
        } else {
            updatedUser = await User.findById(userId).select('-password');
        }

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser,
        });
    } catch (error) {
        console.error('Update profile error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

/**
 * Update profile image (mock implementation)
 * PUT /api/users/profile/image
 */
export const updateProfileImage = async (req, res) => {
    try {
        const userId = req.user._id;

        // Mock implementation - in production, upload to cloud storage
        // For now, just return a placeholder URL
        const mockImageUrl = `https://i.pravatar.cc/150?u=${userId}`;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        user.profileImage = mockImageUrl;
        await user.save();

        res.json({
            message: 'Profile image updated successfully',
            imageUrl: mockImageUrl,
        });
    } catch (error) {
        console.error('Update profile image error:', error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};
