"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;

// Set session cookie
export async function setSessionCookie(idToken: string) {
  try {
    const cookieStore = await cookies();

    // Create session cookie first
    const sessionCookie = await auth.createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION * 1000, // milliseconds
    });

    // Set cookie in the browser
    cookieStore.set("session", sessionCookie, {
      maxAge: SESSION_DURATION,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      sameSite: "lax",
    });

    // Verify the token after setting cookie
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error: any) {
    console.error("Error setting session cookie:", error);
    
    // Check for specific Firebase Auth errors
    if (error.code === 'auth/invalid-id-token') {
      throw new Error("Invalid authentication token. Please sign in again.");
    } else if (error.code === 'auth/id-token-expired') {
      throw new Error("Authentication token expired. Please sign in again.");
    }
    
    throw error;
  }
}

export async function signUp(params: SignUpParams) {
  const { uid, name, email } = params;

  try {
    // Create user document in Firestore
    await db.collection("users").doc(uid).set({
      name,
      email,
      createdAt: new Date().toISOString(),
    });

    return {
      success: true,
      message: "Account created successfully. Please sign in.",
    };
  } catch (error: any) {
    console.error("Error creating user:", error);
    return {
      success: false,
      message: "Failed to create account. Please try again.",
    };
  }
}

export async function signIn(params: SignInParams) {
  const { email, idToken } = params;

  try {
    // First verify and set the session cookie
    const decodedToken = await setSessionCookie(idToken);
    
    // Check if user exists in Firestore
    const userDoc = await db.collection("users").doc(decodedToken.uid).get();
    if (!userDoc.exists) {
      return {
        success: false,
        message: "User account not found. Please sign up first.",
      };
    }

    return {
      success: true,
      message: "Signed in successfully",
    };
  } catch (error: any) {
    console.error("Sign in error:", error);

    return {
      success: false,
      message: error.message || "Failed to log into account. Please try again.",
    };
  }
}

// Sign out user by clearing the session cookie
export async function signOut() {
  const cookieStore = await cookies();

  cookieStore.delete("session");
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<User | null> {
  const cookieStore = await cookies();

  const sessionCookie = cookieStore.get("session")?.value;
  if (!sessionCookie) return null;

  try {
    const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

    // get user info from db
    const userRecord = await db
      .collection("users")
      .doc(decodedClaims.uid)
      .get();
    if (!userRecord.exists) return null;

    return {
      ...userRecord.data(),
      id: userRecord.id,
    } as User;
  } catch (error) {
    console.log(error);

    // Invalid or expired session
    return null;
  }
}

// Check if user is authenticated
export async function isAuthenticated() {
  const user = await getCurrentUser();
  return !!user;
}
