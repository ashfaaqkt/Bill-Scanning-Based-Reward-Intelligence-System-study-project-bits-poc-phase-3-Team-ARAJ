const { GoogleGenAI } = require('@google/genai');
require('dotenv').config();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { text: "What is this?" },
                {
                    inlineData: {
                        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVQYV2NgYAAAAAMAAWgmWQ0AAAAASUVORK5CYII=",
                        mimeType: "image/png"
                    }
                }
            ]
        });
        console.log(response.text);
    } catch (e) {
        console.error("Status:", e.status);
        console.error("Message:", e.message);
        console.error("Details:", e.errorDetails);
    }
}
run();
