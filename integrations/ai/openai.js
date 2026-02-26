require('dotenv').config();
const OpenAI = require('openai');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!OPENAI_API_KEY) {
    console.error('CRITICAL ERROR: OPENAI_API_KEY is missing from environment variables!');
} else {
    console.log('OpenAI API Key found (starts with: ' + OPENAI_API_KEY.substring(0, 7) + '...)');
}

const openai = new OpenAI({
    apiKey: OPENAI_API_KEY
});

/**
 * Generate incident predictions using OpenAI
 * @param {string} prompt - The prompt for prediction
 * @param {object} options - Additional options
 */
async function generatePrediction(prompt, options = {}) {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-3.5-turbo',
            messages: [
                {
                    role: 'system',
                    content: 'You are a wildlife conservation and incident prediction expert. Analyze the provided data and give concise, actionable predictions.'
                },
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.3,
            max_tokens: 500,
            ...options
        });

        return response.choices[0].message.content;
    } catch (err) {
        console.error('OpenAI API Error:', err);
        throw new Error('Failed to generate prediction');
    }
}

/**
 * Analyze incident patterns and provide insights
 * @param {Array} incidents - Historical incident data
 */
async function analyzeIncidentPatterns(incidents) {
    try {
        const prompt = `Analyze these wildlife incident patterns and provide predictions:
        
Incident Data:
${incidents.map(i => `- ${i.category} on ${new Date(i.createdAt).toLocaleDateString()}: ${i.title}`).join('\n')}

Provide:
1. Next 7 days forecast (number of incidents expected)
2. High-risk incident types
3. Recommended precautions
4. Risk level (LOW/MEDIUM/HIGH/CRITICAL)

Format as JSON with keys: forecast, highRiskTypes, precautions, riskLevel`;

        const response = await generatePrediction(prompt);
        return response;
    } catch (err) {
        console.error('Pattern Analysis Error:', err);
        return null;
    }
}

module.exports = { generatePrediction, analyzeIncidentPatterns };
