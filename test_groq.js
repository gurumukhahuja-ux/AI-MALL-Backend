
import dotenv from "dotenv";
dotenv.config();

async function testGroq() {
    try {
        const apiKey = process.env.GROQ_API_KEY;
        if (!apiKey) {
            console.error("No GROQ_API_KEY found.");
            return;
        }

        console.log("Testing Groq with Key:", apiKey.substring(0, 10) + "...");

        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                messages: [{ role: "user", content: "Hello Groq!" }],
                model: "llama-3.2-11b-vision-preview"
            })
        });

        if (!response.ok) {
            const err = await response.text();
            throw new Error(`Groq API Error: ${response.status} ${err}`);
        }

        const data = await response.json();
        console.log("✅ Groq Success:", data.choices[0].message.content);
    } catch (e) {
        console.error("❌ Groq Failed:", e.message);
    }
}

testGroq();
