# 🔐 Authentication Module

This project implements a secure authentication system using **Firebase Authentication** for user identity and **JWT** for backend authorization.

> ⚠️ Passwords are **never** handled or stored by the backend.

---

## 🧱 Tech Stack (Authentication)

- **Firebase Authentication**
  - Email / Password
  - Google Sign-In
  - Apple Sign-In (ready)
- **Node.js + Express.js** (Backend API)
- **MongoDB** (User profiles & metadata)
- **JWT** (Backend authorization)
- **Flutter** (Mobile client)

---

## 🧭 Authentication Flow

### 1️⃣ Signup Flow

1. User signs up via **Firebase Authentication**
   - Email/Password or OAuth provider
2. Frontend receives a **Firebase ID Token**
3. Frontend sends the ID token to the backend
4. Backend:
   - Verifies the Firebase ID Token
   - Creates a user record in **MongoDB**
   - Rolls back (deletes) the Firebase user if DB creation fails
5. User account is successfully created

---

### 2️⃣ Login Flow

1. User logs in via **Firebase Authentication**
2. Frontend receives a **Firebase ID Token**
3. Frontend sends the token to the backend
4. Backend:
   - Verifies the Firebase ID Token
   - Finds the user in MongoDB
   - Issues a **Backend JWT**
5. Frontend stores the JWT securely and uses it for all API requests

---

## 📦 API Endpoints

### 🔹 Signup

**POST** `/api/auth/signup`

#### Headers
```http
Authorization: Bearer <FIREBASE_ID_TOKEN>
Content-Type: application/json

// test
