const process = require('process');
require('dotenv').config();
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const crypto = require('crypto');

// Initialize Firebase Admin (uses local credentials if available, falling back to default)
// Connect explicitly to Local Emulators avoiding "demo-poc" permissions bugs
process.env.FIRESTORE_EMULATOR_HOST = '127.0.0.1:8080';
try {
    admin.initializeApp({ projectId: "demo-poc" });
} catch (e) {
    console.warn("Admin panel init warning: ", e.message);
}

const db = admin.firestore();
const app = express();

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });


// We simulate a logged-in user for this PoC.
const MOCK_USER_ID = "poc_user_001";

// --- Logic Helpers ---
function calculateRewards(totalAmount, category, isStreak = false, tier = "Standard") {
    let points = 0;
    let logicText = "";

    // Base: 1 pt per ₹100 spent
    const basePoints = Math.floor(totalAmount / 100);
    points += basePoints;
    logicText += `Base: ${basePoints} pts (₹100 = 1pt). `;

    // Dynamic Multiplier based on Category, Tier, Streak
    let multiplier = 1.0;
    if (category === 'Supermarket / Grocery') {
        multiplier += 0.2; // 1.2x
    } else if (category === 'Food & Beverage') {
        multiplier += 0.5; // 1.5x
    }

    if (tier === 'Premium') multiplier += 0.5;
    if (isStreak) {
        multiplier += 0.3;
        logicText += `Streak Bonus! `;
    }

    if (multiplier > 1.0) {
        points = Math.floor(points * multiplier);
        logicText += `Multiplier: ${multiplier.toFixed(1)}x applied. `;
    }

    if (points === 0 && totalAmount > 0) points = 1;
    return { points, logicText };
}

