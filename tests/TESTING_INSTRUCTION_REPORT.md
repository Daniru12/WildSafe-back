# WildSafe Backend — Testing Instruction Report

---

## i. How to Run Unit Tests

### Prerequisites

- **Node.js** (v18+ recommended)
- **npm** (comes with Node.js)
- Project dependencies installed:

```bash
npm install
```

### Test Framework & Tools

| Tool | Version | Purpose |
|---|---|---|
| **Jest** | ^30.2.0 | Test runner, assertions, mocking |
| **Supertest** | ^7.2.2 | HTTP endpoint testing (integration) |

### Available npm Scripts

| Script | Command | Description |
|---|---|---|
| `npm test` | `jest` | Run all tests once |
| `npm run test:watch` | `jest --watch` | Run tests in watch mode (re-runs on file changes) |
| `npm run test:coverage` | `jest --coverage` | Run tests and generate coverage report |

### Unit Test Files

Unit tests mock Mongoose models via `jest.mock()` and do **not** require a live MongoDB connection. They validate controller logic in isolation.

| File | Module Under Test | Type |
|---|---|---|
| `tests/notification/alertController.test.js` | `controllers/alertController.js` | Unit (mocked models) |
| `tests/notification/awarenessController.test.js` | `controllers/awarenessController.js` | Unit (mocked models) |
| `tests/notification/notificationController.test.js` | `controllers/notificationController.js` | Unit (mocked models) |
| `tests/resourceStaff/resourceController.test.js` | `controllers/resourceStaff/resourceController.js` | Unit (mocked models) |
| `tests/resourceStaff/staffController.test.js` | `controllers/resourceStaff/staffController.js` | Unit (mocked models) |

### Running Specific Unit Tests

```bash
# Run a single test file
npx jest tests/notification/alertController.test.js

# Run all notification unit tests
npx jest tests/notification/

# Run all resource/staff unit tests
npx jest tests/resourceStaff/

# Run a specific test case by name
npx jest --testNamePattern="200 – returns paginated alerts"
```

### Skipping the Database for Pure Unit Tests

Set the environment variable `SKIP_DB=true` to prevent the setup file from attempting a MongoDB connection:

```bash
# Windows (PowerShell)
$env:SKIP_DB="true"; npm test

# Linux/macOS
SKIP_DB=true npm test
```

This is useful when only running the mocked unit tests (notification/ and resourceStaff/) where no real DB is needed.

### Unit Test Pattern

Each unit test file follows this structure:

1. **Mock declarations** at the top — `jest.mock('../../models/<Model>')`
2. **Helper functions** — `mockReq()` builds a fake Express request, `mockRes()` builds a fake Express response with spyable `.status()` and `.json()`
3. **`describe` blocks** per controller function
4. **`test` cases** for success (2xx) and error (4xx/5xx) scenarios
5. **`afterEach(() => jest.clearAllMocks())`** to reset mocks between tests

---

## ii. Integration Testing Setup and Execution

### Overview

Integration tests exercise the full Express app via `supertest`, hitting real API endpoints with real MongoDB operations (authentication, validation, database reads/writes). These tests require a running MongoDB instance.

### Integration Test Files

| File | Endpoints Covered | Setup File |
|---|---|---|
| `tests/incidentController.test.js` | `POST/GET/PATCH/DELETE /api/incidents/*` | `tests/setup.js` |
| `tests/threatReportController.test.js` | `POST/GET/PATCH /api/threat-reports/*` | `tests/setup.js` |
| `tests/rangerController.test.js` | `GET/POST /api/ranger/cases/*` | `tests/setupRanger.js` |

### Jest Project Configuration

The Jest config (`jest.config.js`) defines **two projects** that run sequentially:

| Project | Match Pattern | Setup File | Timeout | Behavior |
|---|---|---|---|---|
| **default** | All `*.test.js` except `rangerController.test.js` | `tests/setup.js` | 10 000 ms | Cleans `incidents`, `assignments`, `notifications`, `resources`, `staff` after each test |
| **ranger** | `rangerController.test.js` only | `tests/setupRanger.js` | 20 000 ms | Does **not** clean `cases`, `rangermissions`, `threatreports` so ranger workflows can span multiple steps |

`maxWorkers: 1` ensures projects run **sequentially** so the default project's cleanup does not wipe data the ranger project depends on.

### Setup & Teardown Lifecycle

**`tests/setup.js`** (default project):

1. `beforeAll` — Connects to MongoDB using `MONGODB_TEST_URI` (or falls back to `MONGODB_URI` or a localhost default). If MongoDB is unreachable, it gracefully skips DB setup (unit-test mode).
2. `afterEach` — Deletes all documents from: `incidents`, `assignments`, `notifications`, `resources`, `staff`. Preserves `users`, `cases`, `rangermissions`, `threatreports`.
3. `afterAll` — Disconnects from MongoDB.

**`tests/setupRanger.js`** (ranger project):

- Same connection logic as `setup.js`.
- `afterEach` cleans the same collections but **preserves** `cases`, `rangermissions`, and `threatreports`, allowing ranger workflow tests to create a case in one test and operate on it in subsequent tests.
- Longer timeout (20 s) to accommodate multi-step ranger operations.

