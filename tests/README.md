# WildSafe Backend API Tests

This directory contains comprehensive test suites for the WildSafe backend API endpoints.

## Setup

### Prerequisites
- Node.js installed
- MongoDB instance (local or cloud)
- Environment variables configured

### Environment Variables
Create a `.env.test` file or set the following environment variables:
```
MONGODB_TEST_URI=mongodb://localhost:27017/wildsafe_test
JWT_SECRET=your_test_jwt_secret
```

### Installing Dependencies
```bash
npm install --save-dev
```

## Running Tests

### Run all tests
```bash
npm test
```

### Run tests in watch mode
```bash
npm run test:watch
```

### Run tests with coverage report
```bash
npm run test:coverage
```

## Test Structure

### Files
- `setup.js` - Global test setup and teardown
- `incidentController.test.js` - Tests for incident API endpoints
- `helpers/testHelpers.js` - Utility functions for testing

### Test Coverage

#### Incident Controller Tests (`incidentController.test.js`)

**Endpoints Tested:**
1. `POST /api/incidents` - Create new incident
   - ✅ Valid incident creation
   - ✅ Authentication required
   - ✅ Validation of required fields
   - ✅ Invalid category handling
   - ✅ Invalid location coordinates

2. `GET /api/incidents/mine` - Get user's incidents
   - ✅ Retrieve user's own incidents
   - ✅ Authentication required
   - ✅ Empty result for users with no incidents

3. `GET /api/incidents/:id` - Get incident by ID
   - ✅ Citizen can view own incident
   - ✅ Officer can view any incident
   - ✅ Admin can view any incident
   - ✅ Non-existent incident handling
   - ✅ Authentication required

4. `GET /api/incidents/all` - Get all incidents (Officer/Admin)
   - ✅ Officer access
   - ✅ Admin access
   - ✅ Citizen access denied
   - ✅ Filter by status
   - ✅ Filter by category

5. `PATCH /api/incidents/:id/status` - Update incident status
   - ✅ Officer can update status
   - ✅ Admin can update status
   - ✅ Citizen access denied
   - ✅ Non-existent incident handling

6. `PATCH /api/incidents/:id/assign` - Assign incident
   - ✅ Admin can assign incidents
   - ✅ Officer access denied
   - ✅ Citizen access denied
   - ✅ Non-existent incident handling

## Test Data

### Users Created
- **Citizen**: `citizen@test.com` (CITIZEN role)
- **Officer**: `officer@test.com` (OFFICER role)
- **Admin**: `admin@test.com` (ADMIN role)

### Test Scenarios
- Authentication and authorization
- Input validation
- Error handling
- Role-based access control
- Data filtering and pagination

## Best Practices

### Test Organization
- Tests are grouped into `describe` blocks by endpoint
- Each test case is clearly named with `it()` statements
- BeforeEach hooks ensure clean test isolation
- AfterAll hooks handle cleanup

### Assertions
- Status codes are explicitly checked
- Response bodies are validated
- Database state is verified where needed
- Error messages are verified

### Mock Data
- Test helpers provide consistent data generation
- Valid and invalid data scenarios are covered
- Edge cases are tested (missing fields, invalid values)

## Coverage Reports

Coverage reports are generated in the `coverage/` directory:
- `lcov-report/` - HTML coverage report
- `coverage.lcov` - LCOV format report

Open `coverage/lcov-report/index.html` in a browser to view detailed coverage.

## Troubleshooting

### Common Issues

1. **MongoDB Connection Error**
   - Ensure MongoDB is running
   - Check `MONGODB_TEST_URI` environment variable
   - Verify database permissions

2. **Authentication Failures**
   - Check `JWT_SECRET` environment variable
   - Ensure test users are created correctly
   - Verify token generation

3. **Test Timeouts**
   - Increase test timeout in `jest.config.js`
   - Check for hanging database connections
   - Verify async/await usage

### Running Individual Tests
```bash
# Run specific test file
npx jest tests/incidentController.test.js

# Run specific test case
npx jest --testNamePattern="should create a new incident"
```

## Contributing

When adding new tests:
1. Follow the existing naming conventions
2. Use test helpers for common operations
3. Test both success and failure scenarios
4. Update this README with new test coverage
5. Ensure all tests pass before submitting

## Future Enhancements

- Integration tests for complete workflows
- Performance testing
- Load testing
- API documentation generation from tests
- Automated test execution in CI/CD pipeline