// Ensure the mock user exists
async function ensureUserExists() {
    const userRef = db.collection('Users').doc(MOCK_USER_ID);
    const doc = await userRef.get();
    if (!doc.exists) {
        await userRef.set({
            total_points: 0,
            tier: 'Standard',
            streak: true, // Mocking a streak for PoC 
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    return userRef;
}

// --- API Endpoints ---

// Get user info (points balance)
app.get('/api/user', async (req, res) => {
    try {
        const userRef = await ensureUserExists();
        const doc = await userRef.get();
        res.json({ totalPoints: doc.data().total_points || 0 });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// Get user receipt history
app.get('/api/history', async (req, res) => {
    try {
        const snapshot = await db.collection('Receipts')
            .where('user_id', '==', MOCK_USER_ID)
            .orderBy('created_at', 'desc')
            .get();

        const history = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Convert Firestore Timestamp to string for frontend
            if (data.created_at && data.created_at.toDate) {
                data.created_at = data.created_at.toDate().toISOString();
            }
            history.push({ id: doc.id, ...data });
        });
        res.json({ history });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// DSP Export Mock (Ethical Standards: Hashed Identifiers)
app.get('/api/dsp/export', async (req, res) => {
    try {
        // Mock exporting data to DSP securely using hashed identifiers
        const snapshot = await db.collection('Consent_Logs')
            .where('status', '==', 'granted')
            .get();

        const exportData = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            // Hash the user ID
            const hashedUserId = crypto.createHash('sha256').update(data.user_id).digest('hex');
            exportData.push({
                anonymous_id: hashedUserId,
                data_points: data.data_points,
                timestamp: data.timestamp
            });
        });

        res.json({ success: true, count: exportData.length, dsp_payload: exportData });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Process uploaded receipt
app.post('/api/upload', async (req, res) => {
    try {
        if (!req.body || !req.body.receipt) {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        console.log("Processing image with Gemini...");

        const filePart = {
            inlineData: {
                data: req.body.receipt,
                mimeType: req.body.mimeType || "image/jpeg"
            }
        };

        const prompt = `
        Analyze this receipt image and extract the following details into a strict JSON format. 
        If the image is blurry, unreadable, or not a receipt, return exactly: {"error": "unreadable"}.
        Otherwise return:
        {
            "rawMerchant": "string",
            "date": "string (YYYY-MM-DD)",
            "total": number,
            "category": "string ('Supermarket / Grocery', 'Food & Beverage', or 'General Retail')",
            "items": [
                { "name": "string", "price": number }
            ]
        }
        Do not use markdown strings, output exactly JSON.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { text: prompt },
                filePart
            ],
            config: {
                responseMimeType: "application/json",
            }
        });

        let textResponse = response.text || "";
        if (typeof textResponse === 'string') {
            textResponse = textResponse.trim();
            if (textResponse.startsWith('```json')) {
                textResponse = textResponse.replace(/^```json/, '').replace(/```$/, '').trim();
            } else if (textResponse.startsWith('```')) {
                textResponse = textResponse.replace(/^```/, '').replace(/```$/, '').trim();
            }
        }

        let receiptData;
        try {
            receiptData = JSON.parse(textResponse);
        } catch (parseError) {
            return res.status(500).json({ error: "Failed to parse receipt correctly. Raw: " + textResponse });
        }

        // 422 Unprocessable Entity - Blurry or unreadable scan
        if (receiptData.error === "unreadable") {
            return res.status(422).json({ error: "Scan Failed: Please ensure the receipt is clear." });
        }

        const total = parseFloat(receiptData.total) || 0;

        // 409 Conflict - Duplicate check (Merchant, Date, Total)
        const duplicateCheck = await db.collection('Receipts')
            .where('user_id', '==', MOCK_USER_ID)
            .where('merchant', '==', receiptData.rawMerchant)
            .where('date', '==', receiptData.date)
            .where('total', '==', total)
            .get();

        if (!duplicateCheck.empty) {
            return res.status(409).json({ error: "Duplicate receipt detected. This receipt has already been processed." });
        }

        // Fetch User Tier & Streak
        const userRef = await ensureUserExists();
        const userDoc = await userRef.get();
        const userData = userDoc.data();

        // Calculate Rewards with Dynamic Multiplier
        const rewardResult = calculateRewards(total, receiptData.category, userData.streak || false, userData.tier || "Standard");

        // Write to Firestore mapping Section 5.4 Database Schema

        // 1. Merchants Table (Upsert)
        const merchantRef = db.collection('Merchants').doc(receiptData.rawMerchant.replace(/[^a-zA-Z0-9]/g, '_'));
        await merchantRef.set({
            name: receiptData.rawMerchant,
            normalized_category: receiptData.category,
            last_seen: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. Receipts Table
        const newReceiptRef = db.collection('Receipts').doc();
        await newReceiptRef.set({
            user_id: MOCK_USER_ID,
            merchant: receiptData.rawMerchant,
            merchant_id: merchantRef.id,
            date: receiptData.date,
            total: total,
            category: receiptData.category,
            points_earned: rewardResult.points,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Receipt_Items Table
        if (receiptData.items && Array.isArray(receiptData.items)) {
            const batch = db.batch();
            receiptData.items.forEach(item => {
                const itemRef = db.collection('Receipt_Items').doc();
                batch.set(itemRef, {
                    receipt_id: newReceiptRef.id,
                    name: item.name,
                    price: item.price
                });
            });
            await batch.commit();
        }

        // 4. Update User Points
        await userRef.update({
            total_points: admin.firestore.FieldValue.increment(rewardResult.points)
        });

        // 5. Consent Logs (Simulated for this interaction)
        const consentRef = db.collection('Consent_Logs').doc();
        await consentRef.set({
            user_id: MOCK_USER_ID,
            action: "receipt_scan",
            status: "granted",
            data_points: ["merchant", "total", "category"],
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 6. Fraud Scores (Simulated evaluation)
        const fraudRef = db.collection('Fraud_Scores').doc();
        await fraudRef.set({
            receipt_id: newReceiptRef.id,
            user_id: MOCK_USER_ID,
            score: 0.05,
            risk_level: "Low",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
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
        if (error.status === 400 && error.message) {
            console.error('Gemini API Error Detail:', error.message, error.errorDetails);
        }
        res.status(500).json({ error: 'Internal server error processing the receipt.', details: error.message });
    }
});

// Export as Firebase Cloud Function
exports.api = onRequest({ cors: true, maxInstances: 5 }, app);
