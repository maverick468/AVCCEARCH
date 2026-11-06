// ============================================================
// js/signin.js — Standalone Gate Controller (Fixed Toggle)
// ============================================================
import { 
  auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, googleProvider 
} from "./firebase.js";
import { updateProfile } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

let isSignUpMode = false;

// DOM Target Selectors
const authForm        = document.getElementById("standaloneAuthForm");
const authTitle       = document.getElementById("authTitle");
const authSubtitle    = document.getElementById("authSubtitle");
const authSubmitBtn   = document.getElementById("authSubmitBtn");
const authToggleText  = document.getElementById("authToggleText");
const authToggleLink  = document.getElementById("authToggleLink");
const usernameBox     = document.getElementById("usernameFieldContainer");
const usernameInput   = document.getElementById("authUsername");
const googleAuthBtn   = document.getElementById("googleAuthBtn");

// Toggle Engine UI Mutator (Toggles between Login and Registration states)
authToggleLink?.addEventListener("click", (e) => {
  e.preventDefault();
  isSignUpMode = !isSignUpMode;
  
  // 1. Swap titles and button labels
  authTitle.textContent = isSignUpMode ? "Create Account" : "Sign In";
  authSubtitle.textContent = isSignUpMode ? "Join our global academic collective catalog." : "Access your personal dashboard profile account.";
  authSubmitBtn.textContent = isSignUpMode ? "Register Account" : "Continue";
  authToggleText.textContent = isSignUpMode ? "Already have an account?" : "Don't have an account?";
  authToggleLink.textContent = isSignUpMode ? "Sign In" : "Create one";
  
  // 2. Safely slide/show the username container if signing up
  if (usernameBox) {
    usernameBox.style.display = isSignUpMode ? "block" : "none";
    if (usernameInput) usernameInput.required = isSignUpMode;
  }
});

// Submit Handling Process
authForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;

  try {
    if (isSignUpMode) {
      // Flow A: Create a brand new user account
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(credential.user, { 
        displayName: usernameInput?.value.trim() || email.split("@")[0] 
      });
      alert("Account created successfully!");
    } else {
      // Flow B: Sign in existing user account
      await signInWithEmailAndPassword(auth, email, password);
    }
    
    // Redirect cleanly to Dashboard on successful authentication
    window.location.href = "index.html";
  } catch (err) { 
    alert("Authentication Failure: " + err.message); 
  }
});

// OAuth Popup Framework Link
googleAuthBtn?.addEventListener("click", async () => {
  try {
    await signInWithPopup(auth, googleProvider);
    window.location.href = "index.html";
  } catch (err) { 
    if (err.code !== "auth/popup-closed-by-user") {
      alert("Google Engine Failure: " + err.message); 
    }
  }
});