require('dotenv').config();
const OpenAI = require('openai');

// ── Setup ──────────────────────────────────────────────────────────────────

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!process.env.OPENAI_API_KEY) {
    console.error('ERROR: OPENAI_API_KEY is missing from .env');
}

// Expert persona used in all prompts
const SYSTEM_PROMPT = `You are an expert wildlife conservation analyst with 20+ years of experience.
You specialise in forest fires, poaching, human-wildlife conflict, illegal logging, and animal rescue.
Always respond with valid JSON only — no extra text, no markdown code fences.`;

// ── Low-level helper ───────────────────────────────────────────────────────

async function askOpenAI(userMessage, maxTokens = 1000) {
    const response = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userMessage }
        ],
        temperature: 0.2,
        max_tokens: maxTokens
    });

    const text = response.choices[0].message.content;

    // Try to parse JSON; strip fences if needed
    try {
        return JSON.parse(text);
    } catch {
        return JSON.parse(text.replace(/```json|```/g, '').trim());
    }
}

// ── Function 1: Analyse a batch of recent incidents ────────────────────────

async function analyzeIncidentPatterns(incidents, stats = {}) {
    // Build a short readable summary of the incidents
    const incidentList = incidents.slice(0, 20).map(i =>
        `- [${i.priority}] ${i.category} | ${i.status} | ${new Date(i.createdAt).toLocaleDateString()} | "${i.title}"`
    ).join('\n');

    const categoryText = Object.entries(stats.categoryBreakdown || {})
        .map(([cat, count]) => `${cat}: ${count}`).join(', ');

    const prompt = `
Analyse the following wildlife incident data from the last 30 days and return a JSON prediction report.

SUMMARY:
- Total incidents: ${incidents.length}
- Daily average: ${stats.dailyAverage || 'N/A'}
- Categories: ${categoryText || 'N/A'}
- Status breakdown: ${JSON.stringify(stats.statusBreakdown || {})}
- Priority breakdown: ${JSON.stringify(stats.priorityBreakdown || {})}

RECENT INCIDENTS (up to 20):
${incidentList}

Return this exact JSON structure:
{
  "overallRiskLevel": "LOW | MEDIUM | HIGH | CRITICAL",
  "riskScore": <0–100>,
  "executiveSummary": "<2–3 sentence overview of the situation>",
  "forecast": {
    "next7DaysEstimate": <number>,
    "trend": "DECLINING | STABLE | INCREASING | ESCALATING",
    "trendExplanation": "<why this trend based on the data>",
    "confidenceLevel": "LOW | MEDIUM | HIGH"
  },
  "highRiskFactors": ["<factor 1>", "<factor 2>", "<factor 3>"],
  "immediateRecommendations": ["<action 1>", "<action 2>", "<action 3>"],
  "resourceAllocation": "<recommended deployment strategy>",
  "temporalPatterns": "<any notable time-based patterns in the data>"
}`;

    return await askOpenAI(prompt, 1000);
}

// ── Function 2: Deep analysis for a single incident ────────────────────────

async function analyzeIncidentDeep(incident, similarIncidents = [], avgResolutionHours = null) {
    const similarList = similarIncidents.slice(0, 10).map(i =>
        `- [${i.priority}] ${i.status} | ${new Date(i.createdAt).toLocaleDateString()} | "${i.title}"`
    ).join('\n');

    const resolvedCount = similarIncidents.filter(i =>
        ['RESOLVED', 'CLOSED'].includes(i.status)
    ).length;

    const prompt = `
Analyse this specific wildlife incident and return a deep prediction report as JSON.

INCIDENT DETAILS:
- Title: "${incident.title}"
- Category: ${incident.category}
- Priority: ${incident.priority}
- Urgency: ${incident.urgencyLevel || 'N/A'}
- Status: ${incident.status}
- Location: ${incident.location?.address || `Lat ${incident.location?.lat}, Lng ${incident.location?.lng}`}
- Reported: ${new Date(incident.createdAt).toLocaleDateString()}
- Description: ${incident.description || 'None'}
- Notes: ${incident.additionalNotes || 'None'}

HISTORICAL CONTEXT (similar ${incident.category} cases, last 90 days):
- Similar cases found: ${similarIncidents.length}
- Already resolved: ${resolvedCount}
- Avg resolution time: ${avgResolutionHours !== null ? avgResolutionHours + ' hours' : 'Not enough data'}

SIMILAR CASES:
${similarList || '- None found'}

Return this exact JSON structure:
{
  "analyticalSummary": "<3–4 sentence expert assessment of this incident>",
  "complexityScore": <1–10>,
  "complexityJustification": "<why this score for this category and situation>",
  "estimatedResolutionHours": ${avgResolutionHours ?? 'null'},
  "resolutionConfidence": "LOW | MEDIUM | HIGH",
  "riskEscalationChance": "<LOW | MEDIUM | HIGH>",
  "escalationTriggers": ["<trigger 1>", "<trigger 2>"],
  "recommendedPriority": "LOW | MEDIUM | HIGH | CRITICAL",
  "priorityReason": "<why this priority vs current: ${incident.priority}>",
  "immediateActions": ["<action 1>", "<action 2>", "<action 3>"],
  "specialistProtocol": "<specific expert protocol for ${incident.category}>",
  "resourcesNeeded": "<personnel and equipment required>",
  "historicalInsight": "<what do past similar cases tell us about likely outcome>"
}`;

    return await askOpenAI(prompt, 1200);
}

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = { analyzeIncidentPatterns, analyzeIncidentDeep };
