const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY !== 'SG.your_actual_key_here') {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
}

async function sendEmail(to, subject, html) {
    try {
        if (!process.env.SENDGRID_API_KEY || process.env.SENDGRID_API_KEY === 'SG.your_actual_key_here') {
            console.warn('[SendGrid] SENDGRID_API_KEY is not configured. Email to ${to} would not be sent.');
            return { status: 'skipped', message: 'API Key missing' };
        }

        const msg = {
            to,
            from: 'noreply@wildsafe.com', // Replace with a verified sender email in real production
            subject,
            html
        };

        const result = await sgMail.send(msg);
        console.log(`[SendGrid] Email sent to ${to}: ${subject}`);
        return result;
    } catch (err) {
        console.error(`[SendGrid] Error sending email to ${to}:`, err.response ? err.response.body : err.message);
        throw err;
    }
}

module.exports = { sendEmail };