### Test Data & Authentication

Integration tests create three test users in `beforeAll`:

| Role | Email | Password | Purpose |
|---|---|---|---|
| **CITIZEN** | `citizen@test.com` | `password123` | Submit incidents, view own data |
| **OFFICER** | `officer@test.com` | `password123` | View all incidents, update status, ranger ops |
| **ADMIN** | `admin@test.com` | `password123` | Full access, assign incidents, manage users |

JWT tokens are generated via `jwt.sign({ id: user._id }, JWT_SECRET)` and attached to requests using the `Authorization: Bearer <token>` header.

### Running Integration Tests

```bash
# Run all tests (unit + integration)
npm test

# Run only incident integration tests
npx jest tests/incidentController.test.js

# Run only threat report integration tests
npx jest tests/threatReportController.test.js

# Run only ranger integration tests
npx jest tests/rangerController.test.js

# Run a specific describe block
npx jest --testNamePattern="POST /api/incidents"
```

### Helper Utilities

`tests/helpers/testHelpers.js` provides reusable functions:

| Function | Description |
|---|---|
| `createTestUser(userData)` | Creates a user and returns `{ user, token }` |
| `createTestUsers()` | Creates citizen, officer, admin users with tokens |
| `createTestIncident(data, reporterId)` | Creates an incident with sensible defaults |
| `createTestIncidents(count, reporterId)` | Creates N incidents with varied categories/statuses |
| `cleanupTestData()` | Deletes all users and incidents |
| `generateValidIncidentData(overrides)` | Returns a valid incident payload object |
| `VALID_CATEGORIES` | `['ILLEGAL_LOGGING', 'FOREST_FIRE', 'POACHING', 'ANIMAL_CONFLICT', 'TRAPPED_INJURED_ANIMAL', 'OTHER']` |
| `VALID_STATUSES` | `['SUBMITTED', 'UNDER_REVIEW', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']` |
| `VALID_PRIORITIES` | `['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']` |

### Postman Collection (Manual Integration Testing)

For manual/exploratory integration testing, a Postman collection is provided:

- **Collection**: `WildSafe-API-Collection.postman_collection.json`
- **Environment**: `WildSafe-Environment.postman_environment.json`

Import both into Postman. The environment auto-saves the `AUTH_TOKEN` after login. See `POSTMAN_COLLECTION_README.md` for the full endpoint walkthrough.

---

## iii. Performance Testing Setup and Execution

### Current Status

Performance/load testing is **not yet automated** in the project. The existing `tests/README.md` lists it as a future enhancement. Below are instructions for setting up and executing performance tests.

### Recommended Tool: **k6** (by Grafana Labs)

k6 is a modern, scriptable load-testing tool that integrates well with Node.js/Express backends.

#### Installation

```bash
# Windows (PowerShell)
winget install k6.k6

# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /etc/apt/trusted.gpg.d/k6.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C4912B9DBA9C
echo "deb [signed-by=/etc/apt/trusted.gpg.d/k6.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

#### Sample k6 Script

Create `tests/performance/load-test.js`:

```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 20 },   // ramp up to 20 users
    { duration: '1m',  target: 20 },   // stay at 20 users
    { duration: '30s', target: 0 },     // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],   // 95% of requests < 500ms
    http_req_failed: ['rate<0.01'],     // <1% failure rate
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export function setup() {
  // Login to get token
  const res = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'admin@test.com',
    password: 'password123',
  }), { headers: { 'Content-Type': 'application/json' } });
  return { token: res.json('token') };
}

export default function (data) {
  const headers = {
    'Authorization': `Bearer ${data.token}`,
    'Content-Type': 'application/json',
  };

  // Test: GET /api/incidents/all
  const res = http.get(`${BASE_URL}/api/incidents/all`, { headers });
  check(res, { 'status was 200': (r) => r.status === 200 });

  sleep(1);
}
```

#### Running k6 Performance Tests

```bash
# Basic run
k6 run tests/performance/load-test.js

# With custom base URL
k6 run -e BASE_URL=http://staging.example.com tests/performance/load-test.js

# With more virtual users (override options)
k6 run --vus 50 --duration 2m tests/performance/load-test.js
```

#### Alternative: **Artillery**

```bash
npm install --save-dev artillery
```

Create `tests/performance/artillery-config.yml`:

```yaml
config:
  target: 'http://localhost:5000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: Warm up
    - duration: 120
      arrivalRate: 25
      name: Sustained load
scenarios:
  - flow:
      - post:
          url: '/api/auth/login'
          json:
            email: 'admin@test.com'
            password: 'password123'
          capture:
            - json: '$.token'
              as: token
      - get:
          url: '/api/incidents/all'
          headers:
            Authorization: 'Bearer {{token}}'
