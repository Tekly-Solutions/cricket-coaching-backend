// import admin from "firebase-admin";
// import serviceAccount from "./service-account.js";

// admin.initializeApp({
//   credential: admin.credential.cert(serviceAccount),
// });

// export default admin;

import admin from "firebase-admin";

if (!admin.apps.length) {
  admin.initializeApp();
}

export default admin;

