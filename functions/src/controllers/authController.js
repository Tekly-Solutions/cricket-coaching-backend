import User from "../models/User.js";
import admin from "../config/firebase.js";
import { signAccessToken, signRefreshToken, verifyRefreshToken } from "../utils/jwt.js";
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import CoachProfile from "../models/CoachProfile.js";
import PlayerProfile from "../models/PlayerProfile.js";
import GuardianProfile from "../models/GuardianProfile.js";
import Notification from "../models/Notification.js";
import { sendWelcomeEmail } from "../utils/emailService.js";

export const signup = async (req, res) => {
  const session = await User.startSession();
  session.startTransaction();

  try {
    console.log('🔵 Signup request received');
    console.log('📦 Request body:', req.body);
    console.log('🔑 Firebase user:', req.firebaseUser);

    const { fullName } = req.body;
    let { role } = req.body;
    const { uid, email } = req.firebaseUser;

    if (!fullName || !role) {
      console.log('❌ Missing fields:', { fullName, role });
      return res.status(400).json({
        message: "Missing fields"
      });
    }

    role = role.toLowerCase();

    // Check if user already exists
    const existingUser = await User.findOne({ firebaseUid: uid });
    if (existingUser) {
      console.log('✅ User already exists in MongoDB:', existingUser.email);
      console.log(`👤 Existing Role: ${existingUser.role} | 🎯 Requested Role: ${role}`);

      if (role && role !== existingUser.role) {
        console.warn(`⚠️ ROLE MISMATCH: User is '${existingUser.role}' but requested '${role}'. Ignoring new role.`);
      }

      // Return existing user (idempotent - safe to call multiple times)
      return res.status(200).json({
        success: true,
        message: "User already exists",
        isNewUser: false,
        user: existingUser,
      });
    }

    console.log('🆕 Creating new user in MongoDB...');
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
      const profile = await CoachProfile.create(
        [
          {
            userId: user[0]._id,
            plan: "free",
            isVerified: false,
          },
        ],
        { session }
      );
      user[0].coachProfile = profile[0]._id;
      await user[0].save({ session });
    }

    if (role === "player") {
      const profile = await PlayerProfile.create(
        [{
          userId: user[0]._id,
          role: 'player',
          isSelfManaged: true
        }],
        { session }
      );
      user[0].playerProfile = profile[0]._id;
      await user[0].save({ session });
    }

    if (role === "guardian") {
      const profile = await GuardianProfile.create(
        [{ userId: user[0]._id }],
        { session }
      );
      user[0].guardianProfile = profile[0]._id;
      await user[0].save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    console.log('✅ User created successfully in MongoDB:', user[0].email);
    // Welcome email is sent on first VERIFIED login, not here,
    // so the user receives it only after confirming their email.

    // Create welcome and profile completion notification
    try {
      await Notification.create({
        recipient: user[0]._id,
        type: 'profile_completion',
        category: 'Other',
        title: 'Complete Your Profile',
        description: 'Welcome! Please complete your profile to get the most out of our platform.',
        priority: 'high',
        actionButton: {
          text: 'Complete Profile',
          action: 'view',
          url: '/profile/edit',
        },
      });
      console.log('✅ Welcome notification created');
    } catch (notifError) {
      console.log('⚠️ Failed to create welcome notification:', notifError);
      // Don't fail the signup if notification creation fails
    }

    console.log('📤 Sending success response to client');
    return res.status(201).json({
      success: true,
      message: "User created successfully",
      isNewUser: true,
      user: user[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();

    console.error('❌ Signup error:', error);

    // 🔥 Rollback Firebase user if DB fails
    if (req.firebaseUser?.uid) {
      await admin.auth().deleteUser(req.firebaseUser.uid);
      console.log('🔄 Firebase user deleted due to MongoDB error');
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

    // Send welcome email on first verified login (non-blocking)
    if (!user.welcomeEmailSent) {
      user.welcomeEmailSent = true;
      sendWelcomeEmail(user.email, user.fullName, user.role)
        .then(() => console.log('📧 Welcome email sent to:', user.email))
        .catch(err => console.error('Failed to send welcome email:', err));
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
      let role = req.body.role; // still required from frontend
      if (role) role = role.toLowerCase();

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
        const profile = await CoachProfile.create({
          userId: user._id,
          plan: "free",
        });
        user.coachProfile = profile._id;
        await user.save();
      }

      if (role === "player") {
        const profile = await PlayerProfile.create({
          userId: user._id,
          role: "player",
          isSelfManaged: true,
        });
        user.playerProfile = profile._id;
        await user.save();
      }

      if (role === "guardian") {
        const profile = await GuardianProfile.create({ userId: user._id });
        user.guardianProfile = profile._id;
        await user.save();
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
    let { name, email, password, role } = req.body; // Using 'name' to match frontend

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Missing fields" });
    }

    role = role.toLowerCase();

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
      const profile = await CoachProfile.create(
        [{ userId: user[0]._id, plan: "free", isVerified: false }],
        { session }
      );
      user[0].coachProfile = profile[0]._id;
      await user[0].save({ session });
    } else if (role === "player") {
      const profile = await PlayerProfile.create(
        [{ userId: user[0]._id, role: 'player', isSelfManaged: true }],
        { session }
      );
      user[0].playerProfile = profile[0]._id;
      await user[0].save({ session });
    } else if (role === "guardian") {
      const profile = await GuardianProfile.create(
        [{ userId: user[0]._id }],
        { session }
      );
      user[0].guardianProfile = profile[0]._id;
      await user[0].save({ session });
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

    console.log('🔐 Local login attempt for:', email);

    if (!email || !password) {
      return res.status(400).json({ message: "Missing credentials" });
    }

    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      console.log('❌ User not found:', email);
      return res.status(404).json({ success: false, message: "User not found." });
    }

    const isMatch = await bcrypt.compare(password, user.password || '');
    if (!isMatch) {
      console.log('❌ Invalid password for:', email);
      return res.status(400).json({ success: false, message: "Invalid credentials." });
    }

    console.log('✅ Local login successful for:', email);
    console.log('👤 User role:', user.role);

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
      accessToken, // Changed from 'token' to 'accessToken' for frontend consistency
      refreshToken,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        firebaseUid: user.firebaseUid,
      },
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



export const changePassword = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const user = await User.findById(userId).select('+password');
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const isEmailPasswordUser = Array.isArray(user.signInProviders) && user.signInProviders.includes('password');
    const hasLocalPassword = !!user.password;

    // Block pure social-provider users (Google / Apple only, no password provider)
    if (!isEmailPasswordUser && !hasLocalPassword) {
      return res.status(400).json({
        message: "You are logged in via a social provider (Google/Apple). Password change is not supported."
      });
    }

    if (hasLocalPassword) {
      // local_ users who have their password stored in MongoDB
      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Incorrect current password" });
      }

      // Hash new password for MongoDB
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      user.password = hashedPassword;
      await user.save();

      // Also sync with Firebase if the UID is not a local_ placeholder
      if (user.firebaseUid && !user.firebaseUid.startsWith('local_')) {
        try {
          await admin.auth().updateUser(user.firebaseUid, { password: newPassword });
          console.log('✅ Password synced with Firebase for UID:', user.firebaseUid);
        } catch (firebaseError) {
          console.error('⚠️ Failed to sync password with Firebase:', firebaseError);
          // MongoDB already updated — return success with a warning
          return res.status(200).json({
            success: true,
            message: "Password updated. Note: cloud sync incomplete — please use new password for future logins."
          });
        }
      }
    } else {
      // Firebase email/password user — password lives only in Firebase Auth
      // Verify current password via Firebase Auth REST API
      const firebaseWebApiKey = process.env.FIREBASE_WEB_API_KEY;
      if (!firebaseWebApiKey) {
        console.error('FIREBASE_WEB_API_KEY is not set in environment');
        return res.status(500).json({ message: "Server configuration error" });
      }

      try {
        const verifyRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${firebaseWebApiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email: user.email,
              password: currentPassword,
              returnSecureToken: false,
            }),
          }
        );

        if (!verifyRes.ok) {
          return res.status(400).json({ message: "Incorrect current password" });
        }
      } catch (verifyError) {
        console.error('Firebase password verification error:', verifyError);
        return res.status(400).json({ message: "Incorrect current password" });
      }

      // Current password is correct — update via Firebase Admin SDK
      await admin.auth().updateUser(user.firebaseUid, { password: newPassword });
      console.log('✅ Firebase Auth password updated for UID:', user.firebaseUid);
    }

    return res.status(200).json({
      success: true,
      message: "Password updated successfully"
    });

  } catch (error) {
    console.error("Change password error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
};