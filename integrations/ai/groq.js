/**
 * Groq AI integration (OpenAI-compatible API).
 * Used by ranger suggested-actions feature.
 */

require('dotenv').config();
const axios = require('axios');

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.1-8b-instant';

if (!GROQ_API_KEY || GROQ_API_KEY.trim() === '') {
    console.warn('[Groq] GROQ_API_KEY not set. Ranger suggested actions will use fallback rules.');
} else {
    console.log('[Groq] API key found (starts with: ' + GROQ_API_KEY.substring(0, 7) + '...)');
}

/**
 * Send a chat completion request to Groq.
 * @param {Array<{ role: string, content: string }>} messages - Chat messages (e.g. [{ role: 'user', content: '...' }])
 * @param {object} options - Optional: max_tokens, temperature
 * @returns {Promise<string|null>} Response text or null on failure
 */
async function groqChat(messages, options = {}) {
    if (!GROQ_API_KEY || GROQ_API_KEY.trim() === '') {
        return null;
    }
    try {
        const res = await axios.post(
            GROQ_URL,
            {
                model: GROQ_MODEL,
                messages,
                max_tokens: options.max_tokens ?? 300,
                temperature: options.temperature ?? 0.3
            },
            {
                headers: {
                    Authorization: `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                timeout: 15000
            }
        );
        const text = res.data?.choices?.[0]?.message?.content?.trim();
        return text || null;
    } catch (err) {
        console.warn('[Groq] API error:', err.message);
        return null;
    }
}

module.exports = { groqChat };
