const twilio = require('twilio');

let client = null;
if (process.env.TWILIO_SID && process.env.TWILIO_AUTH_TOKEN) {
    client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
}

async function sendSMS(to, message) {
    if (!client || !process.env.TWILIO_PHONE) {
        console.warn('[Twilio] Credentials not configured. SMS will not be sent.');
        return { status: 'skipped', message: 'Twilio credentials missing' };
    }
    try {
        const result = await client.messages.create({
            body: message,
            from: process.env.TWILIO_PHONE,
            to
        });
        console.log(`[Twilio] SMS sent to ${to}: ${result.sid}`);
        return { status: 'sent', sid: result.sid };
    } catch (err) {
        console.error(`[Twilio] Error sending SMS to ${to}:`, err.message);
        throw err;
    }
}

module.exports = { sendSMS };
