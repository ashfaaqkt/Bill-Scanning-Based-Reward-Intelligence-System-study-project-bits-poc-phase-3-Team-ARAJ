# Bill Scanning Based Reward & Intelligence System (Phase 3 PoC)

Welcome to the **AI-Powered Bill Scanning – Reward & Intelligence System** interactive Proof of Concept (PoC) demonstration.

This application is built as part of our final year study project for the **BSc. Computer Science** degree at **BITS Pilani Digital**. It explores the intersection of consumer retail, optical character recognition (OCR), artificial intelligence, and automated reward logic.

---

## 🌟 Live Demo
Experience the UI demonstration here:
👉 **[Live Project Demonstration]([https://ashfaaqkt.github.io/Bill-Scanning-Based-Reward-Intelligence-System-study-project-bits-poc-phase-3-Team-ARAJ/](https://ashfaaqkt.com/Bill-Scanning-Based-Reward-Intelligence-System-study-project-bits-poc-phase-3-Team-ARAJ/public/index.html))**

*(Note: Live AI features and database writes are disabled on GitHub Pages. See the instructions below to run the complete AI setup locally).*

---

## 👨‍🎓 Academic Context & Credits

This project was developed by **Team ARAJ (Group 120)** under the guidance of our esteemed advisor.

*   **Advisor**: Prof. Uma Sankara Rao
*   **Idea**: Arpan Chatterjee
*   **Idea Executing Planner**: Jyoti Kataria
*   **Lead Developer**: Ashfaaq Feroz Muhammad
*   **Assisted Developer**: Ranjeet Singh

---

## ⚠️ Important Note Regarding GitHub Pages

If you are viewing this project hosted via GitHub Pages, please be aware that **the AI/ML scanning features and database integrations are intentionally disabled.** 

GitHub Pages operates exclusively as a static file host and cannot run the required Node.js backend server (`server.js`). Additionally, for security purposes, the sensitive API keys required to communicate with Google's Gemini AI and the live Firebase Database are appropriately **ignored** within this public Git repository.

Therefore, the GitHub Pages link serves purely as a visual showcase of the frontend UI/UX design **To fully experience the functional AI scanning, Intelligent Analytics, and Reward logic, you must clone this repository and run it locally.**

---

## 🚀 How to Run Locally (Full AI Experience)

Follow these steps to experience the complete AI extraction and backend processing pipeline on your own machine.

### Prerequisites
*   Node.js (v18+)
*   A Google Cloud account (to generate a free Gemini API key)
*   A Firebase Project (to generate an Admin SDK Service Account Key JSON)

### 1. Clone & Install
Clone the repository using your preferred method, then install the required backend dependencies.
```bash
git clone https://github.com/ashfaaqkt/Bill-Scanning-Based-Reward-Intelligence-System-study-project-bits-poc-phase-3-Team-ARAJ.git
cd Bill-Scanning-Based-Reward-Intelligence-System-study-project-bits-poc-phase-3-Team-ARAJ

# Install backend dependencies (Express, Firebase-Admin, Google GenAI SDK, etc.)
npm install
```

### 2. Configure Environment Variables
Create a root `.env` file to securely store your API keys.

1.  Go to [Google AI Studio](https://aistudio.google.com/) and generate a free API key.
2.  Go to your Firebase Project Settings -> Service Accounts -> Generate new private key. Save the resulting JSON file as `serviceAccountKey.json` exactly one directory *above* this project folder (or within this folder, but ensure you update the path).
3.  Create a file named `.env` in the root of the project directory and populate it:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key_here
```

### 3. Start the Server
Start the local Express server. This will serve the static frontend over `localhost` while actively handling the `/api/upload` requests, connecting to Gemini, and writing to your Firestore database.

```bash
npm start
```
*The server will typically run on `http://localhost:3000`.*

## 📁 Project Structure

```text
├── public/                # Frontend static assets
│   ├── index.html         # Main user interface (design)
│   ├── style.css          # CSS styles & Animations
│   ├── script.js          # Client-side logic & Dynamic Modals
│   └── assets/            # Project SVGs and Images
├── server.js              # Express.js Backend Server & Routing
├── .env                   # Environment config (API Keys) - Ignored in Git
├── package.json           # Node dependencies
└── README.md              # Project Documentation
```

---

## 🔍 Features Demonstrated in this PoC

*   **Unique UI**: A visually stunning, unique and hardware-accelerated interface designed for maximum user engagement.
*   **Gemini 2.5 Flash Integration**: Real-time extraction of receipts using multimodal AI capabilities contextually bound by strict JSON schemas.
*   **Automated Validation & Blur Detection**: Built-in AI checks accurately identify blurry or unreadable formats and seamlessly prompt the user for a clearer image via a custom 422 Unprocessable Entity error modal.
*   **Intelligent Duplicate Detection**: Real-time HTTP integrations with the backend Firestore database automatically check for duplicate scans (matching merchant, date, and exact total) and return custom 409 Conflict messages.
*   **Robust HTTP Integrations**: Seamless REST API communication leveraging Express.js, protected by mock JWT Authentication and robust error-handling pipelines (including Google API rate limits handling).
*   **Tiered Reward Logic**: Points and multipliers assigned dynamically based on the normalized categories extracted individually from the uploaded bills.
*   **Intelligent Analytics**: AI-driven mock insights derived from spending patterns.

---

## ✍️ Authors

This system was collaboratively engineered by **Team ARAJ - Group 120** from BITS Pilani Digital.

*   **Arpan Chatterjee** (Idea Formulation)
*   **Jyoti Kataria** (Idea Executing Planner)
*   **Ashfaaq Feroz Muhammad** (Lead Developer)
*   **Ranjeet Singh** (Assisted Developer)

Under the academic advisement of **Prof. Uma Sankara Rao**.

---

## 📜 License

This project is licensed under the **MIT License**. It is strictly an educational Proof of Concept created for an academic study project. You are free to inspect, learn from, and modify this code for your own projects, provided it remains open and properly attributed. 

---

## 🔮 Future Improvements

We have an exciting roadmap mapped out to scale and enhance this ecosystem:
*   **API & SDK Development**: Exposing our core OCR and gamified reward validation logic via dedicated APIs and client SDKs, allowing other retail platforms to natively integrate our technology.
*   **Brand Collaboration**: Partnering with major brands for cross-platform collaborations and exclusive reward vouchers.
*   **Data Sharing Ecosystem**: Establishing secure data-sharing pipelines with partner brands. By sharing anonymized, aggregated consumer spending analytics, brands can run highly targeted marketing campaigns.

---

## 🎯 Conclusion

The **Bill Scanning Based Reward & Intelligence System** successfully demonstrates the incredible potential of combining modern, aesthetically stunning frontend architectures with bleeding-edge AI Models like Gemini 2.5 Flash. 

By automating the mundane task of receipt data entry and gamifying the experience with instant scratch-card rewards and personalized analytics, this PoC validates a future where retailer loyalty programs are seamless, automated, and deeply engaging for the consumer.
