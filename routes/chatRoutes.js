import mongoose from "mongoose";
import express from "express"
import ChatSession from "../models/ChatSession.js"
import { generativeModel } from "../config/gemini.js";
import userModel from "../models/User.js";
import { verifyToken } from "../middleware/authorization.js";
import { checkKillSwitch } from "../middleware/checkKillSwitch.js";





const router = express.Router();

// Apply Kill Switch to ALL chat routes (Inference)
// TEMPORARILY DISABLED - causing 503 errors
// router.use(checkKillSwitch);

// Get all chat sessions (summary)
router.post("/", async (req, res) => {
  const { content, history, systemInstruction, attachment } = req.body;

  try {
    // 1. Define Helper: Process Attachment
    // Moved to top to allow history processing
    const processAttachment = async (at) => {
      if (!at || !at.content || typeof at.content !== 'string') return null;
      try {
        const dataIndex = at.content.indexOf(';base64,');
        if (dataIndex === -1) return null;

        const mimePart = at.content.substring(0, dataIndex);
        const mimeType = mimePart.split(':').pop();
        const base64Data = at.content.substring(dataIndex + 8);
        const buffer = Buffer.from(base64Data, 'base64');

        console.log(`Processing attachment: ${at.name}, Type: ${mimeType}, Size: ${buffer.length} bytes`);

        // Extract text for PDFs and Documents
        if (mimeType.includes("pdf") || mimeType.includes("word") || mimeType.includes("document") || mimeType.includes("officedocument") || mimeType === "text/plain" || mimeType.includes("csv")) {
          let text = "";
          try {
            if (mimeType.includes("pdf")) {
              const pdfImport = await import('pdf-parse');
              const pdf = pdfImport.default || pdfImport;
              const pdfData = await pdf(buffer);
              text = pdfData.text;
              console.log(`✅ PDF extracted successfully: ${text.length} characters from "${at.name}"`);
            } else if (mimeType.includes("word") || mimeType.includes("document")) {
              const mammoth = await import('mammoth');
              const result = await mammoth.extractRawText({ buffer: buffer });
              text = result.value;
              console.log(`✅ Document extracted successfully: ${text.length} characters from "${at.name}"`);
            } else {
              text = buffer.toString('utf-8');
            }

            if (text && text.trim()) {
              return { text: `[DOCUMENT: "${at.name}"]\n\n${text.trim()}\n\n[END OF DOCUMENT]` };
            } else {
              console.warn(`⚠️ No text extracted from ${at.name}`);
            }
          } catch (err) {
            console.error(`❌ Text extraction failed for ${at.name}:`, err.message);
          }
        }

        // For images, send as inline data
        if (mimeType.startsWith('image/')) {
          console.log(`📷 Sending image: ${at.name}`);
          return { inlineData: { mimeType: mimeType, data: base64Data } };
        }

        return null;
      } catch (err) {
        console.error("Attachment processing error:", err);
        return null;
      }
    };


    // 2. Construct Prompt Parts
    let parts = [];

    // Add System Instruction
    if (systemInstruction) {
      parts.push({ text: `System Instruction: ${systemInstruction}` });
    }

    // 3. Process History (Text AND Attachments)
    if (history && Array.isArray(history)) {

      // OPTIMIZATION: Identify the most recent image(s) to scan.
      // sending too many base64 images crash the request (413 Payload Too Large)
      // We will keep only the LAST 2 images for context.
      const MAX_HIST_IMAGES = 2;
      const validImageIndices = new Set();
      let imgCount = 0;

      // Scan backwards to find recent images
      for (let i = history.length - 1; i >= 0; i--) {
        const m = history[i];
        if (m.attachment) {
          const atts = Array.isArray(m.attachment) ? m.attachment : [m.attachment];
          // Check if any attachment is an image
          const hasImage = atts.some(a => a.content && a.content.includes('image/'));
          if (hasImage) {
            if (imgCount < MAX_HIST_IMAGES) {
              validImageIndices.add(i);
              imgCount++;
            }
          }
        }
      }

      for (let i = 0; i < history.length; i++) {
        const msg = history[i];

        // Add Role Label + Text
        const roleLabel = msg.role === 'user' ? 'User' : 'Model';
        if (msg.content) {
          parts.push({ text: `${roleLabel}: ${msg.content}` });
        }

        // Add Historical Attachments (Visual Memory)
        // Only if it's one of the recent valid images
        if (msg.attachment && validImageIndices.has(i)) {
          const histAtts = Array.isArray(msg.attachment) ? msg.attachment : [msg.attachment];
          for (const at of histAtts) {
            // Only process if it has content (base64)
            if (at.content) {
              const part = await processAttachment(at);
              if (part) {
                // parts.push({ text: `[Visual Context from ${roleLabel}]` }); 
                parts.push(part);
              }
            }
          }
        }
      }
    }

    // 4. Process Current Attachments
    const documentNames = [];
    if (attachment) {
      const currAtts = Array.isArray(attachment) ? attachment : [attachment];
      for (const at of currAtts) {
        if (at.name) documentNames.push(at.name);
        const part = await processAttachment(at);
        if (part) parts.push(part);
      }
    }

    // 5. Add Current User Message Logic
    const hasAttachments = documentNames.length > 0;
    const hasMultipleDocs = documentNames.length > 1;

    let userQuestion = content || (hasAttachments ? "Please analyze the attached document(s)." : "");

    // Add special instructions for multiple documents
    if (hasMultipleDocs) {
      userQuestion = `${userQuestion}\n\n**IMPORTANT: You have ${documentNames.length} documents attached: ${documentNames.join(', ')}. 
Please provide SEPARATE answers for EACH document with clear section headers like:
📄 **Document: [filename]**
[Your analysis for this document]

Do this for EACH document so the user knows which answer belongs to which file.**`;
    }

    if (userQuestion.trim()) {
      parts.push({ text: `User Question: ${userQuestion}` });
    }

    console.log(`📤 Sending ${parts.length} parts to Gemini AI (${documentNames.length} new docs)`);

    // 6. Image Generation Check (HuggingFace)
    const imageGenPatterns = [
      /generate\s+(an?\s+)?image/i,
      /create\s+(an?\s+)?image/i,
      /make\s+(an?\s+)?image/i,
      /draw\s+(an?\s+)?(picture|image)/i,
      /give\s+(me\s+)?(an?\s+)?image/i,
      /show\s+(me\s+)?(an?\s+)?image/i,
      /image\s+of/i,
      /picture\s+of/i,
    ];

    const isImageRequest = imageGenPatterns.some(pattern => pattern.test(content || ''));

    if (isImageRequest && content) {
      console.log("🎨 Image generation request detected!");

      try {
        const { HfInference } = await import("@huggingface/inference");
        // Use API token if available (more reliable)
        const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
        const hf = new HfInference(hfToken);

        if (!hfToken) {
          console.log("⚠️ No HF_TOKEN found, using anonymous access (may be rate limited)");
        }

        // Extract the prompt (remove common prefixes)
        let imagePrompt = content
          .replace(/generate\s+(an?\s+)?image\s+(of\s+)?/i, '')
          .replace(/create\s+(an?\s+)?image\s+(of\s+)?/i, '')
          .replace(/make\s+(an?\s+)?image\s+(of\s+)?/i, '')
          .replace(/draw\s+(an?\s+)?(picture|image)\s+(of\s+)?/i, '')
          .replace(/give\s+(me\s+)?(an?\s+)?image\s+(of\s+)?/i, '')
          .replace(/show\s+(me\s+)?(an?\s+)?image\s+(of\s+)?/i, '')
          .trim();

        if (!imagePrompt) imagePrompt = content;

        console.log(`🎨 Generating image for: "${imagePrompt}"`);

        // Try multiple models in order of reliability
        const modelsToTry = [
          "CompVis/stable-diffusion-v1-4",
          "runwayml/stable-diffusion-v1-5",
          "stabilityai/stable-diffusion-2-1",
        ];

        let response = null;
        let lastError = null;

        for (const model of modelsToTry) {
          try {
            console.log(`🎨 Trying model: ${model}`);
            response = await hf.textToImage({
              model: model,
              inputs: imagePrompt,
              parameters: {
                negative_prompt: "blurry, bad quality, distorted, ugly, nsfw",
              }
            });
            if (response) {
              console.log(`✅ Success with model: ${model}`);
              break;
            }
          } catch (modelError) {
            console.log(`❌ Model ${model} failed: ${modelError.message}`);
            lastError = modelError;
            continue;
          }
        }

        if (!response) {
          throw lastError || new Error("All models failed");
        }

        // Convert to base64
        const arrayBuffer = await response.arrayBuffer();
        const base64 = Buffer.from(arrayBuffer).toString("base64");
        const imageUrl = `data:image/png;base64,${base64}`;

        console.log("✅ Image generated successfully!");

        return res.status(200).json({
          reply: `Here's the image I generated for "${imagePrompt}":\n\n![Generated Image](${imageUrl})`,
          imageUrl: imageUrl,
          isImage: true
        });

      } catch (imgError) {
        console.error("Image generation failed:", imgError.message);
        // Fall through to normal Gemini response with explanation
        return res.status(200).json({
          reply: `I tried to generate an image but the image generation service is currently busy or unavailable. Please try again in a few moments.\n\nError: ${imgError.message}`
        });
      }
    }


    // Validate API Key
    if (!process.env.GEMINI_API_KEY) {
      return res.status(200).json({
        reply: "[SYSTEM ERROR] GEMINI_API_KEY is not configured on the server. Please check your .env file."
      });
    }

    // Construct valid Content object
    const contentPayload = { role: "user", parts: parts };

    const streamingResult = await generativeModel.generateContentStream({ contents: [contentPayload] });

    const finalResponse = await streamingResult.response;
    const reply = finalResponse.text();

    return res.status(200).json({ reply });
  } catch (err) {
    console.warn(`⚠️ Gemini API failed: ${err.message}. Attempting fallback to HuggingFace...`);

    try {
      const { HfInference } = await import("@huggingface/inference");
      // Use token if available, otherwise anonymous (rate limited but functional)
      const hfToken = process.env.HF_TOKEN || process.env.HUGGINGFACE_TOKEN;
      const hf = new HfInference(hfToken);

      // Construct prompt for HF (Simplify context)
      // Find the user's actual question from parts or content
      let userMsg = content;
      if (!userMsg && parts.length > 0) {
        const lastPart = parts[parts.length - 1];
        if (lastPart.text) userMsg = lastPart.text.replace('User Question: ', '');
      }

      const prompt = `<|system|>\nYou are AISA, a helpful AI assistant for AI Mall.\n<|user|>\n${userMsg}\n<|assistant|>\n`;

      const hfRes = await hf.textGeneration({
        model: 'microsoft/Phi-3-mini-4k-instruct',
        inputs: prompt,
        parameters: {
          max_new_tokens: 512,
          return_full_text: false,
          temperature: 0.7
        }
      });

      console.log("✅ HuggingFace Fallback Response Generated");
      return res.status(200).json({ reply: hfRes.generated_text });

    } catch (hfErr) {
      console.error("❌ HF Fallback also failed:", hfErr.message);
      // Fall through to original error handling
    }

    const fs = await import('fs');
    try {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      const logData = `
Timestamp: ${new Date().toISOString()}
Error: ${err.message}
Code: ${err.code}
Env Project: ${process.env.GCP_PROJECT_ID}
Env Creds Path: '${credPath}'
Creds File Exists: ${credPath ? fs.existsSync(credPath) : 'N/A'}
Stack: ${err.stack}
-------------------------------------------
`;
      fs.appendFileSync('error.log', logData);
    } catch (e) { console.error("Log error:", e); }

    console.error("AISA backend error details:", {
      message: err.message,
      stack: err.stack,
      code: err.code,
      details: err.details || err.response?.data
    });
    return res.status(500).json({ error: "AI failed to respond", details: err.message });
  }
});
// Get all chat sessions (summary) for the authenticated user
router.get('/', verifyToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await userModel.findById(userId).populate({
      path: 'chatSessions',
      select: 'sessionId title lastModified',
      options: { sort: { lastModified: -1 } }
    });

    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user.chatSessions || []);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// Get chat history for a specific session
router.get('/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    // Optional: Verify that the session belongs to this user
    // For now, finding by sessionId is okay as sessionIds are unique/random
    let session = await ChatSession.findOne({ sessionId });

    if (!session) return res.status(404).json({ message: 'Session not found' });
    res.json(session);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Create or Update message in session
router.post('/:sessionId/message', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { message, title } = req.body;
    const userId = req.user.id


    if (!message?.role || !message?.content) {
      return res.status(400).json({ error: 'Invalid message format' });
    }

    const session = await ChatSession.findOneAndUpdate(
      { sessionId },
      {
        $push: { messages: message },
        $set: { lastModified: Date.now(), ...(title && { title }) }
      },
      { new: true, upsert: true }
    );

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ error: 'Invalid userId' });
    }

    await userModel.findByIdAndUpdate(
      userId,
      { $addToSet: { chatSessions: session._id } },
      { new: true }
    );
    res.json(session);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save message' });
  }
});


router.delete('/:sessionId', verifyToken, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user.id;

    const session = await ChatSession.findOneAndDelete({ sessionId });
    if (session) {
      await userModel.findByIdAndUpdate(userId, { $pull: { chatSessions: session._id } });
    }
    res.json({ message: 'History cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
