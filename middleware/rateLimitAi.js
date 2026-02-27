const rateLimit = require('express-rate-limit');

const aiRateLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 10, // Limit each IP to 10 requests per windowMs
    message: {
        message: "Too many AI requests from this IP, please try again after a minute.",
        error: "RATE_LIMIT_EXCEEDED"
    },
    standardHeaders: true,
    legacyHeaders: false,
});

module.exports = aiRateLimiter;
