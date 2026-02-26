const { sendSMS } = require('../integrations/notifications/twilio');
const { sendEmail } = require('../integrations/notifications/sendgrid');
const { sendPush } = require('../integrations/notifications/firebase');

/**
 * Orchestrates multi-channel notifications
 * @param {Object} user - The user object containing phone, email, and fcmToken
 * @param {string} type - The machine name for the notification type
 * @param {Object} data - Data for the templates (title, message, etc.)
 */
async function sendNotification(user, type, data) {
    const templates = {
        sms: `[WildSafe] ${data.title}: ${data.message}`,
        email: {
            subject: data.title,
            html: `
        <div style="font-family: sans-serif; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h1 style="color: #2D3748;">${data.title}</h1>
          <p style="color: #4A5568; line-height: 1.6;">${data.message}</p>
          <hr style="border: none; border-top: 1px solid #edf2f7; margin: 20px 0;" />
          <p style="font-size: 12px; color: #718096;">Sent from WildSafe RWA Platform</p>
        </div>
      `
        },
        push: {
            title: data.title,
            body: data.message
        }
    };

    const results = {
        sms: null,
        email: null,
        push: null
    };

    try {
        // Send SMS
        if (user.phone) {
            try {
                results.sms = await sendSMS(user.phone, templates.sms);
            } catch (err) {
                console.error('NotificationService SMS failure:', err.message);
                results.sms = { status: 'error', message: err.message };
            }
        } else {
            results.sms = { status: 'skipped', message: 'No phone number provided' };
        }

        // Send Email
        if (user.email) {
            try {
                results.email = await sendEmail(user.email, templates.email.subject, templates.email.html);
            } catch (err) {
                console.error('NotificationService Email failure:', err.message);
                results.email = { status: 'error', message: err.message };
            }
        } else {
            results.email = { status: 'skipped', message: 'No email address provided' };
        }

        // Send Push
        if (user.fcmToken) {
            try {
                results.push = await sendPush(user.fcmToken, templates.push.title, templates.push.body);
            } catch (err) {
                console.error('NotificationService Push failure:', err.message);
                results.push = { status: 'error', message: err.message };
            }
        } else {
            results.push = { status: 'skipped', message: 'No FCM token provided' };
        }

        return results;
    } catch (err) {
        console.error('NotificationService Orchestration Error:', err);
        throw err;
    }
}

module.exports = { sendNotification };
