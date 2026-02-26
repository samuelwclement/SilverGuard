// 🛠️ DEVELOPER SETTINGS
// Paste your key inside the quotes below to skip the login screen.
// (Example: "AIzaSyD...")
const TEST_API_KEY = "AIzaSyCrbVuNcraUdpF91G4O4vReAEmu_0O8kjU"; 

document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const scanBtn = document.getElementById('scanBtn');
  const changeKeyBtn = document.getElementById('changeKeyBtn');
  
  // 1. Check for Hardcoded Key first (for fast testing)
  if (TEST_API_KEY && TEST_API_KEY.length > 10) {
    console.log("🛠️ Using Hardcoded Dev Key");
    localStorage.setItem('geminiApiKey', TEST_API_KEY);
  }

  // 2. Check for saved API key
  const savedKey = localStorage.getItem('geminiApiKey');
  if (savedKey) {
    showMainView();
  } else {
    console.log("ℹ️ No API Key found. Waiting for user input.");
  }

  saveKeyBtn.addEventListener('click', () => {
    const key = apiKeyInput.value.trim();
    if (key) {
      localStorage.setItem('geminiApiKey', key);
      showMainView();
    }
  });

  changeKeyBtn.addEventListener('click', () => {
    localStorage.removeItem('geminiApiKey');
    document.getElementById('setup-view').classList.remove('hidden');
    document.getElementById('main-view').classList.add('hidden');
    console.log("🔄 Key reset by user.");
  });

  scanBtn.addEventListener('click', async () => {
    // UI Updates
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');
    scanBtn.disabled = true;

    try {
      console.log("📸 Starting Screen Capture...");
      const screenshotUrl = await captureScreen();
      console.log("✅ Screenshot captured.");
      
      const base64Image = screenshotUrl.split(',')[1];
      
      console.log("🚀 Sending to Gemini...");
      const analysis = await analyzeImageWithGemini(base64Image);
      
      console.log("🤖 Gemini Analysis Complete:", analysis);
      displayResult(analysis);

    } catch (error) {
      console.error("❌ CRITICAL ERROR:", error);
      document.getElementById('analysis-text').innerText = "⚠️ Error: " + error.message;
      document.getElementById('result').classList.remove('hidden');
    } finally {
      document.getElementById('loading').classList.add('hidden');
      scanBtn.disabled = false;
    }
  });
});

function showMainView() {
  document.getElementById('setup-view').classList.add('hidden');
  document.getElementById('main-view').classList.remove('hidden');
}

function captureScreen() {
  return new Promise((resolve, reject) => {
    chrome.tabs.captureVisibleTab(null, { format: 'png' }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        reject(new Error("Capture Failed: " + chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

async function analyzeImageWithGemini(base64Image) {
  const apiKey = localStorage.getItem('geminiApiKey');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab.url;

  // 🔍 DEBUGGING: Log the model URL being used

// Using the "Lite" model from your available list - perfect for Tier 1 keys
const modelVersion = "gemini-2.0-flash-lite";
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelVersion}:generateContent?key=${apiKey}`;
  
  console.log(`📡 Connecting to Model: ${modelVersion}`);
  console.log(`🔗 Target URL: ${url.replace(apiKey, "HIDDEN_KEY")}`); // Log URL without leaking key

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

  const requestBody = {
    contents: [{
      parts: [
        { text: promptText },
        { inline_data: { mime_type: "image/png", data: base64Image } }
      ]
    }]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  // 🔍 ROBUST ERROR LOGGING
  if (!response.ok) {
    console.error("🛑 API RESPONSE ERROR:", data); // View full error object in Console
    const status = response.status;
    const errorMsg = data.error?.message || "Unknown API Error";
    const errorStatus = data.error?.status || "UNKNOWN_STATUS";
    
    // Throw a detailed error for the UI
    throw new Error(`API Error ${status} (${errorStatus}): ${errorMsg}`);
  }
  
  try {
    const text = data.candidates[0].content.parts[0].text;
    console.log("📝 Raw Model Text:", text); // See exactly what Gemini said
    
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    console.error("💥 JSON PARSE ERROR. Raw text was:", data.candidates[0].content.parts[0].text);
    throw new Error("Gemini returned invalid JSON. Check console for raw output.");
  }
}

function displayResult(analysis) {
  const resultDiv = document.getElementById('result');
  const riskDiv = document.getElementById('risk-level');
  const textDiv = document.getElementById('analysis-text');

  riskDiv.innerText = analysis.riskLevel.toUpperCase();
  textDiv.innerText = analysis.reasoning;

  riskDiv.className = ''; 
  if (analysis.riskLevel.toLowerCase().includes('safe')) riskDiv.classList.add('risk-safe');
  else if (analysis.riskLevel.toLowerCase().includes('suspicious')) riskDiv.classList.add('risk-suspicious');
  else riskDiv.classList.add('risk-danger');

  resultDiv.classList.remove('hidden');
}