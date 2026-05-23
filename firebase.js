import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCYTBzw3EF5RS3A5gIyBaTDUS3lho7pWMA",
  authDomain: "puffybeats-95c41.firebaseapp.com",
  projectId: "puffybeats-95c41",
  storageBucket: "puffybeats-95c41.firebasestorage.app",
  messagingSenderId: "443702920366",
  appId: "1:443702920366:web:d6af92fbc8122542db193f",
  measurementId: "G-0PNGPJQR3M"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
