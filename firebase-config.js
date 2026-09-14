
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAXqJ8yGw-hcU_UKNKadPK-ne9eoL9Wj6k",
  authDomain: "e-commerce-plssem.firebaseapp.com",
  projectId: "e-commerce-plssem",
  storageBucket: "e-commerce-plssem.firebasestorage.app",
  messagingSenderId: "148901251375",
  appId: "1:148901251375:web:98e78fa83e6b15025639da"
};

const app = initializeApp(firebaseConfig);
window.firebaseDB = getFirestore(app);
