import Stripe from 'stripe';
import dotenv from 'dotenv';

dotenv.config();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createPaymentIntent = async (req, res) => {
    try {
        const { amount, currency } = req.body;

        // amount is in cents! (e.g. $10.00 = 1000)
        // If you are passing "10" for $10, multiply by 100
        // Or ensure frontend does it. We'll assume frontend sends raw small unit (cents).

        const paymentIntent = await stripe.paymentIntents.create({
            amount: amount,
            currency: currency || 'usd',
            automatic_payment_methods: {
                enabled: true,
            },
        });

        res.status(200).json({
            success: true,
            clientSecret: paymentIntent.client_secret,
        });
    } catch (error) {
        console.error("Stripe Error:", error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};
