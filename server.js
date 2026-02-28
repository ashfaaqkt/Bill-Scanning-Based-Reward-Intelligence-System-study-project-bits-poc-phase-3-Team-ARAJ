require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
// Serve static files from the current directory
app.use(express.static(__dirname));

// Initialize Gen AI SDK
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Setup Multer for in-memory uploads
const upload = multer({ storage: multer.memoryStorage() });

// --- Database Setup ---
const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    // Create Users table (for tracking global points)
    db.run(`CREATE TABLE IF NOT EXISTS Users (
        id INTEGER PRIMARY KEY,
        total_points INTEGER DEFAULT 0
    )`);

    // Create Receipts table
    db.run(`CREATE TABLE IF NOT EXISTS Receipts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        merchant TEXT,
        date TEXT,
        total REAL,
        category TEXT,
        points_earned INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES Users(id)
    )`);

    // Ensure we have at least one dummy user for this PoC
    db.get('SELECT id FROM Users WHERE id = 1', (err, row) => {
        if (!row) {
            db.run('INSERT INTO Users (id, total_points) VALUES (1, 0)');
        }
    });
});

// --- Logic Helpers ---
function calculateRewards(totalAmount, category) {
    let points = 0;
    let logicText = "";

    // Base logic: 1 point per ₹100 spent
    const basePoints = Math.floor(totalAmount / 100);
    points += basePoints;
    logicText += `Base: ${basePoints} pts (₹100 = 1pt). `;

    // Multiplier logic based on category
    if (category === 'Supermarket / Grocery') {
        points += 5; // Flat bonus for groceries
        logicText += `Bonus: +5 pts (Grocery Tier).`;
    } else if (category === 'Food & Beverage') {
        points = Math.floor(points * 1.5); // 1.5x multiplier
        logicText += `Multiplier: 1.5x (F&B Promotion).`;
    }

    if (points === 0 && totalAmount > 0) points = 1;
    return { points, logicText };
}

// --- API Endpoints ---

// Get user info (points balance)
app.get('/api/user', (req, res) => {
    db.get('SELECT total_points FROM Users WHERE id = 1', (err, row) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ totalPoints: row ? row.total_points : 0 });
    });
});

// Get user receipt history
app.get('/api/history', (req, res) => {
    db.all('SELECT * FROM Receipts WHERE user_id = 1 ORDER BY created_at DESC', (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ history: rows || [] });
    });
});

// Process uploaded receipt
app.post('/api/upload', upload.single('receipt'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        console.log("Processing image with Gemini...");

        // Prepare image for Gemini
        const filePart = {
            inlineData: {
                data: req.file.buffer.toString("base64"),
                mimeType: req.file.mimetype
            }
        };

        const prompt = `
        Analyze this receipt image and extract the following details into a strict JSON format. Do not use markdown wraps like \`\`\`json. Only output the actual JSON.
        Expected JSON Schema:
        {
            "rawMerchant": "string",
            "date": "string",
            "total": number,
            "category": "string (Categorize it roughly as 'Supermarket / Grocery', 'Food & Beverage', or 'General Retail')",
            "items": [
                { "name": "string", "price": number }
            ]
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [prompt, filePart],
            config: {
                responseMimeType: "application/json",
            }
        });

        let textResponse = response.text;
        if (typeof textResponse === 'string') {
            textResponse = textResponse.trim();
            if (textResponse.startsWith('```json')) {
                textResponse = textResponse.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (textResponse.startsWith('```')) {
                textResponse = textResponse.replace(/^```/, '').replace(/```$/, '').trim();
            }
        }

        console.log("Raw Gemini Output:", textResponse);

        let receiptData;
        try {
            receiptData = JSON.parse(textResponse);
        } catch (parseError) {
            console.error("JSON Parse Error:", parseError, textResponse);
            return res.status(500).json({ error: "Failed to parse receipt correctly. Raw: " + textResponse });
        }

        // Calculate Rewards
        const total = parseFloat(receiptData.total) || 0;
        const rewardResult = calculateRewards(total, receiptData.category);

        // Update DB
        db.serialize(() => {
            db.run(`INSERT INTO Receipts (user_id, merchant, date, total, category, points_earned) VALUES (?, ?, ?, ?, ?, ?)`,
                [1, receiptData.rawMerchant, receiptData.date, total, receiptData.category, rewardResult.points],
                function (err) {
                    if (err) console.error("Error inserting receipt:", err);
                }
            );
            db.run(`UPDATE Users SET total_points = total_points + ? WHERE id = 1`, [rewardResult.points]);
        });

        // Return structured data for the frontend
        res.json({
            success: true,
            data: {
                ...receiptData,
                rewardPoints: rewardResult.points,
                rewardLogic: rewardResult.logicText
            }
        });

    } catch (error) {
        console.error('Error processing upload:', error);
        res.status(500).json({ error: 'Internal server error processing the receipt.', details: error.message });
    }
});

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
    console.log(`Don't forget to add your GEMINI_API_KEY to the .env file!`);
});
