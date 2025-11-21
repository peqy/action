# Peqy GitHub Action

A GitHub Action that triggers Peqy code reviews by sending pull request information to the Peqy API. Built with security, reliability, and usability in mind.

## Features

- ✅ **Automatic PR context extraction** - Owner, repo, PR number, and SHA
- 🔒 **Secure secret handling** - Automatic masking prevents API key leaks
- 🔄 **Retry logic** - Exponential backoff for transient failures (configurable)
- ⏱️ **Configurable timeouts** - Prevent hanging requests
- 📊 **Detailed outputs** - Status code, response, and success flag for workflow integration
- 🐛 **Enhanced error messages** - Clear annotations with context for debugging
- ✔️ **Input validation** - Validates API keys, SHA format, and all required fields
- 🎯 **Flexible error handling** - Choose to fail or continue on API errors

## Usage

### Prerequisites

1. Add your API key to GitHub repository secrets:
   - Go to your repository **Settings → Secrets and variables → Actions**
   - Click **"New repository secret"**
   - Name: `PEQY_API_KEY` (or any name you prefer)
   - Value: Your Peqy API key

### Basic Example

Add this to your workflow file (e.g., `.github/workflows/peqy.yml`):

```yaml
name: Peqy Code Review

on:
  pull_request:
    types: [opened, synchronize]

jobs:
  trigger-review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Review
        uses: peqy/action@v1
        with:
          api-key: ${{ secrets.PEQY_API_KEY }}
```

### Advanced Example with All Options

```yaml
name: Peqy Code Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  trigger-review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Review
        id: review
        uses: peqy/action@v1
        with:
          api-key: ${{ secrets.PEQY_API_KEY }}
          # api-url: 'https://demo.peqy.ai/api/v1/checks/trigger'  # Default, can be omitted
          timeout: '45000'           # 45 seconds
          max-retries: '3'           # Retry up to 3 times
          fail-on-error: 'true'      # Fail workflow on error

      - name: Check review status
        if: always()
        run: |
          echo "Status: ${{ steps.review.outputs.status-code }}"
          echo "Success: ${{ steps.review.outputs.success }}"
          echo "Response: ${{ steps.review.outputs.response }}"
```

### Manual Trigger Example

Trigger the review manually using `workflow_dispatch`:

```yaml
name: Manual Peqy Review

on:
  workflow_dispatch:

jobs:
  trigger-review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Review
        uses: peqy/action@v1
        with:
          api-key: ${{ secrets.PEQY_API_KEY }}
```

### Conditional Execution Example

Only trigger review for specific branches or conditions:

```yaml
name: Peqy Code Review

on:
  pull_request:
    types: [opened, synchronize]
    branches:
      - main
      - develop

jobs:
  trigger-review:
    runs-on: ubuntu-latest
    # Skip draft PRs
    if: github.event.pull_request.draft == false
    steps:
      - name: Trigger Review
        uses: peqy/action@v1
        with:
          api-key: ${{ secrets.PEQY_API_KEY }}
```

### With Concurrency Control

Prevent multiple reviews running simultaneously for the same PR:

```yaml
name: Peqy Code Review

on:
  pull_request:
    types: [opened, synchronize]

concurrency:
  group: review-${{ github.event.pull_request.number }}
  cancel-in-progress: true

jobs:
  trigger-review:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Review
        uses: peqy/action@v1
        with:
          api-key: ${{ secrets.PEQY_API_KEY }}
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `api-key` | API key for authentication. Store in GitHub Secrets. | **Yes** | - |
| `api-url` | API endpoint URL. Override for testing/staging environments. | No | `https://demo.peqy.ai/api/v1/checks/trigger` |
| `timeout` | Request timeout in milliseconds (1000-300000) | No | `30000` (30s) |
| `max-retries` | Maximum retry attempts for failed requests (1-5) | No | `3` |
| `fail-on-error` | Whether to fail the workflow if the API request fails | No | `true` |

## Outputs

| Output | Description |
|--------|-------------|
| `status-code` | HTTP status code from the API response |
| `response` | Response body from the API (may be truncated for large responses) |
| `success` | Whether the API call succeeded (`true` or `false`) |

### Using Outputs

