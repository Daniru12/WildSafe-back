# Resource & Staff Management Testing Guide

This guide covers testing for the Resource and Staff Management module.

## 1. Integration Testing Setup and Execution

### 1.1 What is covered
The integration suite validates end-to-end API behavior for:
- Staff creation and role promotion (`CITIZEN -> OFFICER`)
- Officer resource take flow (without explicit `staffId`)
- Resource lock behavior (second officer blocked while assigned)
- Officer release flow (`ASSIGNED -> AVAILABLE`)

Test file:
- `tests/resourceStaff/resourceStaff.integration.test.js`

### 1.2 Prerequisites
- Backend dependencies installed (`npm install`)
- Reachable MongoDB test database
- JWT secret configured for test runtime

### 1.3 Environment configuration
Use values from `.env.example.test` and set at minimum:

```env
NODE_ENV=test
MONGODB_TEST_URI=mongodb://localhost:27017/wildsafe_test
JWT_SECRET=test_jwt_secret_key_for_testing_only
```

### 1.4 Run integration tests

```bash
# Run only Resource/Staff integration tests
npx jest tests/resourceStaff/resourceStaff.integration.test.js --runInBand

# Or via package script
npm run test:integration:resource-staff
```

### 1.5 Expected result
- All tests pass with `201/200/409` flows validated.
- DB cleanup occurs after each test.

## 2. Performance Testing Setup and Execution

### 2.1 Tooling
Performance testing uses `autocannon` via a Node runner script.

Script:
- `tests/performance/resourceStaff.performance.js`

### 2.2 Scope
Current scenarios:
- `GET /api/resources`
- `GET /api/staff`

### 2.3 Prerequisites
- API server running locally (default `http://localhost:5000`)
- Valid auth token with permissions (prefer `ADMIN`)

### 2.4 Environment variables for performance run

```env
PERF_BASE_URL=http://localhost:5000
PERF_AUTH_TOKEN=<valid_jwt_token>
PERF_CONNECTIONS=20
PERF_DURATION=20
```

### 2.5 Run performance tests

```bash
# Install if not already available
npm install

# Run with default load (20 connections, 20s per endpoint)
npm run test:perf:resource-staff

# Custom load profile (PowerShell example)
$env:PERF_CONNECTIONS='50'
$env:PERF_DURATION='30'
npm run test:perf:resource-staff
```

### 2.6 Performance output captured
Each scenario prints:
- Average requests/sec
- p95 latency
- Average throughput (KB/s)

## 3. Testing Environment Configuration Details

### 3.1 Runtime
- Node.js (same version used by project)
- Jest + Supertest for integration tests
- Autocannon for performance tests

### 3.2 Database strategy
- Integration tests use real MongoDB connection from test env.
- Data isolation:
  - Resource/Staff records are removed after each test
  - Test users (with `@test.com`) are removed after each test

### 3.3 Authentication for tests
- Integration tests generate JWT tokens directly using `JWT_SECRET`.
- Performance tests require externally provided `PERF_AUTH_TOKEN`.

### 3.4 Recommended execution order
1. `npm run test:integration:resource-staff`
2. Start API server (`npm run dev` or `npm start`)
3. `npm run test:perf:resource-staff`

### 3.5 CI/CD recommendation
- Run integration tests on every PR.
- Run performance script on staging/nightly builds with fixed load profile.
