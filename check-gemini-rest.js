
import fs from 'fs';

const apiKey = "AIzaSyAoU_T1M_mPrRl5rvkoJ_NbCw40EgwNnQU";

async function listModels() {
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        const data = await response.json();
        fs.writeFileSync('gemini-models.json', JSON.stringify(data, null, 2));
        console.log("Written to gemini-models.json");
    } catch (e) {
        console.error("Error fetching models:", e);
    }
}

listModels();
