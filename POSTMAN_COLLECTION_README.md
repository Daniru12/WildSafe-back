# WildSafe API - Postman Collection Guide

## Overview

This Postman collection contains all API endpoints for the WildSafe wildlife protection system. The collection is organized by feature areas and includes sample requests with proper authentication and example payloads.

## Files Included

1. **WildSafe-API-Collection.postman_collection.json** - Main API collection with all endpoints
2. **WildSafe-Environment.postman_environment.json** - Environment variables for easy configuration

## How to Import into Postman

### Step 1: Import the Collection

1. Open Postman
2. Click **"Import"** in the top left
3. Select **"File"** tab
4. Choose **WildSafe-API-Collection.postman_collection.json**
5. Click **"Import"**

### Step 2: Import the Environment

1. Click the **settings icon** (gear icon) in the top right
2. Select **"Environments"**
3. Click **"Import"**
4. Select **WildSafe-Environment.postman_environment.json**
5. Click **"Open"**

### Step 3: Select the Environment

1. In the top right of Postman, find the environment dropdown (default: "No Environment")
2. Select **"WildSafe Environment"**

## API Endpoints Organization

### 1. **Authentication**

Core authentication endpoints for user management.

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - User login (saves token automatically)
- `GET /api/auth/profile` - Get logged-in user profile
- `GET /api/auth/users` - Get all users (Admin only)
- `PUT /api/auth/users/:userId/role` - Update user role (Admin only)

**First Steps:**

1. Start with the **Login** request to get an AUTH_TOKEN
2. The token is automatically saved to your environment via the test script

### 2. **Incidents**

Handle incident reporting and management.

- `POST /api/incidents` - Create new incident report
- `GET /api/incidents/mine` - Get your incident reports
- `GET /api/incidents/all` - Get all incidents (Officer/Admin)
- `GET /api/incidents/:id` - Get specific incident
- `PATCH /api/incidents/:id/status` - Update incident status
- `PATCH /api/incidents/:id/assign` - Assign to officer (Admin)
- `DELETE /api/incidents/:id` - Delete incident (Admin)

**Status Values:** SUBMITTED, UNDER_REVIEW, IN_PROGRESS, RESOLVED, CLOSED

### 3. **Alerts**

Alert system for emergency and custom notifications.

- `GET /api/alerts` - Get your alerts
- `GET /api/alerts/all` - Get all alerts (Admin)
- `GET /api/alerts/stats` - Alert statistics
- `GET /api/alerts/location` - Location-based alerts
- `POST /api/alerts/emergency` - Send emergency alert
- `POST /api/alerts/custom` - Send custom alert
- `POST /api/alerts/announcement` - Send announcement (Admin)
- `PUT /api/alerts/:id/read` - Mark alert as read
- `PUT /api/alerts/read-all` - Mark all as read
- `DELETE /api/alerts/:id` - Delete alert

### 4. **Analytics**

Data analytics and predictive insights.

- `GET /api/analytics/incidents-by-category` - Incidents by category
- `GET /api/analytics/incidents-by-status` - Incidents by status
- `GET /api/analytics/trends` - Incident trends
- `GET /api/analytics/predictive/insights` - Predictive insights
- `GET /api/analytics/predictive/incident/:id` - Specific incident prediction

### 5. **Notifications**

User notification management.

- `GET /api/notifications` - Get your notifications
- `GET /api/notifications/stats` - Notification statistics
- `PUT /api/notifications/:id/read` - Mark as read
- `PUT /api/notifications/read-all` - Mark all as read
- `DELETE /api/notifications/:id` - Delete notification
- `GET /api/notifications/admin/all` - All notifications (Admin)
- `POST /api/notifications/test` - Test notification (Admin)

### 6. **Awareness**

Educational content and awareness campaigns.

- `GET /api/awareness/active` - Get active awareness content
- `GET /api/awareness/relevant/:alertType` - Get relevant content by type
- `GET /api/awareness/:id` - Get specific awareness item
- `POST /api/awareness` - Create awareness content (Officer/Admin)
- `PATCH /api/awareness/:id` - Update awareness content (Officer/Admin)
- `POST /api/awareness/periodic` - Send periodic update (Admin)
- `DELETE /api/awareness/:id` - Delete awareness content (Admin)

### 7. **Ranger Operations**

Ranger mission tracking and evidence management.

- `GET /api/ranger/cases` - Get assigned cases
- `GET /api/ranger/cases/:caseId` - Get case details
- `POST /api/ranger/cases/:caseId/accept` - Accept mission
- `POST /api/ranger/cases/:caseId/decline` - Decline mission
- `POST /api/ranger/cases/:caseId/start-mission` - Start mission (EN_ROUTE)
- `POST /api/ranger/cases/:caseId/arrive-on-site` - Arrive on site
- `POST /api/ranger/cases/:caseId/action-taken` - Record action taken
- `POST /api/ranger/cases/:caseId/evidence` - Upload evidence (multipart)
- `DELETE /api/ranger/cases/:caseId/evidence/:evidenceId` - Delete evidence

**Mission Status Flow:** ASSIGNED → EN_ROUTE → ON_SITE → ACTION_TAKEN → COMPLETED

### 8. **Cases**

Case management and tracking.

- `GET /api/cases` - Get all cases with filters
- `GET /api/cases/:id` - Get specific case
- `POST /api/cases` - Create case from threat report

### 9. **Threat Reports**

