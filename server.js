require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { GoogleGenAI } = require('@google/genai');
const admin = require('firebase-admin');
const crypto = require('crypto');

// 1. Authenticate to the Live Firebase Console using the Service Account logic
try {
    const serviceAccount = require('./serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Authenticated securely with Live Firebase Firestore!");
} catch (error) {
    console.error("❌ Failed to authenticate with Firebase. Ensure serviceAccountKey.json exists in root.");
}

const db = admin.firestore();
const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_bits_pilani_123';

// Auth Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Access denied.' });

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid token. Please log in again.' });
        req.userId = user.userId;
        next();
    });
}

// Logic Helper - Validates Reward Engine (FR Requirement)
function calculateRewards(totalAmount, category, isStreak = false, tier = "Standard") {
    let points = 0;
    let logicText = "";

    const basePoints = Math.floor(totalAmount / 100);
    points += basePoints;
    logicText += `Base: ${basePoints} pts (₹100 = 1pt). `;

    let multiplier = 1.0;
    if (category === 'Supermarket / Grocery') multiplier += 0.2;
    else if (category === 'Food & Beverage') multiplier += 0.5;

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

// Ensure user node exists physically in Firestore
async function ensureUserExists(userId) {
    if (!userId) throw new Error("userId missing in ensureUserExists");
    const userRef = db.collection('Users').doc(userId);
    const doc = await userRef.get();
    if (!doc.exists) {
        await userRef.set({
            total_points: 0,
            tier: 'Standard',
            streak: true,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });
    }
    return userRef;
}

// --- APIs ---

app.post('/api/signup', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

        const usersSnapshot = await db.collection('Users').where('email', '==', email).limit(1).get();
        if (!usersSnapshot.empty) return res.status(409).json({ error: 'Email already exists.' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const newUserRef = db.collection('Users').doc();

        await newUserRef.set({
            email,
            password: hashedPassword,
            name: name || 'User',
            total_points: 0,
            tier: 'Standard',
            streak: false,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        const token = jwt.sign({ userId: newUserRef.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, name: name || 'User' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const usersSnapshot = await db.collection('Users').where('email', '==', email).limit(1).get();

        if (usersSnapshot.empty) return res.status(401).json({ error: 'Invalid email or password.' });

        const userDoc = usersSnapshot.docs[0];
        const userData = userDoc.data();

        const match = await bcrypt.compare(password, userData.password);
        if (!match) return res.status(401).json({ error: 'Invalid email or password.' });

        const token = jwt.sign({ userId: userDoc.id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token, name: userData.name });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/user', authenticateToken, async (req, res) => {
    try {
        const userRef = await ensureUserExists(req.userId);
        const doc = await userRef.get();
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.json({ totalPoints: doc.data().total_points || 0, name: doc.data().name || 'User' });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/history', authenticateToken, async (req, res) => {
    try {
        const snapshot = await db.collection('Receipts')
            .where('user_id', '==', req.userId)
            .get();

        const history = [];
        snapshot.forEach(doc => {
            const data = doc.data();
            if (data.created_at && data.created_at.toDate) {
                data.created_at = data.created_at.toDate().toISOString();
            }
            history.push({ id: doc.id, ...data });
        });

        // Sort manually to bypass forced composite index requirement in Firestore
        history.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        // Cache control
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.json({ history });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.post('/api/upload', authenticateToken, async (req, res) => {
    try {
        if (!req.body || !req.body.receipt) {
            return res.status(400).json({ error: 'No image data provided.' });
        }

        console.log("Processing image with Gemini...");
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { text: `Analyze this receipt image and extract the following details into a strict JSON format. If blurry/unreadable return exactly: {"error": "unreadable"}. Otherwise return: {"rawMerchant": "string", "date": "string (YYYY-MM-DD)", "total": number, "category": "string ('Supermarket / Grocery', 'Food & Beverage', or 'General Retail')", "items": [{ "name": "string", "price": number }]}` },
                { inlineData: { data: req.body.receipt, mimeType: req.body.mimeType || "image/jpeg" } }
            ],
            config: { responseMimeType: "application/json" }
        });

        let textResponse = response.text || "";
        textResponse = textResponse.replace(/^```json/, '').replace(/```$/, '').trim();

        let receiptData;
        try {
            receiptData = JSON.parse(textResponse);
        } catch (e) { return res.status(500).json({ error: "Parse failure." }); }

        // FR Compliance: 422 Unprocessable Entity
        if (receiptData.error === "unreadable") {
            return res.status(422).json({ error: "Scan Failed: Please ensure the receipt is clear." });
        }

        const total = parseFloat(receiptData.total) || 0;

        // FR Compliance: 409 Conflict checks against real Firestore Database
        const duplicateCheck = await db.collection('Receipts')
            .where('user_id', '==', req.userId)
            .where('merchant', '==', receiptData.rawMerchant)
            .where('date', '==', receiptData.date)
            .where('total', '==', total)
            .get();

        if (!duplicateCheck.empty) {
            return res.status(409).json({ error: "Duplicate receipt detected. This receipt has already been processed." });
        }

        // Processing Tier / Multipiler
        const userRef = await ensureUserExists(req.userId);
        const userDoc = await userRef.get();
        const userData = userDoc.data();
        const rewardResult = calculateRewards(total, receiptData.category, userData.streak || false, userData.tier || "Standard");

        // ---- Phase 2 Schema Database Synchronization ----

        let merchantId = receiptData.rawMerchant.replace(/[^a-zA-Z0-9]/g, '_');
        if (!merchantId) merchantId = "Unknown";

        // 1. Merchants Upsert
        const merchantRef = db.collection('Merchants').doc(merchantId);
        await merchantRef.set({
            name: receiptData.rawMerchant,
            normalized_category: receiptData.category,
            last_seen: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        // 2. Receipts
        const newReceiptRef = db.collection('Receipts').doc();
        await newReceiptRef.set({
            user_id: req.userId,
            merchant: receiptData.rawMerchant,
            merchant_id: merchantRef.id,
            date: receiptData.date,
            total: total,
            category: receiptData.category,
            points_earned: rewardResult.points,
            created_at: admin.firestore.FieldValue.serverTimestamp()
        });

        // 3. Receipt Items Batching
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

        // 4. Update overall point sum safely
        await userRef.update({
            total_points: admin.firestore.FieldValue.increment(rewardResult.points)
        });

        // 5. Consent Logs (Section 5.4 Privacy Rules)
        const consentRef = db.collection('Consent_Logs').doc();
        await consentRef.set({
            user_id: req.userId,
            action: "receipt_scan",
            status: "granted",
            data_points: ["merchant", "total", "category"],
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

        // 6. Fraud System Simulation Log
        const fraudRef = db.collection('Fraud_Scores').doc();
        await fraudRef.set({
            receipt_id: newReceiptRef.id,
            user_id: req.userId,
            score: 0.05,
            risk_level: "Low",
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        });

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
        res.status(500).json({ error: 'Internal server error processing the receipt.' });
    }
});

app.listen(port, () => console.log(`🚀 Server running dynamically on http://localhost:${port}`));
