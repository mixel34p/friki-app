
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyAoU_T1M_mPrRl5rvkoJ_NbCw40EgwNnQU";
const genAI = new GoogleGenerativeAI(apiKey);

async function listModels() {
    try {
        // There isn't a direct listModels method in the client SDK easily accessible for simple key check without full implementation or using REST.
        // However, we can try to assume 'gemini-1.5-flash' works and if not print error.
        // Actually, let's just try to generate content with a few known models and see which one succeeds.

        const models = ["gemini-1.5-flash", "gemini-pro", "gemini-1.0-pro", "gemini-1.5-pro"];

        console.log("Testing models...");

        for (const modelName of models) {
            try {
                const model = genAI.getGenerativeModel({ model: modelName });
                const result = await model.generateContent("Hello");
                console.log(`✅ Model ${modelName} IS working!`);
                return; // Found one!
            } catch (e) {
                console.log(`❌ Model ${modelName} failed: ${e.message}`);
            }
        }

        console.log("All models failed.");
    } catch (error) {
        console.error("Error:", error);
    }
}

listModels();
