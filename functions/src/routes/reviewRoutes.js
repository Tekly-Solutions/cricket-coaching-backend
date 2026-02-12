import express from 'express';
import { hybridAuth } from '../middlewares/hybridAuth.js';
import { createReview, getCoachReviews } from '../controllers/reviewController.js';

const router = express.Router();

router.use(hybridAuth);

router.post('/', createReview);
router.get('/coach/:coachId', getCoachReviews);

export default router;