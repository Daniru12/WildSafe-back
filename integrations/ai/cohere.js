require('dotenv').config();
const { CohereClient } = require('cohere-ai');

const COHERE_API_KEY = process.env.COHERE_API_KEY;
const COHERE_MODEL = process.env.COHERE_MODEL || 'command';
const COHERE_EMBED_MODEL = process.env.COHERE_EMBED_MODEL || 'embed-english-v3.0';

const cohere = new CohereClient({ token: COHERE_API_KEY });

if (!COHERE_API_KEY) {
    console.error('CRITICAL ERROR: COHERE_API_KEY is missing from environment variables!');
} else {
    console.log('Cohere API Key found (starts with: ' + COHERE_API_KEY.substring(0, 4) + '...)');
}

/**
 * Generate a suggestion based on a prompt.
 * @param {string} prompt - The prompt to send to Cohere.
 * @param {object} options - Additional Cohere generation options.
 */
async function generateSuggestion(prompt, options = {}) {
    const fallbackModels = ['command-xlarge-nightly', 'command-light', 'xlarge'];
    const modelsToTry = Array.from(new Set([COHERE_MODEL, ...fallbackModels].filter(Boolean)));

    let lastErr;
    for (const model of modelsToTry) {
        try {
            const response = await cohere.chat({
                model,
                message: prompt,
                temperature: 0.3,
                ...options
            });
            const text = response && (response.text || (response.message && response.message.content)) ? (response.text || response.message.content) : '';
            if (text) return text;
        } catch (err) {
            lastErr = err;
            const bodyMsg = err && err.body && err.body.message ? err.body.message : '';
            console.warn(`Cohere model "${model}" failed: ${bodyMsg || err.message}`);
            // If the error indicates the model was removed, try the next fallback.
            continue;
        }
    }

    console.error('Cohere Chat Detailed Error:', lastErr && lastErr.message ? lastErr.message : lastErr);
    if (lastErr && lastErr.body) console.error('Cohere body:', lastErr.body);
    throw lastErr || new Error('AI suggestion failed');
}

/**
 * Get embeddings for a list of texts.
 * @param {string[]} texts - Array of strings to embed.
 */
async function getEmbeddings(texts) {
    try {
        const response = await cohere.embed({
            texts,
            model: COHERE_EMBED_MODEL,
            inputType: 'search_document'
        });
        return response.embeddings;
    } catch (err) {
        console.error('Cohere Embedding Error:', err);
        throw new Error('Failed to get embeddings');
    }
}

module.exports = { generateSuggestion, getEmbeddings };
