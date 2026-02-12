import mongoose from "mongoose";
import SubscriptionPlan from "../../models/SubscriptionPlan.js";
import CoachProfile from "../../models/CoachProfile.js";
import Booking from "../../models/Booking.js";

/**
 * GET /api/admin/subscriptions/plans
 * Admin-only: Get all subscription plans
 */
export const getAllPlans = async (req, res) => {
  try {
    const plans = await SubscriptionPlan.find().sort({ price: 1 }).lean();

    // Get active users count for each plan
    const plansWithStats = await Promise.all(
      plans.map(async (plan) => {
        const activeUsers = await CoachProfile.countDocuments({
          plan: plan.planId,
        });

        return {
          id: plan._id,
          name: plan.name,
          description: plan.description || '',
          price: plan.price,
          interval: plan.interval,
          tier: plan.tier,
          trialPeriodDays: plan.trialPeriodDays || 0, // Ensure this is returned
          isActive: plan.isActive, // Ensure this is returned
          isPopular: plan.isPopular,
          activeUsers,
          features: plan.features.map((f) => ({
            id: f._id,
            name: f.name,
            included: f.included,
            highlight: f.highlight,
          })),
        };
      })
    );

    return res.status(200).json({
      success: true,
      data: plansWithStats,
    });
  } catch (error) {
    console.error("Admin get plans error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch plans",
    });
  }
};

/**
 * GET /api/admin/subscriptions/stats
 * Admin-only: Get subscription statistics
 */
export const getSubscriptionStats = async (req, res) => {
  try {
    // Total subscribers (all coaches with active subscriptions)
    const totalSubscribers = await CoachProfile.countDocuments({
      "subscription.status": "active",
    });

    // Calculate MRR (Monthly Recurring Revenue)
    const plans = await SubscriptionPlan.find().lean();
    let mrr = 0;

    for (const plan of plans) {
      const subscribersCount = await CoachProfile.countDocuments({
        plan: plan.planId,
        "subscription.status": "active",
      });

      // Convert yearly plans to monthly
      const monthlyPrice = plan.interval === "year" ? plan.price / 12 : plan.price;
      mrr += subscribersCount * monthlyPrice;
    }

    // Conversion rate (coaches with active subscription / total coaches)
    const totalCoaches = await CoachProfile.countDocuments();
    const conversionRate = totalCoaches > 0 
      ? ((totalSubscribers / totalCoaches) * 100).toFixed(1)
      : 0;

    return res.status(200).json({
      success: true,
      data: {
        totalSubscribers,
        mrr: Math.round(mrr),
        conversionRate: parseFloat(conversionRate),
      },
    });
  } catch (error) {
    console.error("Admin subscription stats error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch subscription stats",
    });
  }
};

/**
 * POST /api/admin/subscriptions/plans
 * Admin-only: Create a new subscription plan
 */
export const createPlan = async (req, res) => {
  try {
    const {
      name,
      description,
      price,
      interval,
      tier,
      trialPeriodDays,
      features,
      isActive,
      isPopular,
    } = req.body;

    // Validate required fields
    if (!name || price === undefined || !tier) {
      return res.status(400).json({
        success: false,
        message: "Name, price, and tier are required",
      });
    }

    // Generate planId from name
    const planId = name.toLowerCase().replace(/\s+/g, '-');

    // Check if planId already exists
    const existingPlan = await SubscriptionPlan.findOne({ planId });
    if (existingPlan) {
      return res.status(400).json({
        success: false,
        message: "A plan with this name already exists",
      });
    }

    // Create new plan
    const newPlan = new SubscriptionPlan({
      name,
      description,
      price,
      interval: interval || 'month',
      tier,
      trialPeriodDays: trialPeriodDays || 0,
      features: features || [],
      isActive: isActive !== undefined ? isActive : true,
      isPopular: isPopular || false,
      planId,
    });

    await newPlan.save();

    return res.status(201).json({
      success: true,
      data: newPlan,
      message: "Plan created successfully",
    });
  } catch (error) {
    console.error("Admin create plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create plan",
    });
  }
};

/**
 * PUT /api/admin/subscriptions/plans/:id
 * Admin-only: Update a subscription plan
 */
export const updatePlan = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    const plan = await SubscriptionPlan.findByIdAndUpdate(
      id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: plan,
      message: "Plan updated successfully",
    });
  } catch (error) {
    console.error("Admin update plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update plan",
    });
  }
};

/**
 * DELETE /api/admin/subscriptions/plans/:id
 * Admin-only: Delete a subscription plan
 */
export const deletePlan = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid plan ID",
      });
    }

    const plan = await SubscriptionPlan.findById(id);

    if (!plan) {
      return res.status(404).json({
        success: false,
        message: "Plan not found",
      });
    }

    // Check if any users are subscribed to this plan
    const subscribersCount = await CoachProfile.countDocuments({
      plan: plan.planId,
    });

    if (subscribersCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Cannot delete plan with ${subscribersCount} active subscribers`,
      });
    }

    await plan.deleteOne();

    return res.status(200).json({
      success: true,
      message: "Plan deleted successfully",
    });
  } catch (error) {
    console.error("Admin delete plan error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete plan",
    });
  }
};