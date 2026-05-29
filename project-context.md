# Project: SilverGuard
**Mission:** A proactive, Manifest V3 Chrome Extension that acts as a "digital advocate" for senior citizens, analyzing web pages in real-time to detect social engineering, dark patterns, and phishing attempts.

## Core Architecture (MVP)
* **Environment:** Google Chrome (Manifest V3)
* **Frontend Stack:** Vanilla HTML, CSS, JavaScript (No frameworks to ensure lightweight performance).
* **Backend Stack:** Firebase Cloud Functions v2 (Node.js) acting as a secure middleman.
* **AI Engine:** Google Gemini API (`gemini-2.0-flash-lite`).
* **Core Loop:** 
  1. User authenticates via Google Sign-In (`chrome.identity`).
  2. User clicks "Scan Current Page".
  3. `chrome.tabs.captureVisibleTab` captures a Base64 PNG of the active viewport.
  4. Image, URL, and Google OAuth Access Token are sent to the secure Firebase endpoint.
  5. Firebase verifies the token, constructs the prompt, securely attaches the Gemini API key, and queries Gemini.
  6. Gemini returns a JSON object (`{ "riskLevel": "...", "reasoning": "..." }`), which flows back to the UI.

## Design & UX Guidelines
* **Target Audience:** Seniors (e.g., ages 65-75+). 
* **Accessibility:** High contrast (Primary Blue: `#2F54EB`), large typography, no complex technical jargon. Error states must be reassuring, not panic-inducing.
* **Iconography:** Clear, solid-shape SVGs (e.g., a shield). 

## Current Status
* **Completed:** Popup UI/UX, Gemini API integration, screen capture logic, error handling, local storage for developer API key testing.
* **Completed (Core):** Popup UI/UX, Gemini API integration, screen capture logic, color-coded results.
* **Completed (Recent Architecture Pivot):**
  * **SaaS Backend:** Deployed a Firebase Cloud Function to securely hide the `GEMINI_API_KEY` using Google Cloud Secret Manager. Fixed strict CORS requirements.
  * **Authentication:** Replaced manual API key entry with 1-click Google Sign-In via `chrome.identity`. Backend validates tokens via Google's OAuth2 tokeninfo endpoint.
* **In Progress:** Preparing for live user testing at a local retirement community. Testing will focus on comprehension of the AI's reasoning text and UI visibility.

## Immediate Next Technical Steps
* **SaaS Architecture Pivot:** Moving away from a client-side API key model. Need to implement a backend middleman (e.g., Firebase Authentication + Cloud Functions) to securely house the master Gemini API key and allow users to simply "Log In" via Google.
* **Domain Allowlist:** Implement a local `safelist.json` to bypass Gemini for known safe domains (e.g., google.com, chase.com) to save quota and speed up user experience.
* **Deployment:** Package the extension into a `.zip` file to prepare for Chrome Web Store distribution.
* **Result Caching (Optional):** Implement local storage caching for previously scanned unknown domains to further reduce API usage if a user clicks scan on the same page twice.