```

Run with:

```bash
npx artillery run tests/performance/artillery-config.yml
```

#### Performance Testing Best Practices

1. **Always test against a dedicated test/staging database** — never against production.
2. **Warm up the server** — start the Express app and let it settle before beginning load injection.
3. **Establish baselines first** — run with low load to capture normal response times, then increase.
4. **Monitor server resources** — CPU, memory, and MongoDB connection pool during the test.
5. **Isolate variables** — test one endpoint or workflow at a time to identify bottlenecks.
6. **Set realistic thresholds** — based on expected user concurrency and SLA requirements.

---

## iv. Testing Environment Configuration Details

### Environment Files

| File | Purpose |
|---|---|
| `.env` | Active environment variables (gitignored) |
| `.env.example` | Template for production/development environment |
| `.env.example.test` | Template for test environment |

### Required Test Environment Variables

| Variable | Example Value | Purpose |
|---|---|---|
| `MONGODB_TEST_URI` | `mongodb://localhost:27017/wildsafe_test` | MongoDB connection string for test database |
| `JWT_SECRET` | `test_jwt_secret_key_for_testing_only` | Secret key for signing JWT tokens in tests |
| `NODE_ENV` | `test` | Sets Node environment to test mode |
| `SKIP_DB` | `true` | When set, skips MongoDB connection (pure unit-test mode) |
| `OPENAI_API_KEY` | `sk-test-dummy` | Dummy key so analytics routes load without real OpenAI access |
| `COHERE_API_KEY` | `test-cohere-dummy` | Dummy key so app boots without real Cohere access |

### Setting Up the Test Environment

1. **Copy the test environment template:**

```bash
# PowerShell
copy .env.example.test .env.test

# Bash
cp .env.example.test .env.test
```

2. **Or set variables directly before running tests:**

```powershell
# PowerShell
$env:MONGODB_TEST_URI="mongodb://localhost:27017/wildsafe_test"
$env:JWT_SECRET="test_jwt_secret_key_for_testing_only"
$env:NODE_ENV="test"
npm test
```

```bash
# Bash
export MONGODB_TEST_URI="mongodb://localhost:27017/wildsafe_test"
export JWT_SECRET="test_jwt_secret_key_for_testing_only"
export NODE_ENV="test"
npm test
```

### MongoDB Configuration

- **Test DB name**: `wildsafe_test` (isolated from production data)
- **Connection fallback chain**: `MONGODB_TEST_URI` → `MONGODB_URI` → `mongodb://localhost:27017/wildsafe_test`
- **Timeout**: `serverSelectionTimeoutMS: 5000` (fails fast if DB is unreachable)
- **Graceful degradation**: If MongoDB is unreachable, setup logs a warning and proceeds in unit-test mode

### Jest Configuration (`jest.config.js`)

| Setting | Value | Rationale |
|---|---|---|
| `testEnvironment` | `'node'` | Node.js environment (no browser DOM) |
| `maxWorkers` | `1` | Sequential execution; prevents ranger data from being wiped by default project cleanup |
| `testTimeout` | `10 000` ms (default) / `20 000` ms (ranger) | Sufficient for DB operations |
| `verbose` | `true` | Prints individual test names |
| `coverageDirectory` | `'coverage'` | Output directory for coverage reports |
| `coverageReporters` | `['text', 'lcov', 'html']` | Terminal output, LCOV for CI, HTML for browser viewing |
| `collectCoverageFrom` | `controllers/**/*.js`, `models/**/*.js`, `routes/**/*.js`, `middleware/**/*.js` | Tracks coverage on application code, not tests |

### Data Cleanup Strategy

| Collection | Default Project (`setup.js`) | Ranger Project (`setupRanger.js`) |
|---|---|---|
| `incidents` | ✅ Cleaned after each test | ✅ Cleaned after each test |
| `assignments` | ✅ Cleaned after each test | ✅ Cleaned after each test |
| `notifications` | ✅ Cleaned after each test | ✅ Cleaned after each test |
| `resources` | ✅ Cleaned after each test | ✅ Cleaned after each test |
| `staff` | ✅ Cleaned after each test | ✅ Cleaned after each test |
| `users` | ❌ Preserved | ❌ Preserved |
| `cases` | ❌ Preserved | ❌ Preserved |
| `rangermissions` | ❌ Preserved | ❌ Preserved |
| `threatreports` | ❌ Preserved | ❌ Preserved |

### Coverage Reports

After running `npm run test:coverage`:

- **Terminal**: Summary table printed to stdout
- **HTML**: Open `coverage/lcov-report/index.html` in a browser for detailed file-by-file coverage
- **LCOV**: `coverage/coverage.lcov` available for CI integration (e.g., Codecov, Coveralls)

### CI/CD Integration

The project includes a `.github/` directory for GitHub Actions. To run tests in CI:

```yaml
# .github/workflows/test.yml (example)
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    env:
      MONGODB_TEST_URI: mongodb://localhost:27017/wildsafe_test
      JWT_SECRET: ci_test_secret
      NODE_ENV: test
      SKIP_DB: true
    services:
      mongodb:
        image: mongo:7
        ports:
          - 27017:27017
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm run test:coverage
```

Set `SKIP_DB: false` and use the MongoDB service container when integration tests should run in CI.

---

**Report generated:** April 2026  
**Project:** WildSafe Backend v1.0.0  
**Testing framework:** Jest ^30.2.0 + Supertest ^7.2.2
