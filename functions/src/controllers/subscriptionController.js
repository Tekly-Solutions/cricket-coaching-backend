
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import CoachProfile from "../models/CoachProfile.js";

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

/**
 * POST /api/subscriptions/activate
 * Authenticated: Activate a subscription for the logged-in coach
 * Body: { planId: string, isAnnual: boolean }
 */
export const activateSubscription = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { planId, isAnnual } = req.body;
        if (!planId) {
            return res.status(400).json({ success: false, message: "planId is required" });
        }

        // Calculate subscription expiry
        const expiresAt = new Date();
        if (isAnnual) {
            expiresAt.setFullYear(expiresAt.getFullYear() + 1);
        } else {
            expiresAt.setMonth(expiresAt.getMonth() + 1);
        }

        const coachProfile = await CoachProfile.findOneAndUpdate(
            { userId },
            {
                $set: {
                    plan: planId,
                    'subscription.status': 'active',
                    'subscription.expiresAt': expiresAt,
                }
            },
            { new: true }
        );

        if (!coachProfile) {
            return res.status(404).json({ success: false, message: "Coach profile not found" });
        }

        return res.status(200).json({
            success: true,
            message: "Subscription activated successfully",
            data: {
                plan: coachProfile.plan,
                subscription: coachProfile.subscription,
            }
        });
    } catch (error) {
        console.error("Activate subscription error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to activate subscription"
        });
    }
};