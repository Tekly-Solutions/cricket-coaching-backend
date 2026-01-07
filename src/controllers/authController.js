import User from "../models/User.js";
import admin from "../config/firebase.js";
import { signJwt } from "../utils/jwt.js";

export const signup = async (req, res) => {
  const session = await User.startSession();
  session.startTransaction();

  try {
    const { fullName, role } = req.body;
    const { uid, email } = req.firebaseUser;

    if (!fullName || !role) {
      return res.status(400).json({ 
        message: "Missing fields"
    });
    }

    const existingUser = await User.findOne({ firebaseUid: uid });
    if (existingUser) {
      return res.status(409).json({ 
        message: "User already exists" 
    });
    }

    const user = await User.create(
      [
        {
          firebaseUid: uid,
          fullName,
          email,
          role,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      user: user[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    // 🔥 Rollback Firebase user if DB fails
    if (req.firebaseUser?.uid) {
      await admin.auth().deleteUser(req.firebaseUser.uid);
    }

    console.error("Signup error:", error);
    return res.status(500).json({
        success: false,
        message: "Internal server error" 
    });
  }
};

/* login */
export const login = async (req, res) => {
  try {
    const { uid, email } = req.firebaseUser;

    const user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please sign up first.",
      });
    }

    // Generate JWT
    const token = signJwt({
      userId: user._id,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token, // BACKEND JWT
      user,
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

