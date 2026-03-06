import express from 'express';
import CommissionSettings from '../models/CommissionSettings.js';
import { hybridAuth } from '../middlewares/hybridAuth.js';

const router = express.Router();

/**
 * Get current commission settings (public - for calculating booking preview)
 * GET /api/commission/settings
 */
router.get('/settings', hybridAuth, async (req, res) => {
  try {
    const settings = await CommissionSettings.getSettings();
    
    // Return only necessary public data
    res.status(200).json({
      success: true,
      data: {
        globalRate: settings.globalRate,
        description: settings.description,
        // Don't expose user overrides for privacy
      },
    });
  } catch (error) {
    console.error('❌ Get commission settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch commission settings',
    });
  }
});

/**
 * Calculate commission for a booking preview
 * GET /api/commission/calculate?sessionFee=60&sportName=cricket
 */
router.get('/calculate', hybridAuth, async (req, res) => {
  try {
    const { sessionFee, sportName } = req.query;

    if (!sessionFee || isNaN(sessionFee)) {
      return res.status(400).json({
        success: false,
        message: 'Valid session fee is required',
      });
    }

    const settings = await CommissionSettings.getSettings();
    const userId = req.user?.userId || req.user?.id;
    
    const commission = settings.calculateCommission(
      parseFloat(sessionFee),
      userId,
      sportName
    );

    res.status(200).json({
      success: true,
      data: {
        sessionFee: parseFloat(sessionFee),
        commissionRate: commission.rate,
        commissionAmount: commission.amount,
        total: parseFloat(sessionFee) + commission.amount,
        appliedRule: commission.appliedRule,
      },
    });
  } catch (error) {
    console.error('❌ Calculate commission error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to calculate commission',
    });
  }
});

export default router;
