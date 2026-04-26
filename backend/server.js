const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error('❌ ERROR: GEMINI_API_KEY not found in .env file');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// USE A MODEL FROM YOUR LIST - Pick one:
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
// Other options: "gemini-2.5-pro", "gemini-2.0-flash", "gemini-flash-latest"

console.log('✅ SafeScan Backend Started');
console.log('📡 Server running on http://localhost:3000');

app.get('/', (req, res) => {
    res.json({ status: 'ok', message: 'SafeScan Backend running!' });
});

app.post('/analyze', async (req, res) => {
    try {
        const { comment, videoContext } = req.body;
        
        if (!comment || comment.trim() === '') {
            return res.status(400).json({ error: 'Comment is required' });
        }
        
        console.log(`📝 Analyzing: "${comment.substring(0, 50)}..."`);
        
        // Build prompt for Gemini
        let prompt = `You are SafeScan, a comment moderator for YouTube.

Analyze this comment and return ONLY valid JSON. No other text or explanation.

RULES:
- RED: Hate speech, threats, slurs, harassment, spam, self-promotion, personal insults (words like "trash", "stupid", "idiot", "kill", "die")
- YELLOW: Criticism, negative feedback, sarcasm, mild complaints (words like "bad", "not good", "could be better", "horrible", "disappointed")
- GREEN: Praise, questions, neutral comments, constructive feedback

Comment: "${comment}"
`;

        if (videoContext && videoContext.trim() !== '') {
            prompt += `\nVideo context: "${videoContext}"`;
        }

        prompt += `\n\nRespond with ONLY this JSON format: {"flag":"RED","reason":"short reason here"}`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();
        
        console.log(`📨 Gemini response: ${responseText.substring(0, 100)}`);
        
        // Parse JSON from response
        let analysis;
        const jsonMatch = responseText.match(/\{.*\}/s);
        if (jsonMatch) {
            try {
                analysis = JSON.parse(jsonMatch[0]);
            } catch (e) {
                analysis = { flag: "YELLOW", reason: "Could not parse" };
            }
        } else {
            analysis = { flag: "YELLOW", reason: "Could not analyze" };
        }
        
        // Validate flag is correct
        if (!['RED', 'YELLOW', 'GREEN'].includes(analysis.flag)) {
            analysis.flag = "YELLOW";
        }
        
        console.log(`🏁 Result: ${analysis.flag} - ${analysis.reason}`);
        res.json(analysis);
        
    } catch (error) {
        console.error('❌ API Error:', error.message);
        res.status(500).json({ 
            flag: "YELLOW", 
            reason: "API error - showing for review"
        });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 SafeScan backend live at http://localhost:${PORT}`);
});