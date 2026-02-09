import mongoose from "mongoose";
import PromoCode from "../../models/PromoCode.js";
import CoachProfile from "../../models/CoachProfile.js";

/**
 * GET /api/admin/promo-codes
 * Admin-only: Get all promo codes with filters
 */
export const getAllPromoCodes = async (req, res) => {
  try {
    const { 
      category, 
      status, 
      search,
      page = 1,
      limit = 20,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (category) {
      filter.category = category;
    }
    
    if (status) {
      filter.status = status;
    }
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { code: { $regex: search, $options: 'i' } },
      ];
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sort = { [sortBy]: sortOrder === 'desc' ? -1 : 1 };

    // Get promo codes with pagination
    const promoCodes = await PromoCode.find(filter)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate('createdBy', 'fullName email')
      .lean();

    // Get total count for pagination
    const total = await PromoCode.countDocuments(filter);

    // Auto-update expired promo codes
    const now = new Date();
    await PromoCode.updateMany(
      { 
        status: 'active',
        endDate: { $lt: now }
      },
      { status: 'expired' }
    );

    // Format response data
    const formattedPromoCodes = promoCodes.map(promo => ({
      id: promo._id,
      name: promo.name,
      code: promo.code,
      category: promo.category,
      discountType: promo.discountType,
      discountValue: promo.discountValue,
      minimumPrice: promo.minimumPrice,
      startDate: promo.startDate,
      duration: promo.duration,
      durationUnit: promo.durationUnit,
      endDate: promo.endDate,
      usageLimitEnabled: promo.usageLimitEnabled,
      maxRedemptions: promo.maxRedemptions,
      totalUsageLimit: promo.totalUsageLimit,
      limitPerUser: promo.limitPerUser,
      preventStacking: promo.preventStacking,
      applicablePlans: promo.applicablePlans,
      targetUserRole: promo.targetUserRole,
      selectedSports: promo.selectedSports,
      applyToFutureSports: promo.applyToFutureSports,
      status: promo.status,
      currentRedemptions: promo.currentRedemptions,
      createdAt: promo.createdAt,
      createdBy: promo.createdBy,
    }));

    return res.status(200).json({
      success: true,
      data: formattedPromoCodes,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Admin get promo codes error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch promo codes",
    });
  }
};

/**
 * GET /api/admin/promo-codes/:id
 * Admin-only: Get single promo code by ID
 */
export const getPromoCodeById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promo code ID",
      });
    }

    const promoCode = await PromoCode.findById(id)
      .populate('createdBy', 'fullName email')
      .populate('usageHistory.userId', 'fullName email')
      .lean();

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: promoCode._id,
        name: promoCode.name,
        code: promoCode.code,
        category: promoCode.category,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        minimumPrice: promoCode.minimumPrice,
        startDate: promoCode.startDate,
        duration: promoCode.duration,
        durationUnit: promoCode.durationUnit,
        endDate: promoCode.endDate,
        usageLimitEnabled: promoCode.usageLimitEnabled,
        maxRedemptions: promoCode.maxRedemptions,
        totalUsageLimit: promoCode.totalUsageLimit,
        limitPerUser: promoCode.limitPerUser,
        preventStacking: promoCode.preventStacking,
        applicablePlans: promoCode.applicablePlans,
        targetUserRole: promoCode.targetUserRole,
        selectedSports: promoCode.selectedSports,
        applyToFutureSports: promoCode.applyToFutureSports,
        status: promoCode.status,
        currentRedemptions: promoCode.currentRedemptions,
        usageHistory: promoCode.usageHistory,
        createdAt: promoCode.createdAt,
        createdBy: promoCode.createdBy,
      },
    });
  } catch (error) {
    console.error("Admin get promo code by ID error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch promo code",
    });
  }
};

/**
 * POST /api/admin/promo-codes
 * Admin-only: Create a new promo code
 */
