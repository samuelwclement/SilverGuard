const {onRequest} = require("firebase-functions/v2/https");
const {defineSecret} = require("firebase-functions/params");
const GEMINI_API_KEY = defineSecret("GEMINI_API_KEY");

exports.analyzeScreen = onRequest(
    {
      secrets: [GEMINI_API_KEY],
    },
    async (req, res) => {
      res.set("Access-Control-Allow-Origin", "*");
      res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.set("Access-Control-Allow-Headers", "Content-Type, Authorization");

      if (req.method === "OPTIONS") {
        return res.status(204).send("");
      }

      if (req.method !== "POST") {
        return res.status(405).json({error: {message: "Method Not Allowed"}});
      }

      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith("Bearer ")) {
        console.error("Authorization header missing.");
        return res.status(401).json({error: {message: "Invalid token."}});
      }

      const accessToken = authHeader.split("Bearer ")[1];

      try {
        // Verify the Google OAuth Access Token
        const tokenResponse = await fetch(`https://oauth2.googleapis.com/tokeninfo?access_token=${accessToken}`);
        if (!tokenResponse.ok) {
          console.error("Invalid Google OAuth token.");
          return res.status(401).json({error: {message: "Invalid token."}});
        }
        const decodedToken = await tokenResponse.json();
        console.log("Verified token for user:", decodedToken.email);

        const {base64Image, pageUrl} = req.body;

        if (!base64Image || !pageUrl) {
          return res.status(400).json({
            error: {message: "Missing image or URL in request body."},
          });
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
        const geminiApiKey = GEMINI_API_KEY.value();

        if (!geminiApiKey) {
          console.error("GEMINI_API_KEY not found.");
          return res.status(500).json({
            error: {message: "Server config error: API Key missing."},
          });
        }

        const baseUrl = "https://generativelanguage.googleapis.com";
        const apiPath = `/v1beta/models/${modelVersion}:generateContent`;
        const url = `${baseUrl}${apiPath}?key=${geminiApiKey}`;

        const geminiResponse = await fetch(url, {
          method: "POST",
          headers: {"Content-Type": "application/json"},
          body: JSON.stringify({
            contents: [{
              parts: [
                {text: promptText},
                {inline_data: {mime_type: "image/png", data: base64Image}},
              ],
            }],
          }),
        });

        const data = await geminiResponse.json();

        if (!geminiResponse.ok) {
          console.error("Gemini API Error:", data);
          return res.status(geminiResponse.status).json(data);
        }

        res.status(200).json(data);
      } catch (error) {
        console.error("Backend Error:", error);
        res.status(500).json({
          error: {message: "Internal server error analyzing image."},
        });
      }
    },
);
