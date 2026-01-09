
import { GoogleGenerativeAI } from "@google/generative-ai";
import fs from 'fs';
import path from 'path';

async function listModels() {
    try {
        const envPath = path.resolve(process.cwd(), '.env');
        const envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf-8') : '';

        // Simple manual parsing to find the key, allowing for spaces around =
        const match = envContent.match(/VITE_GEMINI_API_KEY\s*=\s*(.*)/);
        const apiKey = match ? match[1].trim() : null;

        if (!apiKey) {
            console.error("❌ Could not find VITE_GEMINI_API_KEY in .env");
            return;
        }

        console.log("🔑 Using API Key: " + apiKey.substring(0, 4) + "...");

        const genAI = new GoogleGenerativeAI(apiKey);
        // Access the model manager (not directly exposed in all SDK versions, but let's try via the generic client if possible, 
        // actually the SDK doesn't expose listModels on the main class easily in all versions. 
        // We might need to fetch manually if SDK doesn't support it easily, but let's try the direct HTTP call for certainty.)

        console.log("🔄 Fetching available models via HTTP REST API...");

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            console.error(`❌ API Request Failed: ${response.status} ${response.statusText}`);
            const errText = await response.text();
            console.error("Error details:", errText);
            return;
        }

        const data = await response.json();

        if (!data.models) {
            console.log("⚠️ No models returned in the response.");
        } else {
            console.log("✅ Available Models:");
            data.models.forEach(m => {
                if (m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent')) {
                    console.log(` - ${m.name} (Display: ${m.displayName})`);
                }
            });
        }

    } catch (error) {
        console.error("❌ Unexpected Error:", error.message);
    }
}

listModels();
