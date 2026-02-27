# WildSafe Backend - Wildlife Conservation & Monitoring

WildSafe is a comprehensive backend platform designed for wildlife conservation management, incident reporting, and real-time monitoring. It leverages AI-driven insights, multi-channel notifications, and robust resource management to empower rangers and conservationists.

## 🚀 Features

- **Incident & Case Management**: track and manage wildlife incidents and threat reports.
- **AI Insights**: integration with advanced AI models for staff suggestions and data analysis.
- **Multi-Channel Notifications**: real-time alerts via SMS, Email, and Push Notifications.
- **Resource & Staff Management**: manage ranger assignments and conservation resources.
- **Analytics & Reporting**: detailed dashboards and report generation.
- **Media Support**: scalable image and file storage.

## � How it Works

The WildSafe platform operates on an AI-driven lifecycle to ensure rapid response to wildlife incidents:

1.  **Reporting**: Citizens or Field Staff report incidents (e.g., Poaching, Forest Fires, Animal Conflicts) with photos and GPS locations.
2.  **Detection & Analysis**:
    -   **AI Pattern Analysis**: The system uses **OpenAI** to analyze recent incident clusters and identify high-risk zones.
    -   **Predictive Insights**: AI forecasts potential incidents for the next 7 days, allowing for proactive patrolling.
    -   **Complexity Scoring**: Every new incident is automatically scored for complexity and estimated resolution time based on historical data.
3.  **Real-time Alerting**:
    -   Critical alerts are dispatched via **Twilio SMS** and **Firebase Push Notifications** to nearby Rangers.
    -   Email reports are sent to Administrative Officers via **SendGrid**.
4.  **Action & Deployment**: Admins use AI-suggested staff assignments (powered by **Cohere**) to dispatch the best-suited rangers to the scene.
5.  **Resolution**: Incident progress is tracked in real-time, and reporters are notified of status changes until the case is resolved.

## �🛠️ Tech Stack

- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **Database**: [MongoDB](https://www.mongodb.com/) with [Mongoose ODM](https://mongoosejs.com/)
- **Authentication**: JSON Web Tokens (JWT) & BcryptJS
- **AI Engines**: Cohere AI & OpenAI
- **Communication**: Twilio (SMS), SendGrid (Email), Firebase Messaging (Push)
- **Storage**: Cloudinary

## 🔌 3rd Party Integrations

| Provider | Purpose | Usage in Project |
| :--- | :--- | :--- |
| **Cohere AI** | NLP & AI Suggestions | Automated staff assignment suggestions and semantic search. |
| **OpenAI** | Advanced AI Analysis | Intelligent data processing and reporting insights. |
| **Twilio** | SMS Gateway | Real-time SMS alerts to field staff and rangers. |
| **SendGrid** | Email Service | Professional email communications for reports and alerts. |
| **Firebase (FCM)**| Push Notifications | Mobile notifications for the WildSafe app. |
| **Cloudinary** | Image Hosting | Storing and optimized delivery of incident photos and files. |

## 📁 Project Structure

```text
WildSafe-back/
├── config/             # Database & environment configurations
├── controllers/        # Business logic for all routes
├── integrations/       # 3rd party API service wrappers (AI, Notifications)
├── middleware/         # Auth, logging, and error wrappers
├── models/             # Mongoose schemas for data entities
├── routes/             # API endpoint definitions
├── services/           # Reusable utility services
├── tests/              # Jest unit and integration tests
├── app.js              # Express application setup
└── server.js           # Entry point - starts the HTTP server
```

## 📡 API Reference

The backend exposes several API categories. Most endpoints require a valid JWT token in the `Authorization` header.

### Authentication
- `POST /api/auth/register` - Create a new user account
- `POST /api/auth/login` - Authenticate user and receive JWT

### Monitoring & Reports
- `GET /api/incidents` - List all wildlife incidents
- `POST /api/threat-reports` - Submit a new threat report
- `GET /api/analytics` - Fetch conservation metrics

### Management
- `GET /api/ranger` - Manage ranger status and locations
- `POST /api/assignment` - Task rangers to specific incidents
- `GET /api/staff` - Manage conservation staff profiles

### AI & Notifications
- `POST /api/ai/suggest` - Get AI-driven staff suggestions
- `POST /api/notifications/test` - Trigger test notifications across all channels

## ⚙️ Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB](https://www.mongodb.com/) (Local or Atlas)

### 1. Clone & Install
```bash
git clone https://github.com/Daniru12/WildSafe-back.git
cd WildSafe-back
npm install
```

### 2. Environment Variables
Create a `.env` file in the root directory and populate it based on `.env.example`:
```env
MONGODB_URI=your_connection_string
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
OPENAI_API_KEY=...
# ... Add Twilio, SendGrid, and Firebase keys
```

### 3. Run the Server
```bash
# Production mode
npm start

# Development mode (with nodemon)
npm run dev
```

## 🧪 Testing
```bash
# Run all tests
npm test

# Run tests with coverage report
npm run test:coverage
```

## 📄 License
This project is licensed under the ISC License.