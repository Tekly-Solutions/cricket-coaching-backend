import express from "express";
import { login, signup } from "../controllers/authController.js";
import { verifyFirebaseToken } from "../middlewares/firebaseAuth.js";

const router = express.Router();

router.post("/signup", verifyFirebaseToken, signup);
router.post("/login", verifyFirebaseToken, login);

export default router;
