import { initializeApp } from "firebase/app";
import { getDataConnect, queryRef, executeQuery } from "firebase/data-connect";
import { connectorConfig } from "./src/dataconnect-generated/esm/index.esm.js";

const firebaseConfig = {
  apiKey: "AIzaSyBzzdXym0KRhQzV2VGayUXAzFGMJkr9iAA",
  authDomain: "cyee-9c1e4.firebaseapp.com",
  projectId: "cyee-9c1e4",
  storageBucket: "cyee-9c1e4.firebasestorage.app",
  messagingSenderId: "634044012902",
  appId: "1:634044012902:web:636c6f88381331b7c0d0a7"
};

const app = initializeApp(firebaseConfig);
connectorConfig.location = 'asia-northeast3';
const dc = getDataConnect(app, connectorConfig);

async function test() {
  try {
    console.log("Testing Data Connect...");
    const ref = queryRef(dc, "ListAllSites");
    const result = await executeQuery(ref);
    console.log("Result:", result.data);
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
