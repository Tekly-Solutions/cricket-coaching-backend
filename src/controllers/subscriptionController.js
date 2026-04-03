
import SubscriptionPlan from "../models/SubscriptionPlan.js";
import CoachProfile from "../models/CoachProfile.js";
import Stripe from 'stripe';
import User from '../models/User.js';
import dotenv from 'dotenv';

dotenv.config();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * GET /api/subscriptions/plans
 * Public: Get all active subscription plans
 */
export const getActivePlans = async (req, res) => {
    try {
        const plans = await SubscriptionPlan.find({ isActive: true })
            .sort({ price: 1 })
            .select('-__v -createdAt -updatedAt')
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
                stripePriceIdMonthly: plan.stripePriceIdMonthly || null,
                stripePriceIdAnnual: plan.stripePriceIdAnnual || null,
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
 * Activates a subscription. If Stripe Price IDs are configured on the plan,
 * creates a real Stripe Subscription. Otherwise falls back to DB-only (test mode).
 * Body: { planId, isAnnual, paymentMethodId? }
 */
export const activateSubscription = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        if (!userId) {
            return res.status(401).json({ success: false, message: "Unauthorized" });
        }

        const { planId, isAnnual, paymentMethodId } = req.body;
        if (!planId) {
            return res.status(400).json({ success: false, message: "planId is required" });
        }

        // Attempt Stripe Billing if paymentMethodId provided
        if (paymentMethodId && process.env.STRIPE_SECRET_KEY) {
            const plan = await SubscriptionPlan.findOne({ planId });
            const priceId = isAnnual
                ? plan?.stripePriceIdAnnual
                : plan?.stripePriceIdMonthly;

            if (priceId) {
                const user = await User.findById(userId);
                const coachProfile = await CoachProfile.findOne({ userId });

                if (coachProfile?.stripeSubscriptionId) {
                    try { await stripe.subscriptions.cancel(coachProfile.stripeSubscriptionId); } catch (_) {}
                }

                let customerId = user?.stripeCustomerId;
                if (!customerId) {
                    const customer = await stripe.customers.create({
                        email: user.email,
                        name: user.fullName,
                        metadata: { userId: userId.toString() },
                    });
                    customerId = customer.id;
                    await User.findByIdAndUpdate(userId, { stripeCustomerId: customerId });
                }

                await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
                await stripe.customers.update(customerId, {
                    invoice_settings: { default_payment_method: paymentMethodId },
                });

                const subParams = {
                    customer: customerId,
                    items: [{ price: priceId }],
                    payment_settings: { payment_method_types: ['card'] },
                    expand: ['latest_invoice.payment_intent'],
                    metadata: { userId: userId.toString() },
                };

                if ((plan?.trialPeriodDays || 0) > 0) {
                    subParams.trial_period_days = plan.trialPeriodDays;
                }

                const subscription = await stripe.subscriptions.create(subParams);
                const expiresAt = new Date(subscription.current_period_end * 1000);

                await CoachProfile.findOneAndUpdate(
                    { userId },
                    {
                        $set: {
                            plan: planId,
                            stripeSubscriptionId: subscription.id,
                            stripeSubscriptionStatus: subscription.status,
                            'subscription.status': ['active', 'trialing'].includes(subscription.status) ? 'active' : 'inactive',
                            'subscription.expiresAt': expiresAt,
                        }
                    },
                    { new: true }
                );

                return res.status(200).json({
                    success: true,
                    message: "Subscription activated via Stripe",
                    data: {
                        plan: planId,
                        subscriptionId: subscription.id,
                        status: subscription.status,
                        clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
                    }
                });
            }
        }

        // Fallback: DB-only activation (no Stripe Price ID configured)
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
            message: "Subscription activated",
            data: { plan: coachProfile.plan, subscription: coachProfile.subscription }
        });
    } catch (error) {
        console.error("Activate subscription error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to activate subscription"
        });
    }
};
