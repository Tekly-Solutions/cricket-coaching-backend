
import SubscriptionPlan from "../models/SubscriptionPlan.js";

/**
 * GET /api/subscriptions/plans
 * Public: Get all active subscription plans
 */
export const getActivePlans = async (req, res) => {
    try {
        // Fetch only active plans, sorted by price
        const plans = await SubscriptionPlan.find({ isActive: true })
            .sort({ price: 1 })
            .select('-__v -createdAt -updatedAt') // Exclude internal fields
            .lean();

        return res.status(200).json({
            success: true,
            data: plans.map(plan => ({
                id: plan._id,
                planId: plan.planId,
                name: plan.name,
                description: plan.description,
                price: plan.price,
                currency: plan.currency,
                interval: plan.interval,
                tier: plan.tier,
                trialPeriodDays: plan.trialPeriodDays,
                features: plan.features.map(f => ({
                    name: f.name,
                    included: f.included,
                    highlight: f.highlight
                })),
                isPopular: plan.isPopular
            }))
        });
    } catch (error) {
        console.error("Get active plans error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch subscription plans"
        });
    }
};