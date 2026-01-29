import User from "../models/User.js";
import admin from "../config/firebase.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import CoachProfile from "../models/CoachProfile.js";
import PlayerProfile from "../models/PlayerProfile.js";
import GuardianProfile from "../models/GuardianProfile.js";

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

    // AUTO CREATE ROLE PROFILE
    if (role === "coach") {
      await CoachProfile.create(
        [
          {
            userId: user[0]._id,
            plan: "free",
            isVerified: false,
          },
        ],
        { session }
      );
    }

    if (role === "player") {
      await PlayerProfile.create(
        [{
          userId: user[0]._id,
          role: 'player',
          isSelfManaged: true
        }],
        { session }
      );
    }

    if (role === "guardian") {
      await GuardianProfile.create(
        [{ userId: user[0]._id }],
        { session }
      );
    }

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

    // access token
    const accessToken = signAccessToken({
      userId: user._id,
      role: user.role,
    });

    // refresh token
    const refreshToken = signRefreshToken({
      userId: user._id,
    });

    // Save refresh token
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      accessToken,
      refreshToken,
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

    // NEW USER (FIRST TIME)
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

      // AUTO CREATE ROLE PROFILE
      if (role === "coach") {
        await CoachProfile.create({
          userId: user._id,
          plan: "free",
        });
      }

      if (role === "player") {
        await PlayerProfile.create({
          userId: user._id,
          role: "player",
          isSelfManaged: true,
        });
      }

      if (role === "guardian") {
        await GuardianProfile.create({ userId: user._id });
      }

    }
    // 🔹 EXISTING USER
    else {
      if (!user.signInProviders.includes(provider)) {
        user.signInProviders.push(provider);
        await user.save();
      }
    }

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user._id,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: user._id,
    });

    // save refresh token in db
    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken,
      refreshToken,
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

/* LOCAL AUTH METHODS */
export const signupLocal = async (req, res) => {
  const session = await User.startSession();
  session.startTransaction();

  try {
    const { name, email, password, role } = req.body; // Using 'name' to match frontend

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const firebaseUid = `local_${uuidv4()}`; // Generate a fake firebase UID

    const user = await User.create(
      [
        {
          firebaseUid,
          fullName: name,
          email,
          role,
          password: hashedPassword,
          signInProviders: ["password"],
        },
      ],
      { session }
    );

    // AUTO CREATE ROLE PROFILE
    if (role === "coach") {
      await CoachProfile.create(
        [{ userId: user[0]._id, plan: "free", isVerified: false }],
        { session }
      );
    } else if (role === "player") {
      await PlayerProfile.create(
        [{ userId: user[0]._id, role: 'player', isSelfManaged: true }],
        { session }
      );
    } else if (role === "guardian") {
      await GuardianProfile.create(
        [{ userId: user[0]._id }],
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user[0]._id,
      role: user[0].role,
    });
    const refreshToken = signRefreshToken({ userId: user[0]._id });

    // Save refresh token
    user[0].refreshToken = refreshToken;
    await user[0].save();

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      token: accessToken, // Frontend expects 'token'
      user: user[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Signup Local error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const loginLocal = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      return res.status(400).json({ success: false, message: "Invalid credentials." });
    }

    // Generate tokens
    const accessToken = signAccessToken({
      userId: user._id,
      role: user.role,
    });

    const refreshToken = signRefreshToken({
      userId: user._id,
    });

    user.refreshToken = refreshToken;
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token: accessToken, // Frontend expects 'token'
      refreshToken,
      user,
    });
  } catch (error) {
    console.error("Login Local error:", error);
    return res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        message: "Refresh token missing",
      });
    }

    // 1️⃣ Verify refresh token signature & expiry
    const payload = verifyRefreshToken(refreshToken);

    // 2️⃣ Find user
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        message: "User not found",
      });
    }

    // 3️⃣ Match refresh token with DB
    if (user.refreshToken !== refreshToken) {
      return res.status(403).json({
        message: "Invalid refresh token",
      });
    }

    // 4️⃣ Issue NEW access token
    const newAccessToken = signAccessToken({
      userId: user._id,
      role: user.role,
    });

    // 5️⃣ Rotate refresh token (IMPORTANT)
    const newRefreshToken = signRefreshToken({
      userId: user._id,
    });

    // 6️⃣ Save new refresh token
    user.refreshToken = newRefreshToken;
    await user.save();

    return res.status(200).json({
      success: true,
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });

  } catch (error) {
    console.error("Refresh token error:", error);

    return res.status(403).json({
      message: "Invalid or expired refresh token",
    });
  }
};



