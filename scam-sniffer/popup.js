document.addEventListener('DOMContentLoaded', () => {
  const signInBtn = document.getElementById('saveKeyBtn'); // Repurposed for Sign In
  const scanBtn = document.getElementById('scanBtn');
  const signOutBtn = document.getElementById('changeKeyBtn'); // Repurposed for Sign Out
  
  // 1. Check if user is already signed in (silent authentication)
  chrome.identity.getAuthToken({ interactive: false }, (token) => {
    if (chrome.runtime.lastError || !token) {
      console.log("ℹ️ User not signed in. Waiting for user to click Sign In.");
      showSetupView();
    } else {
      showMainView();
    }
  });

  // 2. Handle Sign In
  signInBtn.addEventListener('click', () => {
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError) {
        console.error("❌ Sign in failed:", chrome.runtime.lastError.message);
        return;
      }
      console.log("✅ Signed in successfully!");
      showMainView();
    });
  });

  // 3. Handle Sign Out
  signOutBtn.addEventListener('click', () => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (token) {
        chrome.identity.removeCachedAuthToken({ token: token }, () => {
          console.log("🔄 Signed out by user.");
          document.getElementById('setup-view').classList.remove('hidden');
          document.getElementById('main-view').classList.add('hidden');
        });
      }
    });
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

function showSetupView() {
  document.getElementById('setup-view').classList.remove('hidden');
  document.getElementById('main-view').classList.add('hidden');
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
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab.url;

  // Grab the user's Google Auth token before making the request
  const userToken = await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive: false }, (token) => {
      if (chrome.runtime.lastError || !token) {
        reject(new Error("Authentication failed. Please sign in again."));
      } else {
        resolve(token);
      }
    });
  });

  // 📡 Connecting to your secure Firebase Backend
  const backendUrl = "https://analyzescreen-n3up3kbwva-uc.a.run.app";
  
  console.log(`📡 Sending screenshot to secure backend...`);

  const requestBody = {
    base64Image: base64Image,
    pageUrl: pageUrl
  };

  const response = await fetch(backendUrl, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
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