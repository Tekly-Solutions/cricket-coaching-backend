// routes/searchRoutes.js
import express from 'express';
import { hybridAuth } from '../middlewares/hybridAuth.js';
import {
  searchCoaches,
  searchSessions,
  searchAll,
} from '../controllers/searchController.js';

const router = express.Router();

// All search routes require authentication
router.use(hybridAuth);

// Search endpoints
router.get('/coaches', searchCoaches);
router.get('/sessions', searchSessions);
router.get('/all', searchAll);

export default router;
