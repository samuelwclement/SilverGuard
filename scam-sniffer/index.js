// Import the necessary modules for Firebase Cloud Functions v2 and Firebase Admin SDK
const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

// Initialize the Firebase Admin SDK. This is crucial for verifying ID tokens.
admin.initializeApp();

// Define the GEMINI_API_KEY as a secret.
// This assumes you have already set the secret using the Firebase CLI:
// `firebase functions:secrets:set GEMINI_API_KEY`
// This makes the secret securely available to your function.
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

exports.analyzeScreen = onRequest(
  {
    // Bind the GEMINI_API_KEY secret to this function. This ensures the function
    // has access to the secret's value at runtime and handles its lifecycle.
    secrets: [GEMINI_API_KEY],
    // Enable CORS for your Cloud Function. Setting `cors: true` automatically
    // handles common CORS headers for simple requests, replacing your manual handling.
    cors: true,
  },
  async (req, res) => {
    // Ensure that only POST requests are processed by this function.
    if (req.method !== 'POST') {
      return res.status(405).send('Method Not Allowed');
    }

    // 1. Securely verify the Google OAuth/Firebase ID Token
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error('Authorization header missing or malformed.');
      return res.status(401).send('Unauthorized: Missing or invalid token format.');
    }

    const idToken = authHeader.split('Bearer ')[1];

    try {
      // Verify the Firebase ID token using the Admin SDK.
      // This checks if the token is valid, not expired, and issued by Firebase.
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      console.log('Successfully verified Firebase ID token for user:', decodedToken.uid);

      // You can now access user information from `decodedToken`, e.g., decodedToken.email,
      // and use it for further authorization logic if needed.

      const { base64Image, pageUrl } = req.body;

      if (!base64Image || !pageUrl) {
        return res.status(400).json({ error: { message: "Missing image or URL in request body." } });
      }

      const promptText = `
        You are a cyber security expert.
        The user is visiting: ${pageUrl}

        Analyze this screenshot.
        Look for: Fake logos, urgency tactics, bad grammar, URL mismatches.

        Return JSON:
        {
          "riskLevel": "Safe", "Suspicious", or "High Risk",
          "reasoning": "Concise explanation for a senior citizen."
        }
      `;

      const modelVersion = "gemini-2.0-flash-lite";
      // 2. Access the GEMINI_API_KEY using modern secret manager best practices
      // The `.value()` method retrieves the secret's value securely.
      const geminiApiKey = GEMINI_API_KEY.value();

      if (!geminiApiKey) {
        console.error('GEMINI_API_KEY not found. Ensure it is set in Firebase Secret Manager.');
        return res.status(500).json({ error: { message: "Server configuration error: Gemini API Key missing." } });
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${geminiApiKey}`;

      const geminiResponse = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: promptText },
              { inline_data: { mime_type: "image/png", data: base64Image } }
            ]
          }]
        })
      });

      const data = await geminiResponse.json();

      if (!geminiResponse.ok) {
        console.error("Gemini API Error:", data);
        return res.status(geminiResponse.status).json(data);
      }

      res.status(200).json(data);

    } catch (error) {
      // Handle specific Firebase ID token verification errors
      if (error.code === 'auth/id-token-expired') {
        console.error('Firebase ID token has expired:', error.message);
        return res.status(401).send('Unauthorized: Token expired. Please re-authenticate.');
      }
      if (error.code === 'auth/argument-error' || error.code === 'auth/invalid-id-token') {
        console.error('Invalid Firebase ID token:', error.message);
        return res.status(401).send('Unauthorized: Invalid token. Please provide a valid token.');
      }
      console.error("Backend Error:", error);
      res.status(500).json({ error: { message: "Internal server error analyzing image." } });
    }
  }
);
