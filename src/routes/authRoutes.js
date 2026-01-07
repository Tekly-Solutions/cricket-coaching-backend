import express from "express";
import { signup } from "../controllers/authController.js";
import { verifyFirebaseToken } from "../middlewares/firebaseAuth.js";

const router = express.Router();

router.post("/signup", verifyFirebaseToken, signup);

export default router;
