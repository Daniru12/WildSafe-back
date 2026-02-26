const { generateSuggestion, getEmbeddings } = require('../integrations/ai/cohere');
const Resource = require('../models/resourceStaff/Resource');
const Staff = require('../models/resourceStaff/Staff');

/**
 * Suggest staff for a specific resource based on expertise and availability.
 */
async function suggestStaffForResource(resourceId) {
    try {
        const resource = await Resource.findById(resourceId);
        if (!resource) throw new Error('Resource not found');

        const availableStaff = await Staff.find({ status: 'AVAILABLE' }).populate('userId', 'name');

        if (availableStaff.length === 0) return "No staff currently available for assignment.";

        const staffList = availableStaff.map(s =>
            `Staff ID: ${s._id}, Dept: ${s.department}, Permissions: ${s.permissions.join(', ')}`
        ).join('\n');

        const prompt = `Task: Suggest the top 2 staff members from the list below to handle a resource of type "${resource.type}".
Resource Description: ${resource.description || 'No description provided'}
Available Staff:
${staffList}

Prioritize matching staff permissions with the resource type. 
Format the response clearly as:
1. [Staff ID] - [Reasoning]
2. [Staff ID] - [Reasoning]`;

        return await generateSuggestion(prompt);
    } catch (err) {
        console.error('AI Staff Suggestion Error:', err);
        return "Could not generate staff suggestions at this time.";
    }
}

/**
 * Suggest user approval action with rationale.
 */
async function suggestUserAction(userKycStatus, assetDetails) {
    const prompt = `User KYC Status: ${userKycStatus}
Asset Details: ${assetDetails}

Act as an expert auditor. Suggest an approval action (Approve, Deny, or Request Further Info) with a professional rationale.`;

    return await generateSuggestion(prompt);
}

/**
 * Perform semantic search on resources using embeddings.
 * Note: This is an in-memory similarity check for demonstration. 
 * For large datasets, use a vector DB.
 */
async function matchResources(userQuery) {
    try {
        const resources = await Resource.find({ status: 'AVAILABLE' });
        if (resources.length === 0) return [];

        const queryEmbedding = (await getEmbeddings([userQuery]))[0];
        const resourceTexts = resources.map(r => `${r.type} ${r.description || ''}`);
        const resourceEmbeddings = await getEmbeddings(resourceTexts);

        // simple cosine similarity implementation or return top matches
        const matches = resources.map((r, idx) => ({
            resource: r,
            similarity: cosineSimilarity(queryEmbedding, resourceEmbeddings[idx])
        })).sort((a, b) => b.similarity - a.similarity);

        return matches.slice(0, 5).map(m => m.resource);
    } catch (err) {
        console.error('AI Semantic Search Error:', err);
        return [];
    }
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let mA = 0;
    let mB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        mA += vecA[i] * vecA[i];
        mB += vecB[i] * vecB[i];
    }
    mA = Math.sqrt(mA);
    mB = Math.sqrt(mB);
    return dotProduct / (mA * mB);
}

module.exports = { suggestStaffForResource, suggestUserAction, matchResources };
