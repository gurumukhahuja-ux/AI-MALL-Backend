
import dotenv from "dotenv";
dotenv.config();

// Ensure creds are set
if (!process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.error("❌ GOOGLE_APPLICATION_CREDENTIALS not set in .env");
    process.exit(1);
}

// console.log("🔑 Using Credentials:", process.env.GOOGLE_APPLICATION_CREDENTIALS);

async function testVertex() {
    try {
        const { VertexAI } = await import('@google-cloud/vertexai');

        const vertex_ai = new VertexAI({
            project: 'a-series-484205',
            location: 'us-central1'
        });

        const modelsToTry = [
            'gemini-1.5-flash-001',
            'gemini-1.5-flash',
            'gemini-1.0-pro-001',
            'gemini-pro',
            'text-bison@001',
            'text-bison'
        ];

        console.log("📡 Testing Models on Vertex AI (us-central1)...");

        for (const modelName of modelsToTry) {
            console.log(`\n🔍 Testing Model: ${modelName}`);
            try {
                const generativeModel = vertex_ai.getGenerativeModel({
                    model: modelName,
                    generationConfig: { maxOutputTokens: 10 }
                });

                const result = await generativeModel.generateContent("Hello");
                const response = result.response;
                // console.log("Raw Response:", JSON.stringify(response));

                if (response.candidates && response.candidates.length > 0) {
                    const text = response.candidates[0].content.parts[0].text;
                    console.log(`✅ SUCCESS! Model '${modelName}' is working.`);
                    console.log(`   Response: "${text}"`);
                    return; // Exit on first success
                } else {
                    console.log(`⚠️ Model '${modelName}' returned no candidates.`);
                }

            } catch (error) {
                console.log(`❌ Failed: ${error.message.split('error":')[1] || error.message}`);
                // if (error.message.includes("403")) console.log("   (Permission Issue)");
                // if (error.message.includes("404")) console.log("   (Not Found / Not Available)");
            }
        }

        console.log("\n❌ All models failed.");

    } catch (error) {
        console.error("❌ Fatal Error:", error);
    }
}

testVertex();
