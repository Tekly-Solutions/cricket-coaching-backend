import CommissionSettings from '../../models/CommissionSettings.js';
import User from '../../models/User.js';

/**
 * Get current commission settings
 */
export const getCommissionSettings = async (req, res) => {
  try {
    console.log('🔵 Fetching commission settings...');
    const settings = await CommissionSettings.getSettings();
    
    // Populate user details in userOverrides
    await settings.populate('userOverrides.userId', 'fullName email');

    console.log('✅ Commission settings fetched. Global rate:', settings.globalRate);

    res.status(200).json({
      success: true,
      data: settings,
    });
  } catch (error) {
    console.error('❌ Get commission settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission settings',
      error: error.message,
    });
  }
};

/**
 * Update global commission rate
 */
export const updateGlobalRate = async (req, res) => {
  try {
    const { rate } = req.body;

    if (rate === undefined || rate < 0 || rate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100',
      });
    }

    console.log('🔵 Updating global commission rate to:', rate);

    const settings = await CommissionSettings.getSettings();
    console.log('Current global rate:', settings.globalRate);
    
    settings.globalRate = rate;
    settings.updatedBy = req.user?.userId || req.user?.id;
    const savedSettings = await settings.save();

    console.log('✅ Global commission rate updated successfully. New rate:', savedSettings.globalRate, 'Updated at:', savedSettings.updatedAt);

    res.status(200).json({
      success: true,
      message: 'Global commission rate updated successfully',
      data: savedSettings,
    });
  } catch (error) {
    console.error('❌ Update global rate error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update global commission rate',
      error: error.message,
    });
  }
};

/**
 * Add sport-specific commission rate
 */
export const addSportCommission = async (req, res) => {
  try {
    const { sportName, sportIcon, sportCategory, commissionRate } = req.body;

    if (!sportName || commissionRate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Sport name and commission rate are required',
      });
    }

    if (commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100',
      });
    }

    console.log('🔵 Adding sport commission for:', sportName);

    const settings = await CommissionSettings.getSettings();

    // Check if sport already exists
    const existingSport = settings.sportRates.find(
      (sport) => sport.sportName.toLowerCase() === sportName.toLowerCase()
    );

    if (existingSport) {
      return res.status(400).json({
        success: false,
        message: `Commission rate for ${sportName} already exists`,
      });
    }

    settings.sportRates.push({
      sportName,
      sportIcon: sportIcon || 'sports',
      sportCategory: sportCategory || 'General',
      commissionRate,
      status: 'active',
      activeSince: new Date(),
    });

    settings.updatedBy = req.user?.userId || req.user?.id;
    await settings.save();

    console.log('✅ Sport commission added successfully');

    res.status(201).json({
      success: true,
      message: 'Sport commission rate added successfully',
      data: settings,
    });
  } catch (error) {
    console.error('❌ Add sport commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add sport commission rate',
      error: error.message,
    });
  }
};

/**
 * Update sport-specific commission rate
 */
export const updateSportCommission = async (req, res) => {
  try {
    const { sportId } = req.params;
    const { commissionRate, status } = req.body;

    if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100',
      });
    }

    console.log('🔵 Updating sport commission:', sportId);

    const settings = await CommissionSettings.getSettings();
    const sportRate = settings.sportRates.id(sportId);

    if (!sportRate) {
      return res.status(404).json({
        success: false,
        message: 'Sport commission rate not found',
      });
    }

    if (commissionRate !== undefined) sportRate.commissionRate = commissionRate;
    if (status) sportRate.status = status;

    settings.updatedBy = req.user?.userId || req.user?.id;
    await settings.save();

    console.log('✅ Sport commission updated successfully');

    res.status(200).json({
      success: true,
      message: 'Sport commission rate updated successfully',
      data: settings,
    });
  } catch (error) {
    console.error('❌ Update sport commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update sport commission rate',
      error: error.message,
    });
  }
};

/**
 * Delete sport-specific commission rate
 */
export const deleteSportCommission = async (req, res) => {
  try {
    const { sportId } = req.params;

    console.log('🔵 Deleting sport commission:', sportId);

    const settings = await CommissionSettings.getSettings();
    const sportRate = settings.sportRates.id(sportId);

    if (!sportRate) {
      return res.status(404).json({
        success: false,
        message: 'Sport commission rate not found',
      });
    }

    sportRate.deleteOne();
    settings.updatedBy = req.user?.userId || req.user?.id;
    await settings.save();

    console.log('✅ Sport commission deleted successfully');

    res.status(200).json({
      success: true,
      message: 'Sport commission rate deleted successfully',
      data: settings,
    });
  } catch (error) {
    console.error('❌ Delete sport commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete sport commission rate',
      error: error.message,
    });
  }
};

