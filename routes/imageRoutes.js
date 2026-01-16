import express from "express";
import { HfInference } from "@huggingface/inference";

const router = express.Router();

// Initialize Hugging Face client (works without API key for public models)
const hf = new HfInference();

// POST /api/image/generate
router.post("/generate", async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        console.log(`🎨 Generating image for: "${prompt}"`);

        // Use Stable Diffusion model (free, no API key required for public inference)
        const response = await hf.textToImage({
            model: "stabilityai/stable-diffusion-xl-base-1.0",
            inputs: prompt,
            parameters: {
                negative_prompt: "blurry, bad quality, distorted, ugly",
                width: 768,
                height: 768,
            }
        });

        // Convert response (Blob) to base64
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const imageUrl = `data:image/png;base64,${base64}`;

        console.log(`✅ Image generated successfully!`);

        res.json({
            success: true,
            imageUrl: imageUrl,
            prompt: prompt
        });

    } catch (error) {
        console.error("Image generation error:", error);

        // If Hugging Face is rate limited, suggest trying later
        if (error.message?.includes('rate') || error.message?.includes('limit')) {
            return res.status(429).json({
                error: "Image generation service is busy. Please try again in a few seconds.",
                retry: true
            });
        }

        res.status(500).json({
            error: "Failed to generate image. Please try again.",
            details: error.message
        });
    }
});

export default router;
