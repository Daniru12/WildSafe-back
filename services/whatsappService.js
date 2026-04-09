const axios = require('axios');

const INSTANCE_ID = process.env.ULTRAMSG_INSTANCE_ID;
const TOKEN = process.env.ULTRAMSG_TOKEN;

function normalizePhoneForUltraMsg(rawPhone) {
    if (!rawPhone || typeof rawPhone !== 'string') return null;

    // Keep digits only. UltraMsg commonly expects numeric international format.
    const digits = rawPhone.replace(/\D/g, '');

    // Basic sanity check for international numbers.
    if (digits.length < 10 || digits.length > 15) {
        return null;
    }

    return digits;
}

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

        const normalizedPhone = normalizePhoneForUltraMsg(phone);
        if (!normalizedPhone) {
            console.warn(`[WhatsApp] Invalid phone format for recipient: ${phone}`);
            return null;
        }

        const response = await axios.post(
            `https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`,
            new URLSearchParams({
                token: TOKEN,
                to: normalizedPhone,
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

    // Normalize and validate phone numbers before attempting to send.
    const recipientsPrepared = users.map((u) => {
        const normalized = normalizePhoneForUltraMsg(u.phone || '');
        return {
            user: u,
            normalizedPhone: normalized,
            valid: !!normalized
        };
    });

    const usersWithPhone = recipientsPrepared.filter((r) => r.valid);
    const invalidRecipients = recipientsPrepared
        .filter((r) => !r.valid)
        .map((r) => ({
            name: r.user.name || 'Unknown',
            phone: r.user.phone || '',
            status: 'failed',
            reason: 'invalid_phone_format'
        }));

    if (usersWithPhone.length === 0) {
        console.log('[WhatsApp] No users with phone numbers found — skipping WhatsApp dispatch');
        return {
            sent: 0,
            failed: invalidRecipients.length,
            total: invalidRecipients.length,
            recipients: invalidRecipients
        };
    }

    console.log(`[WhatsApp] Dispatching to ${usersWithPhone.length} / ${users.length} users`);

    // Fire all messages in parallel; allSettled ensures one failure won't block others
    const results = await Promise.allSettled(
        usersWithPhone.map(r => sendWhatsAppMessage(r.normalizedPhone, formattedMessage))
    );

    // Build per-recipient status for API response visibility
    const recipients = usersWithPhone.map((r, i) => ({
        name: r.user.name || 'Unknown',
        phone: r.normalizedPhone,
        status: (results[i].status === 'fulfilled' && results[i].value !== null) ? 'sent' : 'failed',
        reason: (results[i].status === 'fulfilled' && results[i].value !== null) ? 'sent' : 'ultramsg_send_failed'
    }));

    const allRecipients = [...recipients, ...invalidRecipients];

    const succeeded = allRecipients.filter(r => r.status === 'sent').length;
    const failed = allRecipients.length - succeeded;

    console.log(`[WhatsApp] ✅ ${succeeded} sent  ❌ ${failed} failed  (total: ${allRecipients.length})`);

    return { sent: succeeded, failed, total: allRecipients.length, recipients: allRecipients };
}

module.exports = { sendWhatsAppMessage, sendBulkWhatsAppAlerts };
