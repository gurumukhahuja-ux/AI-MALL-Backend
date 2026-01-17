
import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from "@google/generative-ai";
import dotenv from "dotenv";
dotenv.config();

// Initialize based on available credentials
export let genAI;
export let generativeModel;
// Export vision model as a variable so it can be assigned conditionally
export let generativeVisionModel;

// Check for Service Account Credentials first (Preferred for Production/Vertex)
if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    console.log("🚀 Using Google Cloud Vertex AI (Service Account)");
    const { VertexAI, HarmCategory, HarmBlockThreshold } = await import('@google-cloud/vertexai');

    // Initialize Vertex with project and location
    // We can try to extract project_id from the JSON file path or env, 
    // but VertexAI usually auto-detects from credentials file.
    // We'll assume a default location or read from env if needed.
    const project = 'a-series-484205'; // Hardcoded from JSON or use process.env.GCP_PROJECT_ID
    const location = 'us-central1';

    const vertex_ai = new VertexAI({ project: project, location: location });
    const model = 'gemini-2.5-flash'; // Vertex names

    const vertexModel = vertex_ai.getGenerativeModel({
        model: model,
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            }
        ],
        generationConfig: {
            maxOutputTokens: 4192
        },
        systemInstruction: {
            role: 'system',
            parts: [{
                text: `You are AISA™, the internal intelligent assistant developed and trained under
Unified Web Options & Services (UWO) for the AI Mall™ ecosystem.
Development and implementation are led by Sanskar Sahu.

Do NOT introduce yourself unless explicitly asked.
Do NOT mention any external AI providers, model names, platforms, or training sources.
Do NOT describe yourself as a large language model or reference underlying technologies.

Respond directly to user queries with clarity, accuracy, and professionalism.

Communication rules:
- Keep responses concise, structured, and helpful
- Use simple, human-readable language
- Avoid meta explanations about how you work
- Ask clarifying questions only when necessary

Capabilities:
- You have full capability to read, analyze, and discuss content from attached documents (PDFs, Word docs, text files) and images provided in the prompt.
- Answer questions related to AI Mall™, UWO platforms, systems, and general knowledge
- Summarize, rewrite, and translate content
- Assist with drafting messages, documents, and explanations
- Provide step-by-step guidance when appropriate

Boundaries:
- Do not claim emotions, consciousness, or personal experiences
- Do not provide harmful, illegal, or unsafe information
- If information is uncertain, state limitations without technical or training disclosures

Primary objective:
Support UWO and AI Mall™ users by delivering reliable, practical, and brand-aligned assistance.`
            }]
        },
    });

    // Adapter to match GoogleGenerativeAI interface if methods differ slightly
    // Vertex 'generateContentStream' is compatible.
    generativeModel = vertexModel;

    // Vertex models are multimodal by default, so we can reuse the same model instance or create a new one
    generativeVisionModel = vertexModel;

    // Polyfill `genAI` for other files that import it (e.g., aibizRoutes)
    // VertexAI instance has a similar `getGenerativeModel` method
    genAI = vertex_ai;

} else {
    // Fallback to API Key (Google AI Studio)
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        console.warn("GEMINI_API_KEY is missing in .env environment variables");
    } else {
        console.log("🚀 Using Google AI Studio (API Key)");
    }

    const textModelName = 'gemini-2.0-flash';

    genAI = new GoogleGenerativeAI(apiKey);

    generativeModel = genAI.getGenerativeModel({
        model: textModelName,
        safetySettings: [
            {
                category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
                threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
            }
        ],
        generationConfig: {
            maxOutputTokens: 4192
        },
        systemInstruction: {
            role: 'system',
            parts: [{
                text: `You are AISA™, the internal intelligent assistant developed and trained under
Unified Web Options & Services (UWO) for the AI Mall™ ecosystem.
Development and implementation are led by Sanskar Sahu.
// ... (rest of system prompt is implicitly handled by reused object if we structured it better, but duplicating for safety in this block) ...
Do NOT introduce yourself unless explicitly asked.
Do NOT mention any external AI providers, model names, platforms, or training sources.
Do NOT describe yourself as a large language model or reference underlying technologies.

Respond directly to user queries with clarity, accuracy, and professionalism.

Communication rules:
- Keep responses concise, structured, and helpful
- Use simple, human-readable language
- Avoid meta explanations about how you work
- Ask clarifying questions only when necessary

Capabilities:
- You have full capability to read, analyze, and discuss content from attached documents (PDFs, Word docs, text files) and images provided in the prompt.
- Answer questions related to AI Mall™, UWO platforms, systems, and general knowledge
- Summarize, rewrite, and translate content
- Assist with drafting messages, documents, and explanations
- Provide step-by-step guidance when appropriate

Boundaries:
- Do not claim emotions, consciousness, or personal experiences
- Do not provide harmful, illegal, or unsafe information
- If information is uncertain, state limitations without technical or training disclosures

Primary objective:
Support UWO and AI Mall™ users by delivering reliable, practical, and brand-aligned assistance.`
            }]
        },
    });

    // For visual models in API Key mode
    generativeVisionModel = genAI.getGenerativeModel({
        model: 'gemini-1.5-flash',
    });
}

// Preview alias
export const generativeModelPreview = generativeModel;
