import express from 'express';
import { hybridAuth } from '../middlewares/hybridAuth.js';
import { createReview, getCoachReviews, getMyReviews } from '../controllers/reviewController.js';

const router = express.Router();

router.use(hybridAuth);

router.post('/', createReview);
router.get('/my-reviews', getMyReviews);       // coach sees their own reviews
router.get('/coach/:coachId', getCoachReviews); // public coach profile reviews

export default router;
