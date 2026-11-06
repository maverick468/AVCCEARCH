// ============================================================
// js/firebase.js — Core Infrastructure Configuration Engine
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged,
  GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { 
  getFirestore, collection, addDoc, doc, setDoc, deleteDoc, query, where, orderBy, onSnapshot, getDocs, getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDtJmTtkyhp5zeU1oQ2_JMlKFeXqu23Olk",
    authDomain: "avcearchs.firebaseapp.com",
    projectId: "avcearchs",
    storageBucket: "avcearchs.firebasestorage.app",
    messagingSenderId: "125676956473",
    appId: "1:125676956473:web:48153359a1a518b8f016e8",
    measurementId: "G-500PP8LV0H"
};

// Initialize Active Ecosystem Instances
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const googleProvider = new GoogleAuthProvider();

// Persistent Cloudinary Cloud Key Mappings
export const CLOUDINARY_CLOUD_NAME = "dol2dzopt";
export const CLOUDINARY_PRESET_NAME = "ml_default";

// Re-export Modular Database Controls
export { 
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, signInWithPopup, GoogleAuthProvider,
  collection, addDoc, doc, setDoc, deleteDoc, query, where, orderBy, onSnapshot, getDocs, getDoc
};

// Security Context String Sanitizer (XSS Mitigation)
export function sanitize(str) {
  if (typeof str !== "string") return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
}

// Global Relative Performance Time Engine
export function timeAgo(timestamp) {
  if (!timestamp) return "Just now";
  const date = timestamp.seconds ? new Date(timestamp.seconds * 1000) : new Date(timestamp);
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return "Just now";
  const intervals = { year: 31536000, month: 2592000, week: 604800, day: 86400, hour: 3600, minute: 60 };
  for (const [unit, value] of Object.entries(intervals)) {
    const count = Math.floor(seconds / value);
    if (count >= 1) return `${count} ${unit}${count > 1 ? "s" : ""} ago`;
  }
  return "Just now";
}