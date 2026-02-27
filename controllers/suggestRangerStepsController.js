/**
 * Suggested actions for ranger (field officer).
 * Uses Groq AI (integrations/ai/groq.js) when available; otherwise returns rule-based list by threat type.
 */

const { groqChat } = require('../integrations/ai/groq');

// Fallback: suggested steps by threat type when Groq is unavailable
const FALLBACK_STEPS = {
    POACHING: [
        'Take photos of the site and any equipment or traps',
        'Record GPS coordinates of the location',
        'Note vehicle or tool descriptions if present',
        'Document any animal remains or signs of poaching',
        'Identify and photograph any suspects if safe to do so'
    ],
    FOREST_FIRE: [
        'Assess fire size and direction of spread',
        'Record GPS and take photos of the fire perimeter',
        'Note wind direction and weather conditions',
        'Identify nearest water source and access routes',
        'Report to fire control and evacuate if needed'
    ],
    INJURED_ANIMAL: [
        'Assess the animal\'s condition from a safe distance',
        'Take photos for vet or wildlife expert review',
        'Record GPS location for rescue team',
        'Note species, visible injuries, and behavior',
        'Do not approach; wait for trained rescue if required'
    ],
    ILLEGAL_LOGGING: [
        'Photograph felled trees and equipment',
        'Record GPS of affected area',
        'Note vehicle or machinery descriptions',
        'Count and describe type of timber',
        'Document any persons or camps if safe'
    ],
    HUMAN_WILDLIFE_CONFLICT: [
        'Assess immediate risk to people and animal',
        'Take photos of damage or conflict site',
        'Record GPS and time of incident',
        'Note species and number of animals involved',
        'Document witness accounts if available'
    ],
    OTHER: [
        'Take photos of the scene',
        'Record GPS coordinates',
        'Document what you observe in notes',
        'Note time and any people or vehicles present',
        'Report findings to supervisor'
    ]
};

/**
 * Get suggested actions for a ranger for this threat type (and optional description).
 * Uses Groq (groq.js) if available; otherwise returns rule-based list.
 * @param {string} threatType - e.g. POACHING, FOREST_FIRE, INJURED_ANIMAL, ILLEGAL_LOGGING, HUMAN_WILDLIFE_CONFLICT, OTHER
 * @param {string} [description] - Optional case/report description for AI
 * @returns {Promise<string[]>} Array of suggested action strings
 */
async function getSuggestedRangerSteps(threatType, description = '') {
    const normalizedType = (threatType && String(threatType).toUpperCase().trim()) || 'OTHER';
    const fallbackList = FALLBACK_STEPS[normalizedType] || FALLBACK_STEPS.OTHER;

    const prompt = `You are helping a field ranger (wildlife/officer) respond to an incident.
Threat type: ${normalizedType}
${description ? `Incident description: ${description.slice(0, 500)}` : ''}

Give exactly 4 to 6 short, clear suggested actions for the ranger. One action per line. No numbering, no bullets, no extra text. Only the action lines.`;

    const aiText = await groqChat(
        [
            { role: 'system', content: 'You respond with only a list of short action items, one per line. No numbering or bullets.' },
            { role: 'user', content: prompt }
        ],
        { max_tokens: 300, temperature: 0.3 }
    );

    if (aiText) {
        const lines = aiText
            .split(/\n+/)
            .map((s) => s.replace(/^[\d\.\-\*•]\s*/, '').trim())
            .filter((s) => s.length > 0);
        if (lines.length > 0) {
            return lines.slice(0, 8);
        }
    }
    return fallbackList;
}

module.exports = { getSuggestedRangerSteps, FALLBACK_STEPS };
