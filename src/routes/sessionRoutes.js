// routes/sessionRoutes.js
import express from 'express';
import {
  createSession,
  getCoachSessions,
  getSessionById,
  updateSession,
  deleteSession,
  addPlayerToSession,
  getSessionStats,
  updateSessionAttendance,
  startSession,
  completeSession,
  updatePlayerReport,
} from '../controllers/sessionController.js';
import { hybridAuth } from '../middlewares/hybridAuth.js';
import { roleAuth } from '../middlewares/roleAuth.js';

// import { jwtAuth } from '../middlewares/jwtAuth.js';     // your token verifier
// import { roleAuth } from '../middlewares/roleAuth.js';   // your role checker

const router = express.Router();

// All session routes require a valid JWT first
router.use(hybridAuth);

// Then we restrict most actions to coaches only
// (adjust roles array if your role is named differently, e.g. "coach" vs "Coach")
const coachOnly = roleAuth('coach');

// Specific / static routes FIRST
router.get('/stats', coachOnly, getSessionStats);

router
  .route('/')
  .post(coachOnly, createSession)           // only coaches can create
  .get(coachOnly, getCoachSessions);        // only coaches see their own sessions

router
  .route('/:id')
  .get(getSessionById)                      // anyone logged in can view details (hybridAuth already applied)
  .put(coachOnly, updateSession)            // only creator/coach
  .delete(coachOnly, deleteSession);        // only creator/coach

router
  .route('/:id/players')
  .post(coachOnly, addPlayerToSession);     // only coach can add players

router
  .route('/:id/players/:playerId/attendance')
  .put(coachOnly, updateSessionAttendance); // only coach can mark attendance

router
  .route('/:id/players/:playerId/report')
  .put(coachOnly, updatePlayerReport);      // only coach can update report

// Session lifecycle routes
router.post('/:id/start', coachOnly, startSession);
router.post('/:id/complete', coachOnly, completeSession);

export default router;