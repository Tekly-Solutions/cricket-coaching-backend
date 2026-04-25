import admin from "../config/firebase.js";
import User from "../models/User.js";

// ─── Token verification cache ────────────────────────────────────────────────
// Keyed by idToken, value: { decodedToken, user, expiresAt }
// TTL: 60 seconds — short enough to stay safe, long enough to cover the burst
// of parallel requests that arrive at login / app launch.
const tokenCache = new Map();
const TOKEN_CACHE_TTL_MS = 60_000;

function pruneExpiredTokens() {
  const now = Date.now();
  for (const [key, entry] of tokenCache) {
    if (entry.expiresAt <= now) tokenCache.delete(key);
  }
}

// Prune stale entries every 2 minutes so the map doesn't grow unboundedly.
setInterval(pruneExpiredTokens, 120_000);
// ─────────────────────────────────────────────────────────────────────────────

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("❌ Missing or invalid authorization header");
      return res.status(401).json({ message: "Missing token" });
    }

    const idToken = authHeader.split(" ")[1];

    // ── Check cache first ──────────────────────────────────────────────────
    const cached = tokenCache.get(idToken);
    if (cached && cached.expiresAt > Date.now()) {
      req.firebaseUser = cached.decodedToken;
      if (cached.user) req.user = cached.user;
      return next();
    }

    // ── Verify with Firebase (network round-trip) ──────────────────────────
    console.log("🔑 Attempting Firebase token verification...");
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log("✅ Firebase token verified for:", decodedToken.email);

    // ── Load user from MongoDB ─────────────────────────────────────────────
    let userPayload = null;
    const dbUser = await User.findOne({ firebaseUid: decodedToken.uid });
    if (!dbUser) {
      console.log("⚠️ User not found in MongoDB for Firebase UID:", decodedToken.uid);
    } else {
      console.log("👤 User found via Firebase UID:", decodedToken.email, "Role:", dbUser.role);
      userPayload = {
        id: dbUser._id.toString(),
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        role: dbUser.role,
        fullName: dbUser.fullName,
      };
      req.user = userPayload;
    }

    req.firebaseUser = decodedToken;

    // ── Store in cache ─────────────────────────────────────────────────────
    tokenCache.set(idToken, {
      decodedToken,
      user: userPayload,
      expiresAt: Date.now() + TOKEN_CACHE_TTL_MS,
    });

    next();
  } catch (error) {
    console.error("❌ Firebase token verification error:", error.message);
    return res.status(401).json({ message: "Invalid Firebase token" });
  }
};