```yaml
- name: Trigger Review
  id: review
  uses: peqy/action@v1
  with:
    api-key: ${{ secrets.PEQY_API_KEY }}

- name: Post comment on failure
  if: steps.review.outputs.success == 'false'
  uses: actions/github-script@v7
  with:
    script: |
      github.rest.issues.createComment({
        issue_number: context.issue.number,
        owner: context.repo.owner,
        repo: context.repo.repo,
        body: `Review failed with status ${context.env.STATUS}`
      })
  env:
    STATUS: ${{ steps.review.outputs.status-code }}
```

## Data Sent to API

The action sends a POST request with the following JSON payload:

```json
{
  "owner": "repository-owner",
  "repo": "repository-name",
  "pr": 123,
  "sha": "abc123def456..."
}
```

### Authentication

The API key is sent via the `X-API-Key` header:

```
POST /api/v1/checks/trigger HTTP/1.1
Host: demo.peqy.ai
Content-Type: application/json
X-API-Key: your-api-key-here
User-Agent: peqy-github-action/1.0
```

## Security

### API Key Management

- ✅ **Never** commit API keys to your repository
- ✅ Store API keys in **GitHub Secrets** (Settings → Secrets and variables → Actions)
- ✅ Use environment-specific secrets for production vs staging
- ✅ **Rotate API keys every 30-90 days**
- ✅ Grant **minimum required permissions** to API keys
- ✅ API keys are automatically **masked** in logs by GitHub Actions

### Secret Masking

This action uses `@actions/core.setSecret()` to ensure your API key is automatically masked in all logs. Even if there's an error, your API key will appear as `***` in the workflow logs.

### Production Recommendations

For production workflows, pin to a specific commit SHA instead of a tag:

```yaml
uses: peqy/action@a1b2c3d4e5f6g7h8i9j0  # Immutable reference
```

This prevents supply-chain attacks via tag manipulation.

### Required Permissions

This action requires the following permissions on the `GITHUB_TOKEN`:

```yaml
permissions:
  pull-requests: read  # To access PR information
  contents: read       # To read repository data
```

These are the default permissions for most workflows. If you've restricted permissions, add them explicitly.

### Reporting Security Issues

If you discover a security vulnerability, please email **security@example.com** instead of opening a public issue.

## Error Handling

### Retry Logic

The action automatically retries failed requests with exponential backoff:

- **Attempt 1**: Immediate
- **Attempt 2**: Wait 2 seconds
- **Attempt 3**: Wait 4 seconds

**Retry behavior:**
- ✅ **Retries on**: Network errors, timeouts, 5xx server errors
- ❌ **Does not retry**: 4xx client errors (invalid request, unauthorized, etc.)

### Timeout Protection

Default timeout is 30 seconds. Requests that take longer will be aborted. You can configure this:

```yaml
with:
  timeout: '60000'  # 60 seconds
```

### Validation

The action validates:
- ✅ API key is present and valid format
- ✅ Running in pull request context (not push, schedule, etc.)
- ✅ All required GitHub context variables exist
- ✅ SHA matches expected format (40-character hex)
- ✅ Timeout and retry values are within acceptable ranges

## Troubleshooting

### Error: "This action must be run in a pull request context"

**Cause:** The action is triggered in a workflow that doesn't have pull request context.

**Solution:** Ensure your workflow uses:
```yaml
on:
  pull_request:
    types: [opened, synchronize]
```

**Note:** This error will show the current event type to help debugging:
```
This action must be run in a pull request context. Current event: push
```

---

### Error: "API key is invalid or missing"

**Cause:** The API key is empty, not provided, or doesn't meet minimum length requirements.

**Solutions:**
1. Verify the secret name matches in your workflow:
   ```yaml
   api-key: ${{ secrets.PEQY_API_KEY }}  # Check this name
   ```
2. Check the secret exists: Settings → Secrets and variables → Actions
3. Ensure the secret value is not empty
4. If the key is very short (< 32 chars), you'll get a warning

---

### Error: "Failed after 3 attempts"

**Cause:** All retry attempts exhausted due to persistent network/server errors.

**Solutions:**
1. Check if the API endpoint is accessible and responding
2. Verify the API URL is correct (check `api-url` input)
3. Check API service status/health
4. Review GitHub Actions status page for platform issues
5. Look at the error messages from each attempt in the logs

---

### Error: "API request failed with status 401"

