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
          signInProviders: ["password"],
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
    // Add sign in provider
    const provider = req.firebaseUser?.sign_in_provider || "password";

    if (provider && !user.signInProviders.includes(provider)) {
    user.signInProviders.push(provider);
    await user.save();
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

/* continue with google */
export const continueWithProvider = async (req, res) => {
  try {
    const { uid, email, name, firebase } = req.firebaseUser;
    const provider = firebase?.sign_in_provider;

    let user = await User.findOne({ firebaseUid: uid });

    const isNewUser = !user;

    // 🔹 NEW USER (FIRST TIME)
    if (isNewUser) {
      // Use Firebase displayName if fullName not provided in body
      const fullName = req.body.fullName || name || "Unnamed User";
      const role = req.body.role; // still required from frontend

      if (!role) {
        return res.status(400).json({
          message: "Missing role",
        });
      }

      user = await User.create({
        firebaseUid: uid,
        email,
        fullName,
        role,
        signInProviders: [provider],
      });
    } 
    // 🔹 EXISTING USER
    else {
      if (!user.signInProviders.includes(provider)) {
        user.signInProviders.push(provider);
        await user.save();
      }
    }

    // ISSUE BACKEND JWT
    const token = signJwt({
      userId: user._id,
      role: user.role,
    });

    return res.status(200).json({
      success: true,
      token,
      user,
      isNewUser,
    });
  } catch (error) {
    console.error("Continue auth error:", error);
    return res.status(500).json({
      message: "Internal server error",
    });
  }
};