/**
 * Add user-specific commission override
 */
export const addUserOverride = async (req, res) => {
  try {
    const { userId, commissionRate, source, effectiveFrom, expiresAt } = req.body;

    if (!userId || commissionRate === undefined) {
      return res.status(400).json({
        success: false,
        message: 'User ID and commission rate are required',
      });
    }

    if (commissionRate < 0 || commissionRate > 100) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100',
      });
    }

    // Verify user exists
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    console.log('🔵 Adding user commission override for:', user.email);

    const settings = await CommissionSettings.getSettings();

    // Check if override already exists for this user
    const existingOverride = settings.userOverrides.find(
      (override) => override.userId.toString() === userId && override.status === 'active'
    );

    if (existingOverride) {
      return res.status(400).json({
        success: false,
        message: 'Active commission override already exists for this user',
      });
    }

    settings.userOverrides.push({
      userId,
      commissionRate,
      source: source || 'Manual Override',
      status: effectiveFrom && new Date(effectiveFrom) > new Date() ? 'scheduled' : 'active',
      effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date(),
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    });

    settings.updatedBy = req.user?.userId || req.user?.id;
    await settings.save();

    console.log('✅ User commission override added successfully');

    res.status(201).json({
      success: true,
      message: 'User commission override added successfully',
      data: settings,
    });
  } catch (error) {
    console.error('❌ Add user override error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add user commission override',
      error: error.message,
    });
  }
};

/**
 * Update user-specific commission override
 */
export const updateUserOverride = async (req, res) => {
  try {
    const { overrideId } = req.params;
    const { commissionRate, status, expiresAt } = req.body;

    if (commissionRate !== undefined && (commissionRate < 0 || commissionRate > 100)) {
      return res.status(400).json({
        success: false,
        message: 'Commission rate must be between 0 and 100',
      });
    }

    console.log('🔵 Updating user commission override:', overrideId);

    const settings = await CommissionSettings.getSettings();
    const override = settings.userOverrides.id(overrideId);

    if (!override) {
      return res.status(404).json({
        success: false,
        message: 'User commission override not found',
      });
    }

    if (commissionRate !== undefined) override.commissionRate = commissionRate;
    if (status) override.status = status;
    if (expiresAt !== undefined) override.expiresAt = expiresAt ? new Date(expiresAt) : null;

    settings.updatedBy = req.user?.userId || req.user?.id;
    await settings.save();

    console.log('✅ User commission override updated successfully');

    res.status(200).json({
      success: true,
      message: 'User commission override updated successfully',
      data: settings,
    });
  } catch (error) {
    console.error('❌ Update user override error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user commission override',
      error: error.message,
    });
  }
};

/**
 * Delete user-specific commission override
 */
export const deleteUserOverride = async (req, res) => {
  try {
    const { overrideId } = req.params;

    console.log('🔵 Deleting user commission override:', overrideId);

    const settings = await CommissionSettings.getSettings();
    const override = settings.userOverrides.id(overrideId);

    if (!override) {
      return res.status(404).json({
        success: false,
        message: 'User commission override not found',
      });
    }

    override.deleteOne();
    settings.updatedBy = req.user?.userId || req.user?.id;
    await settings.save();

    console.log('✅ User commission override deleted successfully');

    res.status(200).json({
      success: true,
      message: 'User commission override deleted successfully',
      data: settings,
    });
  } catch (error) {
    console.error('❌ Delete user override error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete user commission override',
      error: error.message,
    });
  }
};

/**
 * Calculate commission for a specific booking
 */
export const calculateCommission = async (req, res) => {
  try {
    const { sessionFee, userId, sportName } = req.query;

    if (!sessionFee) {
      return res.status(400).json({
        success: false,
        message: 'Session fee is required',
      });
    }

    const settings = await CommissionSettings.getSettings();
    const commission = settings.calculateCommission(
      parseFloat(sessionFee),
      userId,
      sportName
    );

    res.status(200).json({
      success: true,
      data: commission,
    });
  } catch (error) {
    console.error('❌ Calculate commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate commission',
      error: error.message,
    });
  }
};