const axios = require('axios');

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

/**
 * Send a single WhatsApp text message via UltraMsg API.
 * @param {string} phone - International format e.g. "+94771234567"
 * @param {string} message - Text body (max 4096 chars)
 * @returns {Object|null} UltraMsg response or null on failure
 */
async function sendWhatsAppMessage(phone, message) {
    try {
        if (!INSTANCE_ID || !TOKEN) {
            console.warn('[WhatsApp] ULTRAMSG_INSTANCE_ID or ULTRAMSG_TOKEN not set in .env');
            return null;
        }

        const response = await axios.post(
            `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`,
            new URLSearchParams({
                token: TOKEN,
                to: phone,
                body: message,
                priority: 10       // 1–10: higher = sent first in queue
            }).toString(),
            {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            }
        );

        return response.data;
    } catch (error) {
        // Log but never crash the main alert flow
        console.error(`[WhatsApp] Failed to send to ${phone}:`, error.message);
        return null;
    }
}

/**
 * Send a formatted WhatsApp emergency alert to multiple users in parallel.
 * Users without a `phone` field are silently skipped.
 *
 * @param {Array}  users        - Array of User docs (must have `phone`, `name`)
 * @param {string} alertTitle   - Title of the alert
 * @param {string} alertMessage - Body message
 * @param {string} category     - 'EMERGENCY' | 'WARNING' | 'INFO' | 'ANNOUNCEMENT'
 * @returns {{ sent: number, failed: number, total: number }}
 */
async function sendBulkWhatsAppAlerts(users, alertTitle, alertMessage, category) {
    // Choose an appropriate emoji based on category
    const emojiMap = {
        EMERGENCY: '🚨',
        WARNING: '⚠️',
        INFO: 'ℹ️',
        ANNOUNCEMENT: '📢'
    };
    const emoji = emojiMap[category] || '🔔';

    const formattedMessage =
        `${emoji} *WildSafe Alert* ${emoji}\n\n` +
        `*${alertTitle}*\n\n` +
        `${alertMessage}\n\n` +
        `_This is an automated safety alert from WildSafe. Please follow official guidelines._`;

    // Only send to users who registered a phone number
    const usersWithPhone = users.filter(u => u.phone && u.phone.trim() !== '');

    if (usersWithPhone.length === 0) {
        console.log('[WhatsApp] No users with phone numbers found — skipping WhatsApp dispatch');
        return { sent: 0, failed: 0, total: 0 };
    }

    console.log(`[WhatsApp] Dispatching to ${usersWithPhone.length} / ${users.length} users`);

    // Fire all messages in parallel; allSettled ensures one failure won't block others
    const results = await Promise.allSettled(
        usersWithPhone.map(u => sendWhatsAppMessage(u.phone, formattedMessage))
    );

    // Build per-recipient status for API response visibility
    const recipients = usersWithPhone.map((u, i) => ({
        name: u.name || 'Unknown',
        phone: u.phone,
        status: (results[i].status === 'fulfilled' && results[i].value !== null) ? 'sent' : 'failed'
    }));

    const succeeded = recipients.filter(r => r.status === 'sent').length;
    const failed = recipients.length - succeeded;

    console.log(`[WhatsApp] ✅ ${succeeded} sent  ❌ ${failed} failed  (total: ${usersWithPhone.length})`);

    return { sent: succeeded, failed, total: usersWithPhone.length, recipients };
}

module.exports = { sendWhatsAppMessage, sendBulkWhatsAppAlerts };
