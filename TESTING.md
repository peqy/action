# Testing Guide

This document explains how to test the Peqy GitHub Action using various methods.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Run local test (uses httpbin.org)
npm test

# 3. Run integration tests with mock server
npm run test:integration
```

## Testing Methods

### 1. 🚀 Quick Local Test (Easiest)

Test the action locally against httpbin.org (public test API):

```bash
npm test
```

This will:
- ✅ Simulate GitHub Actions environment
- ✅ Create mock PR context (PR #123)
- ✅ Send request to httpbin.org/post
- ✅ Show request/response details

**Customize the test:**
```bash
# Use your actual Peqy API
PEQY_API_URL="https://api.peqy.com/review" \
PEQY_API_KEY="your-real-api-key" \
npm test
```

---

### 2. 🧪 Mock Server Testing (Recommended)

Test against a local mock server to simulate different scenarios.

#### Step 1: Start the mock server

```bash
# In terminal 1 - Start mock server (default: success)
npm run test:mock-server

# Or test specific scenarios
SCENARIO=unauthorized npm run test:mock-server
SCENARIO=serverError npm run test:mock-server
```

#### Step 2: Run the action

```bash
# In terminal 2 - Test against local server
PEQY_API_URL="http://localhost:3000" npm test
```

#### Available Scenarios

| Scenario | Status | Use Case |
|----------|--------|----------|
| `success` | 200 | Happy path (default) |
| `created` | 201 | Resource created |
| `badRequest` | 400 | Invalid payload |
| `unauthorized` | 401 | Invalid API key |
| `forbidden` | 403 | Insufficient permissions |
| `notFound` | 404 | Endpoint not found |
| `unprocessable` | 422 | Validation error |
| `serverError` | 500 | Server error (tests retry logic) |
| `timeout` | 200 | Response after 35s (tests timeout) |

---

### 3. ⚡ Integration Tests (Comprehensive)

Run automated tests for multiple scenarios:

```bash
npm run test:integration
```

This will:
- ✅ Test success scenarios (200, 201)
- ✅ Test client errors (400, 401)
- ✅ Test server errors with retry logic (500)
- ✅ Verify exit codes match expectations
- ✅ Generate test report

**Example output:**
```
╔════════════════════════════════════════════════════════════╗
║     Peqy GitHub Action - Integration Tests                ║
╚════════════════════════════════════════════════════════════╝

Test 1: Success scenario (200 OK)
✓ PASSED (exit code: 0)

Test 2: Created scenario (201 Created)
✓ PASSED (exit code: 0)

Test 3: Unauthorized scenario (401)
✓ PASSED (exit code: 1)

...

Test Summary
  Total:  5
  Passed: 5
  Failed: 0

All tests passed!
```

---

### 4. 🎯 Test in Real GitHub Actions

Create a test PR in this repository to test the action end-to-end.

#### Option A: Test the example workflow

The repo includes `.github/workflows/example.yml` that runs on PRs.

```bash
# 1. Add your API key as a secret
gh secret set PEQY_API_KEY

# 2. Create a test branch and PR
git checkout -b test/action-validation
git commit --allow-empty -m "test: validate action"
git push origin test/action-validation

# 3. Create PR
gh pr create --title "Test Action" --body "Testing Peqy action"

# 4. Check the action run
gh run list
gh run view --log
```

#### Option B: Test with act (GitHub Actions locally)

[act](https://github.com/nektos/act) runs GitHub Actions locally with Docker.

```bash
# Install act (macOS)
brew install act

# Run PR workflow
act pull_request -s PEQY_API_KEY=your-test-key

# Run with specific event
act pull_request --eventpath test/fixtures/pr-event.json
```

---

### 5. 🔬 Test in a Separate Repository

Test how customers will use the action:

```bash
# 1. Create a test repository
mkdir test-peqy-action
cd test-peqy-action
git init

# 2. Create workflow
mkdir -p .github/workflows
cat > .github/workflows/peqy.yml << 'EOF'
name: Peqy Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: peqy/action@main  # or @v1 after release
        with:
          api-key: ${{ secrets.PEQY_API_KEY }}
          # api-url: http://localhost:3000  # for testing with mock
