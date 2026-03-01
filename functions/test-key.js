require('dotenv').config();
const { GoogleGenAI } = require('@google/genai');

console.log("Using API Key from process.env:", process.env.GEMINI_API_KEY.substring(0, 15) + "...");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
async function run() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: ["Reply with Ok"]
        });
        console.log("Success:", response.text);
    } catch(e) {
        console.error("FAIL:", e.status, e.message);
    }
}
run();
