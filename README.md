# Bill Scanning Reward System - Phase 3 FP

> **Disclaimer:** This project is for educational purposes only. It was developed as part of the BSc Computer Science BITS Pilani 2026 Study Project.

## Live Demo
[https://ashfaaqkt.com/Bill-Scanning-Based-Reward-Intelligence-System-study-project-bits-poc-phase2/]

A futuristic, premium light-themed Proof of Concept for a bill scanning and reward intelligence system. This application uses an Express backend and Google's Gemini AI to perform OCR and information extraction on receipt images, then awards points based on smart categorization rules.

**Developed by Team ARAJ (Group 120)**
- Ashfaaq Feroz Muhammad
- Ranjeet Singh
- Arpan Chatterjee
- Jyoti Kataria

## Tech Stack
- **Frontend:** Vanilla HTML, CSS, JavaScript (Glassmorphism, Light Luxury Theme)
- **Backend:** Node.js, Express
- **Database:** SQLite
- **AI/OCR:** Google Gemini 2.5 Flash API
- **File Parsing:** Multer (memory storage)

## Setup Instructions

To experience the AI features and use the API, you must clone this repository and supply your own Google Gemini API key.

### Prerequisites
- Node.js installed on your machine.
- A free Google Gemini API key from Google AI Studio.

### 1. Clone the Repository
Clone this repository to your local machine:
```bash
git clone <your-repository-url>
cd <repository-directory>
```

### 2. Install Dependencies
Run the following command in the project root to install the required backend packages:
```bash
npm install
```

### 3. Add Your API Key
Create a `.env` file in the root directory and add your Google Gemini API key:
```env
GEMINI_API_KEY=your_actual_api_key_here
```
> **Note:** Do not share your API key publicly. The `.env` file should remain excluded from version control.

### 4. Start the Application
Start the Node.js server:
```bash
node server.js
```

### 5. Access the Platform
Open your web browser and navigate to:
```
http://localhost:3000
```

## Features

- **File Upload:** Upload any image of a receipt or bill.
- **AI Extraction:** Uses Gemini 2.5 Flash to automatically extract the Merchant Name, Date, Total Amount, and list of specific line items.
- **Smart Categorization & Rewards:** Automatically normalizes the merchant type into predefined categories (e.g., *Supermarket / Grocery*, *Food & Beverage*) and applies dynamic reward rules to award points.
- **Persistent Storage:** Scanned bills and reward points are saved to a local SQLite database (`database.sqlite`), allowing data to persist across server reboots.
- **History Viewer:** Includes a full scan history table with text search and category filtering capabilities.
- **Premium UI:** Features a highly responsive, animated glassmorphism UI with a futuristic bright luxury aesthetic.
