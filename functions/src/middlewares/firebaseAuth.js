import admin from "../config/firebase.js";

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Missing token" });
    }

    const idToken = authHeader.split(" ")[1];

    const decodedToken = await admin.auth().verifyIdToken(idToken);

    req.firebaseUser = decodedToken; // uid, email
    next();
  } catch (error) {
    console.error("Firebase token error:", error);
    return res.status(401).json({ message: "Invalid Firebase token" });
  }
};
