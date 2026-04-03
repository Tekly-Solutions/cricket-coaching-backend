import Stripe from 'stripe';
import dotenv from 'dotenv';
import User from '../models/User.js';
import CoachProfile from '../models/CoachProfile.js';
import Booking from '../models/Booking.js';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// ─────────────────────────────────────────────────────────────
// CUSTOMER
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/customer/create-or-get
 * Creates Stripe Customer if not exists, returns stripeCustomerId.
 */
export const createOrGetCustomer = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (user.stripeCustomerId) {
            return res.json({ customerId: user.stripeCustomerId });
        }

        const customer = await stripe.customers.create({
            email: user.email,
            name: user.fullName,
            metadata: { userId: userId.toString() },
        });

        user.stripeCustomerId = customer.id;
        await user.save();

        res.json({ customerId: customer.id });
    } catch (error) {
        console.error('Create customer error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// PAYMENT METHODS (SAVED CARDS)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/setup-intent
 * Returns a SetupIntent clientSecret so frontend can save a card without charging.
 */
export const createSetupIntent = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Ensure customer exists
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.fullName,
                metadata: { userId: userId.toString() },
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
        }

        let setupIntent;
        try {
            setupIntent = await stripe.setupIntents.create({
                customer: customerId,
                payment_method_types: ['card'],
            });
        } catch (stripeErr) {
            // Auto-heal if the saved customer ID in DB is from an old/different Stripe account
            if (stripeErr.code === 'resource_missing' && stripeErr.param === 'customer') {
                const newCustomer = await stripe.customers.create({
                    email: user.email,
                    name: user.fullName,
                    metadata: { userId: userId.toString() },
                });
                customerId = newCustomer.id;
                user.stripeCustomerId = customerId;
                await user.save();

                setupIntent = await stripe.setupIntents.create({
                    customer: customerId,
                    payment_method_types: ['card'],
                });
            } else {
                throw stripeErr;
            }
        }

        res.json({ clientSecret: setupIntent.client_secret, customerId });
    } catch (error) {
        console.error('Setup intent error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/payments/payment-methods
 * Lists all saved cards for the current user.
 */
export const listPaymentMethods = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user || !user.stripeCustomerId) {
            return res.json({ paymentMethods: [] });
        }

        const methods = await stripe.paymentMethods.list({
            customer: user.stripeCustomerId,
            type: 'card',
        });

        res.json({ paymentMethods: methods.data });
    } catch (error) {
        // Auto-heal: If the customer doesn't exist on this Stripe account, clear it out.
        if (error.code === 'resource_missing' && error.param === 'customer') {
            await User.findByIdAndUpdate(req.user.userId, { $unset: { stripeCustomerId: "" } });
            return res.json({ paymentMethods: [] });
        }
        
        console.error('List payment methods error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * DELETE /api/payments/payment-methods/:pmId
 * Detaches a saved card from the customer.
 */
export const deletePaymentMethod = async (req, res) => {
    try {
        const { pmId } = req.params;
        const userId = req.user.userId;
        const user = await User.findById(userId);

        // Verify the card belongs to this customer
        const pm = await stripe.paymentMethods.retrieve(pmId);
        if (!user.stripeCustomerId || pm.customer !== user.stripeCustomerId) {
            return res.status(403).json({ message: 'Unauthorized' });
        }

        await stripe.paymentMethods.detach(pmId);
        res.json({ success: true });
    } catch (error) {
        console.error('Delete payment method error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// BOOKING CHARGE
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/charge-booking
 * Creates a PaymentIntent for a session booking, with transfer to coach.
 * Body: { amount (cents), currency, paymentMethodId, coachId, bookingDescription }
 */
export const chargeBooking = async (req, res) => {
    try {
        const { amount, currency = 'usd', paymentMethodId, coachId, bookingDescription } = req.body;
        const userId = req.user.userId;

        if (!amount || !paymentMethodId || !coachId) {
            return res.status(400).json({ message: 'amount, paymentMethodId, and coachId are required' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // Ensure Stripe customer exists
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.fullName,
                metadata: { userId: userId.toString() },
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
        }

        // Get coach's Stripe Connect account for transfer
        const coachProfile = await CoachProfile.findOne({ userId: coachId });
        const transferDestination = coachProfile?.stripeAccountId &&
            coachProfile?.stripeOnboardingComplete
            ? coachProfile.stripeAccountId
            : null;

        const intentParams = {
            amount: Math.round(amount), // must be integer cents
            currency,
            customer: customerId,
            payment_method: paymentMethodId,
            confirm: true,
            off_session: false,
            description: bookingDescription || 'Session Booking',
            metadata: { userId: userId.toString(), coachId },
            return_url: 'burl://payment-complete',
        };

        // Add transfer to coach if Connect account ready
        if (transferDestination) {
            // Platform keeps serviceFee, rest goes to coach
            const serviceFeeAmount = Math.round(amount * 0.018); // 1.8% platform fee
            intentParams.transfer_data = { destination: transferDestination };
            intentParams.application_fee_amount = serviceFeeAmount;
        }

        const paymentIntent = await stripe.paymentIntents.create(intentParams);

        res.json({
            success: true,
            paymentIntentId: paymentIntent.id,
            clientSecret: paymentIntent.client_secret,
            status: paymentIntent.status,
        });
    } catch (error) {
        console.error('Charge booking error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/payments/refund
 * Issues a Stripe refund for a booking.
 * Body: { bookingId }
 */
export const refundBooking = async (req, res) => {
    try {
        const { bookingId } = req.body;
        const userId = req.user.userId;

        const booking = await Booking.findById(bookingId);
        if (!booking) return res.status(404).json({ message: 'Booking not found' });

        if (!booking.paymentIntentId) {
            return res.status(400).json({ message: 'No Stripe payment found for this booking' });
        }

        const refund = await stripe.refunds.create({
            payment_intent: booking.paymentIntentId,
        });

        res.json({ success: true, refundId: refund.id, status: refund.status });
    } catch (error) {
        console.error('Refund error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// STRIPE CONNECT (COACH PAYOUTS)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/connect/onboard
 * Creates a Stripe Connect Express account for a coach and returns the onboarding URL.
 */
export const connectOnboard = async (req, res) => {
    try {
        const userId = req.user.userId;
        const user = await User.findById(userId);
        if (!user || user.role !== 'coach') {
            return res.status(403).json({ message: 'Only coaches can set up payouts' });
        }

        let coachProfile = await CoachProfile.findOne({ userId });
        if (!coachProfile) return res.status(404).json({ message: 'Coach profile not found' });

        let accountId = coachProfile.stripeAccountId;

        // Create new Express account if not exists
        if (!accountId) {
            const account = await stripe.accounts.create({
                type: 'express',
                email: user.email,
                capabilities: { transfers: { requested: true } },
                metadata: { userId: userId.toString() },
            });
            accountId = account.id;
            coachProfile.stripeAccountId = accountId;
            await coachProfile.save();
        }

        // Generate onboarding link (valid 1 hour)
        const accountLink = await stripe.accountLinks.create({
            account: accountId,
            refresh_url: `${process.env.APP_URL || 'https://burl-ad60f.firebaseapp.com'}/connect-refresh`,
            return_url: `${process.env.APP_URL || 'https://burl-ad60f.firebaseapp.com'}/connect-return`,
            type: 'account_onboarding',
        });

        res.json({ url: accountLink.url });
    } catch (error) {
        console.error('Connect onboard error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/payments/connect/status
 * Returns the coach's Stripe Connect account status.
 */
export const getConnectStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const coachProfile = await CoachProfile.findOne({ userId });

        if (!coachProfile?.stripeAccountId) {
            return res.json({ connected: false, status: 'not_connected' });
        }

        const account = await stripe.accounts.retrieve(coachProfile.stripeAccountId);
        const isEnabled = account.charges_enabled && account.payouts_enabled;

        // Sync onboarding status to DB
        if (isEnabled && !coachProfile.stripeOnboardingComplete) {
            coachProfile.stripeOnboardingComplete = true;
            await coachProfile.save();
        }

        res.json({
            connected: true,
            status: isEnabled ? 'active' : 'pending',
            chargesEnabled: account.charges_enabled,
            payoutsEnabled: account.payouts_enabled,
            requirements: account.requirements?.currently_due || [],
        });
    } catch (error) {
        console.error('Connect status error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// SUBSCRIPTIONS (COACH PLANS)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/subscription/create
 * Creates a Stripe Subscription for a coach (monthly or annual).
 * Body: { priceId, paymentMethodId, trialDays? }
 */
export const createSubscription = async (req, res) => {
    try {
        const { priceId, paymentMethodId, trialDays = 0 } = req.body;
        const userId = req.user.userId;

        if (!priceId || !paymentMethodId) {
            return res.status(400).json({ message: 'priceId and paymentMethodId are required' });
        }

        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: 'User not found' });

        const coachProfile = await CoachProfile.findOne({ userId });
        if (!coachProfile) return res.status(404).json({ message: 'Coach profile not found' });

        // Cancel any existing subscription first
        if (coachProfile.stripeSubscriptionId) {
            try {
                await stripe.subscriptions.cancel(coachProfile.stripeSubscriptionId);
            } catch (_) {} // Ignore if already cancelled
        }

        // Ensure customer exists
        let customerId = user.stripeCustomerId;
        if (!customerId) {
            const customer = await stripe.customers.create({
                email: user.email,
                name: user.fullName,
                metadata: { userId: userId.toString() },
            });
            customerId = customer.id;
            user.stripeCustomerId = customerId;
            await user.save();
        }

        // Attach payment method to customer and set as default
        await stripe.paymentMethods.attach(paymentMethodId, { customer: customerId });
        await stripe.customers.update(customerId, {
            invoice_settings: { default_payment_method: paymentMethodId },
        });

        const subParams = {
            customer: customerId,
            items: [{ price: priceId }],
            payment_settings: {
                payment_method_types: ['card'],
                save_default_payment_method: 'on_subscription',
            },
            expand: ['latest_invoice.payment_intent'],
            metadata: { userId: userId.toString() },
        };

        if (trialDays > 0) {
            subParams.trial_period_days = trialDays;
        }

        const subscription = await stripe.subscriptions.create(subParams);

        // Determine plan tier from priceId via metadata
        const price = await stripe.prices.retrieve(priceId);
        const planTier = price.metadata?.tier || 'pro';

        // Save subscription to CoachProfile
        const expiresAt = subscription.current_period_end
            ? new Date(subscription.current_period_end * 1000)
            : null;

        await CoachProfile.findOneAndUpdate(
            { userId },
            {
                $set: {
                    plan: planTier,
                    stripeSubscriptionId: subscription.id,
                    stripeSubscriptionStatus: subscription.status,
                    'subscription.status': subscription.status === 'active' || subscription.status === 'trialing' ? 'active' : 'inactive',
                    'subscription.expiresAt': expiresAt,
                }
            }
        );

        res.json({
            success: true,
            subscriptionId: subscription.id,
            status: subscription.status,
            clientSecret: subscription.latest_invoice?.payment_intent?.client_secret || null,
        });
    } catch (error) {
        console.error('Create subscription error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/payments/subscription/cancel
 * Cancels the coach's Stripe Subscription at period end.
 */
export const cancelSubscription = async (req, res) => {
    try {
        const userId = req.user.userId;
        const coachProfile = await CoachProfile.findOne({ userId });

        if (!coachProfile?.stripeSubscriptionId) {
            return res.status(404).json({ message: 'No active subscription found' });
        }

        const subscription = await stripe.subscriptions.update(
            coachProfile.stripeSubscriptionId,
            { cancel_at_period_end: true }
        );

        await CoachProfile.findOneAndUpdate(
            { userId },
            { $set: { stripeSubscriptionStatus: 'cancelled' } }
        );

        res.json({
            success: true,
            cancelAt: new Date(subscription.cancel_at * 1000),
            message: 'Subscription will be cancelled at end of billing period',
        });
    } catch (error) {
        console.error('Cancel subscription error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * GET /api/payments/subscription/status
 * Returns current subscription status from Stripe.
 */
export const getSubscriptionStatus = async (req, res) => {
    try {
        const userId = req.user.userId;
        const coachProfile = await CoachProfile.findOne({ userId });

        if (!coachProfile?.stripeSubscriptionId) {
            return res.json({ active: false, status: 'none', plan: coachProfile?.plan || 'free' });
        }

        const subscription = await stripe.subscriptions.retrieve(coachProfile.stripeSubscriptionId);

        // Sync status back to DB if changed
        if (subscription.status !== coachProfile.stripeSubscriptionStatus) {
            await CoachProfile.findOneAndUpdate(
                { userId },
                { $set: { stripeSubscriptionStatus: subscription.status } }
            );
        }

        res.json({
            active: ['active', 'trialing'].includes(subscription.status),
            status: subscription.status,
            plan: coachProfile.plan,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
            cancelAtPeriodEnd: subscription.cancel_at_period_end,
        });
    } catch (error) {
        console.error('Get subscription status error:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * POST /api/payments/subscription/change-plan
 * Upgrades or downgrades the coach's subscription to a different Stripe Price.
 * Body: { newPriceId }
 */
export const changeSubscriptionPlan = async (req, res) => {
    try {
        const { newPriceId } = req.body;
        const userId = req.user.userId;
        const coachProfile = await CoachProfile.findOne({ userId });

        if (!coachProfile?.stripeSubscriptionId) {
            return res.status(404).json({ message: 'No active subscription found' });
        }

        const subscription = await stripe.subscriptions.retrieve(coachProfile.stripeSubscriptionId);

        const updatedSub = await stripe.subscriptions.update(coachProfile.stripeSubscriptionId, {
            items: [{
                id: subscription.items.data[0].id,
                price: newPriceId,
            }],
            proration_behavior: 'create_prorations',
        });

        const price = await stripe.prices.retrieve(newPriceId);
        const planTier = price.metadata?.tier || 'pro';

        await CoachProfile.findOneAndUpdate(
            { userId },
            { $set: { plan: planTier, stripeSubscriptionStatus: updatedSub.status } }
        );

        res.json({ success: true, status: updatedSub.status, plan: planTier });
    } catch (error) {
        console.error('Change plan error:', error);
        res.status(500).json({ message: error.message });
    }
};

// ─────────────────────────────────────────────────────────────
// WEBHOOK
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/payments/webhook
 * Handles Stripe webhook events. Must use raw body (not JSON parsed).
 */
export const handleWebhook = async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        console.error('Webhook signature error:', err.message);
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        switch (event.type) {
            case 'payment_intent.succeeded': {
                const pi = event.data.object;
                // Update booking paymentIntentId if matched (set during chargeBooking)
                await Booking.findOneAndUpdate(
                    { paymentIntentId: pi.id },
                    { $set: { status: 'confirmed' } }
                );
                break;
            }

            case 'payment_intent.payment_failed': {
                const pi = event.data.object;
                await Booking.findOneAndUpdate(
                    { paymentIntentId: pi.id },
                    { $set: { status: 'pending' } }
                );
                break;
            }

            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const sub = event.data.object;
                const userId = sub.metadata?.userId;
                if (userId) {
                    const statusMap = {
                        active: 'active',
                        trialing: 'active',
                        past_due: 'inactive',
                        canceled: 'inactive',
                        incomplete: 'inactive',
                    };
                    await CoachProfile.findOneAndUpdate(
                        { userId },
                        {
                            $set: {
                                stripeSubscriptionStatus: sub.status,
                                'subscription.status': statusMap[sub.status] || 'inactive',
                                'subscription.expiresAt': sub.current_period_end
                                    ? new Date(sub.current_period_end * 1000)
                                    : undefined,
                            }
                        }
                    );
                }
                break;
            }

            case 'account.updated': {
                const account = event.data.object;
                const userId = account.metadata?.userId;
                if (userId && account.charges_enabled && account.payouts_enabled) {
                    await CoachProfile.findOneAndUpdate(
                        { stripeAccountId: account.id },
                        { $set: { stripeOnboardingComplete: true } }
                    );
                }
                break;
            }

            default:
                console.log(`Unhandled Stripe event: ${event.type}`);
        }

        res.json({ received: true });
    } catch (error) {
        console.error('Webhook handler error:', error);
        res.status(500).json({ message: error.message });
    }
};