**Cause:** Authentication failed - invalid or expired API key.

**Solutions:**
1. Regenerate the API key in your service
2. Update the secret in GitHub (Settings → Secrets and variables → Actions)
3. Ensure the API key has the correct permissions
4. Verify you're using the correct environment (staging vs production)

---

### Error: "API request failed with status 422"

**Cause:** The API rejected the request payload (validation error).

**Solutions:**
1. Check the API response in the action logs for details
2. Verify the API endpoint expects the exact payload format:
   ```json
   {"owner": "...", "repo": "...", "pr": 123, "sha": "..."}
   ```
3. Ensure your API accepts the PR number as an integer, not a string
4. Contact API support with the error details

---

### Warning: "API key seems shorter than expected"

**Cause:** API key is less than 32 characters.

**Solution:** This is just a warning. If your API keys are normally shorter, you can ignore it. Otherwise, verify you've copied the complete API key.

---

### Logs show `***` instead of values

**Cause:** This is expected! The action masks sensitive values to prevent leaks.

**Solution:** No action needed. This is a security feature. If you need to debug the payload structure, check the "API Request Details" group in the logs, which shows the payload structure (with masked secrets).

---

### Action succeeds but API doesn't receive data

**Possible causes:**
1. Wrong API URL - verify the `api-url` input
2. Firewall blocking GitHub Actions IPs
3. API expecting different authentication method

**Debug steps:**
1. Check the action outputs for the HTTP status code
2. Review your API server logs
3. Temporarily set up a request inspection service (like webhook.site) to verify the payload format

## Development

### Building the Action

After making changes to `index.js`, you must rebuild the action:

```bash
# Install dependencies
npm install

# Build the action (creates dist/index.js)
npm run build
```

**Important:** The `dist/` folder must be committed to the repository. GitHub Actions will use `dist/index.js`, not `index.js`.

### Testing

#### Quick Test (Against httpbin.org)
```bash
npm test
```

#### Test with Mock Server
```bash
# Terminal 1: Start mock server
npm run test:mock-server

# Terminal 2: Run action against mock
PEQY_API_URL="http://localhost:3000" npm test
```

#### Integration Tests
```bash
npm run test:integration
```

#### Test with act (GitHub Actions locally)
```bash
# Install act
brew install act  # macOS

# Run the action
act pull_request -s PEQY_API_KEY=your-test-key
```

#### Test with Real API
```bash
PEQY_API_URL="https://your-api.com/endpoint" \
PEQY_API_KEY="your-api-key" \
npm test
```

**📖 See [TESTING.md](TESTING.md) for comprehensive testing guide**

### Project Structure

```
action/
├── action.yml          # Action metadata
├── index.js            # Source code
├── package.json        # Dependencies
├── dist/
│   └── index.js       # Compiled code (committed)
├── test/
│   ├── local-test.js       # Local testing script
│   ├── mock-server.js      # Mock API server
│   └── integration-test.sh # Integration tests
├── .github/
│   └── workflows/
│       ├── ci.yml      # CI validation
│       ├── example.yml # Example usage
│       └── release.yml # Automated releases
├── README.md          # This file
├── TESTING.md         # Testing guide
└── LICENSE            # License information
```

## Versioning

This action follows [Semantic Versioning](https://semver.org/):

- **Major version (v1, v2)**: Breaking changes
- **Minor version (v1.1, v1.2)**: New features, backward compatible
- **Patch version (v1.0.1, v1.0.2)**: Bug fixes, backward compatible

### Recommended Version Pinning

**For development/testing:**
```yaml
uses: peqy/action@v1        # Latest v1.x.x (auto-updated)
```

**For production (most secure):**
```yaml
uses: peqy/action@a1b2c3d4e5f6...  # Specific commit SHA
```

**For production (balanced):**
```yaml
uses: peqy/action@v1.0.0    # Specific version
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run `npm run build` to compile
5. Commit your changes (include the `dist/` folder)
6. Push to your fork
7. Open a Pull Request

## License

See [LICENSE](LICENSE) file for details.

## Support

- 📖 [Documentation](https://github.com/peqy/action)
- 🐛 [Issue Tracker](https://github.com/peqy/action/issues)
- 💬 [Discussions](https://github.com/peqy/action/discussions)