export const createPromoCode = async (req, res) => {
  try {
    const {
      name,
      code,
      category,
      discountType,
      discountValue,
      minimumPrice,
      startDate,
      duration,
      durationUnit,
      usageLimitEnabled,
      maxRedemptions,
      totalUsageLimit,
      limitPerUser,
      preventStacking,
      applicablePlans,
      targetUserRole,
      selectedSports,
      applyToFutureSports,
      status,
    } = req.body;

    // Validate required fields
    if (!name || !code || !category || !discountType || discountValue === undefined || !startDate || !duration || !durationUnit) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    // Validate discount value
    if (discountType === 'percentage' && (discountValue < 0 || discountValue > 100)) {
      return res.status(400).json({
        success: false,
        message: "Percentage discount must be between 0 and 100",
      });
    }

    if (discountType === 'fixed' && discountValue < 0) {
      return res.status(400).json({
        success: false,
        message: "Fixed discount cannot be negative",
      });
    }

    // Check if promo code already exists
    const existingPromo = await PromoCode.findOne({ code: code.toUpperCase() });
    if (existingPromo) {
      return res.status(400).json({
        success: false,
        message: "A promo code with this code already exists",
      });
    }

    // Validate category-specific fields
    if (category === 'subscription') {
      if (!applicablePlans || applicablePlans.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one plan must be selected for subscription discounts",
        });
      }
      
      if (usageLimitEnabled && (!maxRedemptions || maxRedemptions < 1)) {
        return res.status(400).json({
          success: false,
          message: "Maximum redemptions must be specified when usage limit is enabled",
        });
      }
    }

    if (category === 'commission') {
      if (!targetUserRole) {
        return res.status(400).json({
          success: false,
          message: "Target user role is required for commission discounts",
        });
      }
      
      if (!selectedSports || selectedSports.length === 0) {
        return res.status(400).json({
          success: false,
          message: "At least one sport must be selected for commission discounts",
        });
      }
      
      if (usageLimitEnabled) {
        if (!totalUsageLimit || totalUsageLimit < 1) {
          return res.status(400).json({
            success: false,
            message: "Total usage limit must be specified when usage limit is enabled",
          });
        }
        if (!limitPerUser || limitPerUser < 1) {
          return res.status(400).json({
            success: false,
            message: "Limit per user must be specified when usage limit is enabled",
          });
        }
      }
    }

    // Calculate end date
    const startDateObj = new Date(startDate);
    const endDateObj = new Date(startDateObj);
    
    if (durationUnit === 'days') {
      endDateObj.setDate(endDateObj.getDate() + parseInt(duration));
    } else if (durationUnit === 'months') {
      endDateObj.setMonth(endDateObj.getMonth() + parseInt(duration));
    } else if (durationUnit === 'years') {
      endDateObj.setFullYear(endDateObj.getFullYear() + parseInt(duration));
    }

    // Create promo code data
    const promoData = {
      name,
      code: code.toUpperCase(),
      category,
      discountType,
      discountValue,
      minimumPrice: minimumPrice || 0,
      startDate: new Date(startDate),
      endDate: endDateObj,
      duration: parseInt(duration),
      durationUnit,
      usageLimitEnabled: usageLimitEnabled !== undefined ? usageLimitEnabled : true,
      preventStacking: preventStacking !== undefined ? preventStacking : true,
      status: status || 'draft',
      createdBy: req.admin?._id || null, // Assuming adminAuth middleware adds req.admin
    };

    // Add category-specific fields
    if (category === 'subscription') {
      promoData.applicablePlans = applicablePlans;
      if (usageLimitEnabled) {
        promoData.maxRedemptions = parseInt(maxRedemptions);
      }
    }

    if (category === 'commission') {
      promoData.targetUserRole = targetUserRole;
      promoData.selectedSports = selectedSports;
      promoData.applyToFutureSports = applyToFutureSports || false;
      if (usageLimitEnabled) {
        promoData.totalUsageLimit = parseInt(totalUsageLimit);
        promoData.limitPerUser = parseInt(limitPerUser);
      }
    }

    // Create new promo code
    const newPromoCode = new PromoCode(promoData);
    await newPromoCode.save();

    return res.status(201).json({
      success: true,
      data: {
        id: newPromoCode._id,
        name: newPromoCode.name,
        code: newPromoCode.code,
        category: newPromoCode.category,
        discountType: newPromoCode.discountType,
        discountValue: newPromoCode.discountValue,
        status: newPromoCode.status,
        startDate: newPromoCode.startDate,
        endDate: newPromoCode.endDate,
      },
      message: "Promo code created successfully",
    });
  } catch (error) {
    console.error("Admin create promo code error:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(err => err.message),
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Failed to create promo code",
    });
  }
};