EOF

# 3. Create PR and test
git add .
git commit -m "Add Peqy workflow"
# Push and create PR...
```

---

### 6. 🧩 Unit Testing (Future)

For testing individual functions, you could add Jest:

```bash
npm install --save-dev jest

# Add to package.json
"scripts": {
  "test:unit": "jest"
}
```

Example test file (`test/validate.test.js`):
```javascript
const { validateApiKey, validateSha } = require('../index.js');

describe('Input Validation', () => {
  test('validates API key length', () => {
    expect(validateApiKey('short')).toBe(false);
    expect(validateApiKey('this-is-a-valid-api-key-longer-than-32-chars')).toBe(true);
  });

  test('validates SHA format', () => {
    expect(validateSha('abc123')).toBe(false);
    expect(validateSha('abc123def456789012345678901234567890abcd')).toBe(true);
  });
});
```

---

## Testing Checklist

Before releasing a new version, verify:

- [ ] **Local test passes** (`npm test`)
- [ ] **Integration tests pass** (`npm run test:integration`)
- [ ] **Build succeeds** (`npm run build`)
- [ ] **Dist is up-to-date** (no uncommitted changes in `dist/`)
- [ ] **Success scenario works** (200/201 responses)
- [ ] **Error scenarios handled** (401, 500, etc.)
- [ ] **Retry logic works** (test with `serverError` scenario)
- [ ] **Timeout protection works** (test with `timeout` scenario)
- [ ] **Secret masking works** (API key shows as `***` in logs)
- [ ] **Outputs are set correctly** (status-code, response, success)
- [ ] **Real API integration works** (test with staging/production API)

---

## Debugging Tips

### Enable Debug Logging

When running locally:
```bash
ACTIONS_STEP_DEBUG=true npm test
```

In GitHub Actions, add the secret:
```bash
gh secret set ACTIONS_STEP_DEBUG --body "true"
```

### Inspect Outputs

The action sets outputs that you can check:

```yaml
- name: Test Peqy Action
  id: peqy
  uses: peqy/action@v1
  with:
    api-key: ${{ secrets.PEQY_API_KEY }}

- name: Show outputs
  run: |
    echo "Status: ${{ steps.peqy.outputs.status-code }}"
    echo "Success: ${{ steps.peqy.outputs.success }}"
    echo "Response: ${{ steps.peqy.outputs.response }}"
```

### Common Issues

**Issue: "This action must be run in a pull request context"**
- Solution: Set `GITHUB_EVENT_NAME=pull_request` and provide event payload

**Issue: Connection timeout**
- Solution: Check API URL is accessible, increase timeout

**Issue: API key validation fails**
- Solution: Ensure API key is at least 32 characters

---

## CI/CD Testing

The repository includes automated CI tests:

- **`.github/workflows/ci.yml`** - Runs on every PR
  - ✅ Validates action.yml syntax
  - ✅ Checks dist/ is up-to-date
  - ✅ Tests action execution (if in PR context)

- **`.github/workflows/release.yml`** - Runs on version tags
  - ✅ Builds and verifies dist/
  - ✅ Creates GitHub release
  - ✅ Updates major version tag

---

## Performance Testing

Test with different timeout and retry configurations:

```bash
# Fast timeout (10 seconds)
INPUT_TIMEOUT=10000 npm test

# More retries (5 attempts)
INPUT_MAX_RETRIES=5 npm test

# Don't fail on error
INPUT_FAIL_ON_ERROR=false npm test
```

---

## Security Testing

Verify secrets are masked:

```bash
# Run test and check logs
npm test 2>&1 | grep -i "api.key" && echo "❌ LEAKED!" || echo "✅ Masked"
```

In GitHub Actions, secrets should appear as `***` in all logs.

---

## Need Help?

- 📖 [Main README](README.md)
- 🐛 [Report Issues](https://github.com/peqy/action/issues)
- 💬 [Discussions](https://github.com/peqy/action/discussions)
