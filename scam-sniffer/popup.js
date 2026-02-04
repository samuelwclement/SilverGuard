document.addEventListener('DOMContentLoaded', () => {
  const apiKeyInput = document.getElementById('apiKeyInput');
  const saveKeyBtn = document.getElementById('saveKeyBtn');
  const scanBtn = document.getElementById('scanBtn');
  const changeKeyBtn = document.getElementById('changeKeyBtn');
  
  // Check for saved API key
  const savedKey = localStorage.getItem('geminiApiKey');
  if (savedKey) {
    showMainView();
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
  });

  scanBtn.addEventListener('click', async () => {
    // UI Updates
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('result').classList.add('hidden');
    scanBtn.disabled = true;

    try {
      // 1. Capture Visible Tab
      const screenshotUrl = await captureScreen();
      
      // 2. Prepare Image Data (Remove "data:image/png;base64," prefix)
      const base64Image = screenshotUrl.split(',')[1];
      
      // 3. Analyze with Gemini
      const analysis = await analyzeImageWithGemini(base64Image);
      
      // 4. Display Results
      displayResult(analysis);

    } catch (error) {
      document.getElementById('analysis-text').innerText = "Error: " + error.message;
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
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        resolve(dataUrl);
      }
    });
  });
}

async function analyzeImageWithGemini(base64Image) {
  const apiKey = localStorage.getItem('geminiApiKey');
  
  // 1. Get the current tab's URL so Gemini can research it
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const pageUrl = tab.url;

  // Switch to the 'exp' (experimental) model which has the open free tier
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`;

  const promptText = `
    You are a cyber security expert. 
    1. Analyze the screenshot for visual red flags.
    2. USE YOUR GOOGLE SEARCH TOOL to research this specific URL: "${pageUrl}"
    3. Check if this domain has a reputation for phishing or scams.
    4. Give a concise and simple overview of why the website is either safe or dangerous, simple enough for a senior citizen to understand.
    
    Return a JSON response:
    {
      "riskLevel": "Safe", "Suspicious", or "High Risk",
      "reasoning": "Explain based on both visual analysis and online reputation research."
    }
  `;

  const requestBody = {
    contents: [{
      parts: [
        { text: promptText },
        {
          inline_data: {
            mime_type: "image/png",
            data: base64Image
          }
        }
      ]
    }],
    // 👇 THIS IS THE NEW PART: Enabling Google Search
    tools: [
      {
        google_search: {} 
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  // Error Handling
  if (!response.ok) {
    throw new Error(data.error?.message || "API Error: " + response.statusText);
  }
  
  try {
    const text = data.candidates[0].content.parts[0].text;
    const cleanJson = text.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanJson);
  } catch (e) {
    throw new Error("Failed to parse response: " + e.message);
  }
}

function displayResult(analysis) {
  const resultDiv = document.getElementById('result');
  const riskDiv = document.getElementById('risk-level');
  const textDiv = document.getElementById('analysis-text');

  riskDiv.innerText = analysis.riskLevel.toUpperCase();
  textDiv.innerText = analysis.reasoning;

  // Color coding
  riskDiv.className = ''; // reset
  if (analysis.riskLevel.toLowerCase().includes('safe')) riskDiv.classList.add('risk-safe');
  else if (analysis.riskLevel.toLowerCase().includes('suspicious')) riskDiv.classList.add('risk-suspicious');
  else riskDiv.classList.add('risk-danger');

  resultDiv.classList.remove('hidden');
}