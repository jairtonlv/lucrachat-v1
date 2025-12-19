import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database"; // <--- NOVO IMPORT

const firebaseConfig = {
  // SUAS CHAVES CONTINUAM AS MESMAS
  apiKey: "AIzaSyBhmMf-jT3O7aBQ5DuT_ap6d9gmMTh-o3Y",
  authDomain: "lucrachat-dd429.firebaseapp.com",
  projectId: "lucrachat-dd429",
  storageBucket: "lucrachat-dd429.firebasestorage.app",
  messagingSenderId: "155846567912",
  appId: "1:155846567912:web:7b1c8e84f0bc956f23265d",
  measurementId: "G-8M9Z2XRPJD",
  // Se o painel te deu uma databaseURL específica, ela entraria aqui, 
  // mas geralmente o SDK detecta automático. Se der erro, me avise.
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const database = getDatabase(app); // <--- NOVA EXPORTAÇÃO