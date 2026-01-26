import Admin from "../../models/Admin.js";
import { signAdminAccessToken } from "../../utils/adminJwt.js";
import cookieOptions from "../../utils/cookieOptions.js";

/**
 * POST /api/admin/login
 * Admin login → sets HTTP-only cookie
 */
export const adminLogin = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    // Find admin
    const admin = await Admin.findOne({ email: email.toLowerCase() }).select("+password");

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    if (!admin.isActive) {
      return res.status(403).json({
        success: false,
        message: "Admin account is deactivated",
      });
    }

    // Check password
    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials",
      });
    }

    // Update last login
    admin.lastLogin = new Date();
    await admin.save();

    // Generate token
    const accessToken = signAdminAccessToken({
      adminId: admin._id,
      email: admin.email,
      role: admin.role,
    });

    // Set HTTP-only cookie using shared config
    res.cookie("adminToken", accessToken, cookieOptions.adminToken);

    return res.status(200).json({
      success: true,
      message: "Admin login successful",
      admin: {
        id: admin._id,
        email: admin.email,
        fullName: admin.fullName,
        role: admin.role,
      },
    });
  } catch (error) {
    console.error("Admin login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * POST /api/admin/logout
 * Clears the adminToken cookie
 */
export const adminLogout = async (req, res) => {
  try {
    // Clear the cookie
    res.clearCookie("adminToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Admin logged out successfully",
    });
  } catch (error) {
    console.error("Admin logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Logout failed",
    });
  }
};