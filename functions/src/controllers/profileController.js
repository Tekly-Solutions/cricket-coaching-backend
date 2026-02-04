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
        const userId = req.user.userId; // JWT has userId, not _id
        const userRole = req.user.role;

        // Find user
        const user = await User.findById(userId).select('-password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Fetch role-specific profile
        let roleProfile = null;
        if (userRole === 'coach') {
            roleProfile = await CoachProfile.findOne({ userId: userId });
        } else if (userRole === 'player') {
            roleProfile = await PlayerProfile.findOne({ userId: userId });
        } else if (userRole === 'guardian') {
            roleProfile = await GuardianProfile.findOne({ userId: userId });
        }

        res.json({
            user: user.toObject(),
            profile: roleProfile
        });
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
        const userId = req.user.userId; // JWT has userId, not _id
        const userRole = req.user.role;
        const {
            fullName,
            email,
            phone,
            profileImage,
            // Coach-specific fields
            bio,
            city,
            hourlyRate,
            sessionDuration,
            coachTitle,
            specialties,
            primarySpecialization,
            certifications,
            experienceYears,
            coachingPhilosophy,
            notableAchievements,
            playingCareerBackground,
            ageGroupsCoached,
            sessionTypesOffered,
            // Player-specific fields
            playingPosition,
            skillLevel
        } = req.body;

        // Find user
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Update user fields
        if (fullName) user.fullName = fullName;
        if (email) user.email = email;
        if (phone) user.phoneNumber = phone; // Map 'phone' to 'phoneNumber'
        if (profileImage) user.profileImage = profileImage;

        await user.save();

        // Update role-specific profile
        if (userRole === 'coach') {
            let coachProfile;

            // Check if coach profile exists
            if (user.coachProfile) {
                coachProfile = await CoachProfile.findById(user.coachProfile);
            } else {
                // No coach profile linked, try to find by userId
                coachProfile = await CoachProfile.findOne({ userId: userId });

                if (coachProfile) {
                    // Found orphaned profile, link it to user
                    user.coachProfile = coachProfile._id;
                    await user.save();
                } else {
                    // No profile exists at all, create one
                    coachProfile = await CoachProfile.create({
                        userId: userId,
                        profileCompletionPercentage: 20,
                    });
                    user.coachProfile = coachProfile._id;
                    await user.save();
                }
            }

            if (coachProfile) {
                // Update all coach fields if provided
                if (bio !== undefined) coachProfile.aboutMe = bio;
                if (city !== undefined) coachProfile.city = city;
                if (hourlyRate !== undefined) {
                    if (!coachProfile.defaultPricing) coachProfile.defaultPricing = {};
                    coachProfile.defaultPricing.hourlyRate = hourlyRate;
                }
                if (sessionDuration !== undefined) {
                    if (!coachProfile.defaultPricing) coachProfile.defaultPricing = {};
                    coachProfile.defaultPricing.sessionDuration = sessionDuration;
                }
                if (coachTitle !== undefined) coachProfile.coachTitle = coachTitle;
                if (specialties !== undefined) coachProfile.specialties = specialties;
                if (primarySpecialization !== undefined) coachProfile.primarySpecialization = primarySpecialization;
                if (certifications !== undefined) coachProfile.certifications = certifications;
                if (experienceYears !== undefined) coachProfile.experienceYears = experienceYears;
                if (coachingPhilosophy !== undefined) coachProfile.coachingPhilosophy = coachingPhilosophy;
                if (notableAchievements !== undefined) coachProfile.notableAchievements = notableAchievements;
                if (playingCareerBackground !== undefined) coachProfile.playingCareerBackground = playingCareerBackground;
                if (ageGroupsCoached !== undefined) coachProfile.ageGroupsCoached = ageGroupsCoached;
                if (sessionTypesOffered !== undefined) coachProfile.sessionTypesOffered = sessionTypesOffered;

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
            // Guardian profile updates
            const guardianProfile = await GuardianProfile.findById(user.guardianProfile);
            if (guardianProfile) {
                // Update phone number in guardian profile too
                if (phone) guardianProfile.phoneNumber = phone;
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
        const userId = req.user.userId; // JWT has userId, not _id

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