/**
 * PUT /api/admin/promo-codes/:id
 * Admin-only: Update a promo code
 */
export const updatePromoCode = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promo code ID",
      });
    }

    const promoCode = await PromoCode.findById(id);

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    // Prevent updating code if already used
    if (updates.code && promoCode.currentRedemptions > 0) {
      return res.status(400).json({
        success: false,
        message: "Cannot change promo code that has already been used",
      });
    }

    // Validate discount value if being updated
    if (updates.discountValue !== undefined) {
      const discountType = updates.discountType || promoCode.discountType;
      if (discountType === 'percentage' && (updates.discountValue < 0 || updates.discountValue > 100)) {
        return res.status(400).json({
          success: false,
          message: "Percentage discount must be between 0 and 100",
        });
      }
      if (discountType === 'fixed' && updates.discountValue < 0) {
        return res.status(400).json({
          success: false,
          message: "Fixed discount cannot be negative",
        });
      }
    }

    // Update the promo code
    Object.keys(updates).forEach(key => {
      if (key !== '_id' && key !== 'createdAt' && key !== 'currentRedemptions' && key !== 'usageHistory') {
        promoCode[key] = updates[key];
      }
    });

    // Recalculate endDate if startDate, duration, or durationUnit changed
    if (updates.startDate || updates.duration || updates.durationUnit) {
      const startDateObj = new Date(promoCode.startDate);
      const endDateObj = new Date(startDateObj);
      
      if (promoCode.durationUnit === 'days') {
        endDateObj.setDate(endDateObj.getDate() + promoCode.duration);
      } else if (promoCode.durationUnit === 'months') {
        endDateObj.setMonth(endDateObj.getMonth() + promoCode.duration);
      } else if (promoCode.durationUnit === 'years') {
        endDateObj.setFullYear(endDateObj.getFullYear() + promoCode.duration);
      }
      
      promoCode.endDate = endDateObj;
    }

    await promoCode.save();

    return res.status(200).json({
      success: true,
      data: {
        id: promoCode._id,
        name: promoCode.name,
        code: promoCode.code,
        category: promoCode.category,
        discountType: promoCode.discountType,
        discountValue: promoCode.discountValue,
        status: promoCode.status,
        startDate: promoCode.startDate,
        endDate: promoCode.endDate,
      },
      message: "Promo code updated successfully",
    });
  } catch (error) {
    console.error("Admin update promo code error:", error);
    
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: "Validation error",
        errors: Object.values(error.errors).map(err => err.message),
      });
    }
    
    return res.status(500).json({
      success: false,
      message: "Failed to update promo code",
    });
  }
};

/**
 * DELETE /api/admin/promo-codes/:id
 * Admin-only: Delete a promo code
 */
