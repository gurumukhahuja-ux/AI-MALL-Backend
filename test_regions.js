
import dotenv from "dotenv";
dotenv.config();

// Ensure creds are set
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS not set in .env");
    process.exit(1);
}

const PROJECT_ID = 'a-series-484205';

async function testRegions() {
    try {
        const { VertexAI } = await import('@google-cloud/vertexai');

        const regionsToTry = [
            'us-central1',
            'us-east4',
            'us-west1',
            'asia-south1', // Mumbai
            'asia-southeast1', // Singapore
            'europe-west1'
        ];

        const modelName = 'gemini-1.5-flash-001';

        console.log(`🌍 Testing Regions for Project: ${PROJECT_ID} (Model: ${modelName})...`);

        for (const location of regionsToTry) {
            console.log(`\n📍 Testing Region: ${location}`);
            try {
                const vertex_ai = new VertexAI({
                    project: PROJECT_ID,
                    location: location
                });

                const generativeModel = vertex_ai.getGenerativeModel({
                    model: modelName,
                    generationConfig: { maxOutputTokens: 10 }
                });

                const result = await generativeModel.generateContent("Hello");
                const response = result.response;

                if (response.candidates && response.candidates.length > 0) {
                    const text = response.candidates[0].content.parts[0].text;
                    console.log(`✅ SUCCESS! Region '${location}' is working!`);
                    console.log(`   Response: "${text}"`);
                    return; // Exit on first success
                } else {
                    console.log(`⚠️ Region '${location}' returned no candidates.`);
                }

            } catch (error) {
                // Log simplified error
                let msg = error.message;
                if (msg.includes('404')) msg = "404 Not Found (Model/Region unavailable)";
                if (msg.includes('403')) msg = "403 Permission Denied";
                console.log(`❌ Failed: ${msg}`);
            }
        }

        console.log("\n❌ All regions failed.");

    } catch (error) {
        console.error("❌ Fatal Error:", error);
    }
}

testRegions();
