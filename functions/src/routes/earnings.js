import express from 'express';
import {
  getTotalEarnings,
  getEarningsByPeriod,
  getEarningsHistory,
  getEarningsSummary,
  createEarning,
  requestCashOut,
} from '../controllers/earningController.js';
import { hybridAuth } from '../middlewares/hybridAuth.js';
import { roleAuth } from '../middlewares/roleAuth.js';

const router = express.Router();

// All routes require authentication
router.use(hybridAuth);

// All routes require coach role
const coachOnly = roleAuth('coach');

/**
 * @route   GET /api/earnings/total
 * @desc    Get coach's total earnings
 * @access  Private (Coach)
 */
router.get('/total', coachOnly, getTotalEarnings);

/**
 * @route   GET /api/earnings/summary
 * @desc    Get earnings summary with stats
 * @access  Private (Coach)
 */
router.get('/summary', coachOnly, getEarningsSummary);

/**
 * @route   GET /api/earnings/period
 * @desc    Get earnings by period (weekly/monthly/yearly)
 * @query   type, startDate, endDate
 * @access  Private (Coach)
 */
router.get('/period', coachOnly, getEarningsByPeriod);

/**
 * @route   GET /api/earnings/history
 * @desc    Get earnings history/transactions
 * @query   page, limit, status, startDate, endDate
 * @access  Private (Coach)
 */
router.get('/history', coachOnly, getEarningsHistory);

/**
 * @route   POST /api/earnings
 * @desc    Create earning record (internal use)
 * @access  Private (Coach)
 */
router.post('/', coachOnly, createEarning);

/**
 * @route   POST /api/earnings/cashout
 * @desc    Request cash out (MVP: placeholder)
 * @access  Private (Coach)
 */
router.post('/cashout', coachOnly, requestCashOut);

export default router;