export const deletePromoCode = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promo code ID",
      });
    }

    const promoCode = await PromoCode.findById(id);

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    // Check if promo code has been used
    if (promoCode.currentRedemptions > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete promo code that has been used ${promoCode.currentRedemptions} times. Consider disabling it instead.`,
      });
    }

    await promoCode.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Promo code deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete promo code error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete promo code",
    });
  }
};

/**
 * PATCH /api/admin/promo-codes/:id/status
 * Admin-only: Change promo code status (activate, deactivate, expire)
 */
export const updatePromoCodeStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid promo code ID",
      });
    }

    if (!status || !['draft', 'active', 'expired', 'disabled'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be one of: draft, active, expired, disabled",
      });
    }

    const promoCode = await PromoCode.findById(id);

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Promo code not found",
      });
    }

    // Validate status transition
    if (status === 'active') {
      const now = new Date();
      if (promoCode.endDate < now) {
        return res.status(400).json({
          success: false,
          message: "Cannot activate an expired promo code",
        });
      }
    }

    promoCode.status = status;
    await promoCode.save();

    return res.status(200).json({
      success: true,
      data: {
        id: promoCode._id,
        code: promoCode.code,
        status: promoCode.status,
      },
      message: `Promo code ${status === 'active' ? 'activated' : status === 'disabled' ? 'disabled' : 'updated'} successfully`,
    });
  } catch (error) {
    console.error("Admin update promo code status error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update promo code status",
    });
  }
};

/**
 * GET /api/admin/promo-codes/stats
 * Admin-only: Get promo code statistics
 */
export const getPromoCodeStats = async (req, res) => {
  try {
    // Total promo codes
    const totalPromoCodes = await PromoCode.countDocuments();

    // Active promo codes
    const activePromoCodes = await PromoCode.countDocuments({
      status: 'active',
      startDate: { $lte: new Date() },
      endDate: { $gte: new Date() },
    });

    // Total redemptions across all promo codes
    const redemptionStats = await PromoCode.aggregate([
      {
        $group: {
          _id: null,
          totalRedemptions: { $sum: '$currentRedemptions' },
        },
      },
    ]);

    const totalRedemptions = redemptionStats.length > 0 ? redemptionStats[0].totalRedemptions : 0;

    // Category breakdown
    const categoryStats = await PromoCode.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
        },
      },
    ]);

    return res.status(200).json({
      success: true,
      data: {
        totalPromoCodes,
        activePromoCodes,
        totalRedemptions,
        categoryBreakdown: categoryStats.reduce((acc, stat) => {
          acc[stat._id] = stat.count;
          return acc;
        }, {}),
      },
    });
  } catch (error) {
    console.error("Admin get promo code stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch promo code statistics",
    });
  }
};

/**
 * POST /api/admin/promo-codes/validate
 * Admin-only: Validate a promo code without applying it
 */
export const validatePromoCode = async (req, res) => {
  try {
    const { code, planId, userId } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: "Promo code is required",
      });
    }

    const promoCode = await PromoCode.findOne({ 
      code: code.toUpperCase(),
      status: 'active',
    });

    if (!promoCode) {
      return res.status(404).json({
        success: false,
        message: "Invalid or inactive promo code",
      });
    }

    // Check date validity
    const now = new Date();
    if (promoCode.startDate > now || promoCode.endDate < now) {
      return res.status(400).json({
        success: false,
        message: "Promo code is not valid at this time",
      });
    }

    // Check usage limits
    if (promoCode.usageLimitEnabled) {
      const limit = promoCode.maxRedemptions || promoCode.totalUsageLimit;
      if (promoCode.currentRedemptions >= limit) {
        return res.status(400).json({
          success: false,
          message: "Promo code usage limit exceeded",
        });
      }

      // Check per-user limit for commission type
      if (promoCode.category === 'commission' && userId && promoCode.limitPerUser) {
        const userUsageCount = promoCode.usageHistory.filter(
          usage => usage.userId.toString() === userId
        ).length;

        if (userUsageCount >= promoCode.limitPerUser) {
          return res.status(400).json({
            success: false,
            message: "You have exceeded the usage limit for this promo code",
          });
        }
      }
    }

    // Check plan applicability for subscription type
    if (promoCode.category === 'subscription' && planId) {
      if (!promoCode.applicablePlans.includes(planId)) {
        return res.status(400).json({
          success: false,
          message: "This promo code is not applicable to the selected plan",
        });
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        promoCode: {
          id: promoCode._id,
          code: promoCode.code,
          discountType: promoCode.discountType,
          discountValue: promoCode.discountValue,
          minimumPrice: promoCode.minimumPrice,
          category: promoCode.category,
        },
      },
      message: "Promo code is valid",
    });
  } catch (error) {
    console.error("Admin validate promo code error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to validate promo code",
    });
  }
};