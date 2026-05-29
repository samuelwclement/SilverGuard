const functions = require('firebase-functions');

// You will store your API key securely in Firebase environment variables
// e.g., firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

exports.analyzeScreen = functions.https.onRequest(async (req, res) => {
  // 1. Handle CORS so your Chrome Extension can call this endpoint
  res.set('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') {
    res.set('Access-Control-Allow-Methods', 'POST');
    res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.status(204).send('');
    return;
  }

  // 2. (Future) Verify Firebase Auth Token here
  // const authHeader = req.headers.authorization;
  // if (!authHeader) return res.status(401).send('Unauthorized');

  try {
    const { base64Image, pageUrl } = req.body;

    if (!base64Image || !pageUrl) {
      return res.status(400).json({ error: { message: "Missing image or URL" } });
    }

    // 3. Construct the prompt securely on the server
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

    // 4. Call Gemini from the secure backend
    const modelVersion = "gemini-2.0-flash-lite";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${GEMINI_API_KEY}`;

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

    // 5. Send the raw Gemini data back to the extension
    res.status(200).json(data);
  } catch (error) {
    console.error("Backend Error:", error);
    res.status(500).json({ error: { message: "Internal server error analyzing image." } });
  }
});