Threat report submission and management.

- `POST /api/threat-reports` - Submit threat report (No auth required)
- `GET /api/threat-reports` - Get all threat reports
- `GET /api/threat-reports/:id` - Get specific report
- `PATCH /api/threat-reports/:id` - Update report status

## Environment Variables

The following variables are automatically managed or can be manually set:

| Variable           | Purpose                  | How to Set                                                      |
| ------------------ | ------------------------ | --------------------------------------------------------------- |
| `BASE_URL`         | API base URL             | Modify in environment settings (default: http://localhost:5000) |
| `AUTH_TOKEN`       | JWT authentication token | Auto-saved after login request                                  |
| `CITIZEN_ID`       | Citizen user ID          | Copy from login/profile response                                |
| `OFFICER_ID`       | Officer user ID          | Copy from user list response                                    |
| `ADMIN_ID`         | Admin user ID            | Copy from user list response                                    |
| `INCIDENT_ID`      | Incident ID for testing  | Copy from create/list incidents response                        |
| `CASE_ID`          | Case ID for testing      | Copy from get cases response                                    |
| `ALERT_ID`         | Alert ID for testing     | Copy from alerts response                                       |
| `THREAT_REPORT_ID` | Threat report ID         | Copy from threat reports response                               |
| `CONTENT_ID`       | Awareness content ID     | Copy from awareness response                                    |

## Quick Start Test Workflow

Follow these steps to test the API:

### 1. Authentication

```bash
1. POST /api/auth/register (create account if needed)
2. POST /api/auth/login (login to get token)
3. Token auto-saves to {{AUTH_TOKEN}}
4. GET /api/auth/profile (verify you're logged in)
```

### 2. Create an Incident

```bash
POST /api/incidents
- Fill in title, description, category, location
- Response contains incident ID (save as {{INCIDENT_ID}})
```

### 3. Retrieve Your Incidents

```bash
GET /api/incidents/mine
- View all your submitted incidents
```

### 4. (Admin) Assign Incident

```bash
PATCH /api/incidents/:id/assign
- Replace :id with your {{INCIDENT_ID}}
- Provide {{OFFICER_ID}} to assign to
```

### 5. Send Alerts

```bash
POST /api/alerts/emergency
- Include title, message, location
- Receives notification
```

### 6. Ranger Operations (Officer/Admin)

```bash
1. GET /api/ranger/cases (view assigned cases)
2. POST /api/ranger/cases/:caseId/accept (accept mission)
3. POST /api/ranger/cases/:caseId/start-mission
4. POST /api/ranger/cases/:caseId/arrive-on-site
5. POST /api/ranger/cases/:caseId/evidence (upload photos)
```

## Role-Based Access

Different endpoints require different roles:

| Role        | Description                       | Can Access                                                     |
| ----------- | --------------------------------- | -------------------------------------------------------------- |
| **CITIZEN** | Regular users reporting incidents | Create incidents, view own incidents, awareness                |
| **OFFICER** | Law enforcement/rangers           | View all incidents, update status, create alerts, manage cases |
| **ADMIN**   | System administrators             | All endpoints, user management, assign incidents               |

## Authentication Header Format

All endpoints (except login/register/public endpoints) require:

```
Authorization: Bearer {{AUTH_TOKEN}}
```

This is automatically included in the collection requests.

## Common Response Codes

| Code | Meaning                              |
| ---- | ------------------------------------ |
| 200  | Success                              |
| 201  | Created successfully                 |
| 400  | Bad request (invalid data)           |
| 401  | Unauthorized (missing/invalid token) |
| 403  | Forbidden (insufficient permissions) |
| 404  | Not found                            |
| 500  | Server error                         |

## Testing Tips

1. **Use Variables** - Copy IDs from responses and paste into the {{}} brackets in requests
2. **Test in Order** - Login first, then test endpoints with your token
3. **Check Response** - Look at the Response tab to see returned data
4. **Use Tests** - Some requests have automated test scripts that save data to environment
5. **Monitor Logs** - Check server console for any errors
6. **Environment Toggle** - Can temporarily disable variables by unchecking them

## Troubleshooting

### "No token, authorization denied"

- You're missing the AUTH_TOKEN
- Run the Login request first
- Check that {{AUTH_TOKEN}} variable is set in your environment

### "Access denied: insufficient permissions"

- Your user role doesn't have permission for this endpoint
- Check if you're using the correct user role (Officer vs Admin vs Citizen)
- Verify your user role with GET /api/auth/profile

### "Invalid location format"

- Location must include latitude, longitude
- Use format: `{ "lat": 12.3456, "lng": 78.9012, "address": "Location name" }`

### Token Expired

- Re-run the Login request to get a new token
- It will auto-update {{AUTH_TOKEN}}

## Production Deployment

Before moving to production:

1. Create a new environment file with production BASE_URL
2. Update all sensitive values (API keys, URLs)
3. Test all critical workflows
4. Document any custom configurations
5. Keep backup of working collection

## Additional Resources

- API Documentation: See route files in `/routes` directory
- Controller Logic: Check `/controllers` directory
- Models: Database schema in `/models` directory
- Tests: Unit tests in `/tests` directory

## Support & Documentation

For detailed endpoint documentation, refer to:

- Individual route files in the `/routes` folder
- Controller implementations in the `/controllers` folder
- Test files in the `/tests` folder for example usage

---

**Last Updated:** February 27, 2026
**Version:** 1.0
