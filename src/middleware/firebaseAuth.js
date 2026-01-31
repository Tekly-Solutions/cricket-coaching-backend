import admin from '../config/firebase.js';
import User from '../models/User.js';

export const verifyFirebaseToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Missing token' });
    }

    const idToken = authHeader.split(' ')[1];
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    
    // Find or create user in MongoDB
    let user = await User.findOne({ firebaseUid: decodedToken.uid });
    
    if (!user) {
      // Auto-create user if doesn't exist - will be completed by signup endpoint
      console.log('Firebase user authenticated:', decodedToken.email);
    } else {
      // Attach user info to request
      req.user = {
        id: user._id.toString(),
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        role: user.role,
        fullName: user.fullName,
      };
    }
    
    req.firebaseUser = decodedToken; // Keep original Firebase data
    next();
  } catch (error) {
    console.error('Firebase token error:', error.message);
    return res.status(401).json({ message: 'Invalid Firebase token' });
  }
};
