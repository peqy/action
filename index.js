const core = require('@actions/core');
const github = require('@actions/github');
const { HttpClient } = require('@actions/http-client');

/**
 * Sleep for a specified duration
 * @param {number} ms - Milliseconds to sleep
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validate API key format
 * @param {string} apiKey - API key to validate
 * @returns {boolean} - Whether the API key is valid
 */
function validateApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length === 0) {
    return false;
  }

  // API key should be at least 32 characters (adjust based on your requirements)
  if (apiKey.length < 32) {
    core.warning('API key seems shorter than expected (< 32 characters)');
  }

  return true;
}

/**
 * Validate SHA format
 * @param {string} sha - Git SHA to validate
 * @returns {boolean} - Whether the SHA is valid
 */
function validateSha(sha) {
  const shaRegex = /^[0-9a-f]{40}$/;
  return shaRegex.test(sha);
}

/**
 * Make API request with retry logic
 * @param {string} url - API endpoint URL
 * @param {string} apiKey - API key for authentication
 * @param {object} payload - Request payload
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} timeout - Request timeout in milliseconds
 * @returns {Promise<object>} - Response object with status and body
 */
async function makeApiRequest(url, apiKey, payload, maxRetries, timeout) {
  const http = new HttpClient('peqy-github-action', undefined, {
    allowRetries: false, // We'll implement our own retry logic
    maxRetries: 0,
    socketTimeout: timeout
  });

  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      core.info(`🔄 Attempt ${attempt} of ${maxRetries}`);

      const headers = {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'User-Agent': 'peqy-github-action/1.0'
      };

      core.startGroup('📤 API Request');
      core.info(`URL: ${url}`);
      core.info(`Payload: ${JSON.stringify(payload, null, 2)}`);
      core.endGroup();

      const response = await http.post(url, JSON.stringify(payload), headers);
      const body = await response.readBody();
      const statusCode = response.message.statusCode;

      core.startGroup('📥 API Response');
      core.info(`Status: ${statusCode}`);
      core.info(`Body: ${body}`);
      core.endGroup();

      // Success - return response
      if (statusCode >= 200 && statusCode < 300) {
        core.info('✓ Peqy review triggered successfully');
        return {
          success: true,
          statusCode,
          body
        };
      }

      // Client error (4xx) - don't retry
      if (statusCode >= 400 && statusCode < 500) {
        core.warning(`⚠️ Client error (${statusCode}) - will not retry`);
        return {
          success: false,
          statusCode,
          body
        };
      }

      // Server error (5xx) - retry
      if (statusCode >= 500) {
        lastError = new Error(`Server error (HTTP ${statusCode}): ${body}`);
        core.warning(`⚠️ Server error (${statusCode}) on attempt ${attempt} - will retry`);
      }

    } catch (error) {
      lastError = error;
      core.warning(`Request failed on attempt ${attempt}: ${error.message}`);
    }

    // If not the last attempt, wait before retrying with exponential backoff
    if (attempt < maxRetries) {
      const backoffSeconds = Math.pow(2, attempt);
      core.info(`⏱️ Waiting ${backoffSeconds} seconds before retry...`);
      await sleep(backoffSeconds * 1000);
    }
  }

  // All retries exhausted
  throw new Error(`Failed after ${maxRetries} attempts. Last error: ${lastError.message}`);
}

/**
 * Main action execution
 */
async function run() {
  try {
    // Get inputs
    const apiKey = core.getInput('api-key', { required: true });
    const apiUrl = core.getInput('api-url', { required: false }) || 'https://demo.peqy.ai/api/v1/checks/trigger';
    const timeout = parseInt(core.getInput('timeout', { required: false }) || '30000', 10);
    const maxRetries = parseInt(core.getInput('max-retries', { required: false }) || '3', 10);
    const failOnError = core.getInput('fail-on-error', { required: false }) !== 'false';

    // Secret masking is automatic for inputs marked as secrets, but we'll be explicit
    core.setSecret(apiKey);

    // Validate inputs
    core.startGroup('🔍 Validating Inputs');

    if (!validateApiKey(apiKey)) {
      throw new Error('API key is invalid or missing');
    }
    core.info('✅ API key format validated');

    if (maxRetries < 1 || maxRetries > 5) {
      throw new Error('max-retries must be between 1 and 5');
    }
    core.info(`✅ Max retries: ${maxRetries}`);

    if (timeout < 1000 || timeout > 300000) {
      throw new Error('timeout must be between 1000ms (1s) and 300000ms (5min)');
    }
    core.info(`✅ Timeout: ${timeout}ms`);

    core.endGroup();

    // Validate GitHub context
    core.startGroup('🔍 Validating GitHub Context');

    const context = github.context;

    if (!context.payload.pull_request) {
      throw new Error(
        'This action must be run in a pull request context. ' +
        `Current event: ${context.eventName}`
      );
    }
    core.info('✅ Pull request context detected');

    const prNumber = context.payload.pull_request.number;
    const prSha = context.payload.pull_request.head.sha;
    const repoOwner = context.repo.owner;
    const repoName = context.repo.repo;

    if (!prNumber || !prSha || !repoOwner || !repoName) {
      throw new Error('Required GitHub context variables are missing');
    }
    core.info(`✅ Repository: ${repoOwner}/${repoName}`);
    core.info(`✅ PR Number: ${prNumber}`);
    core.info(`✅ SHA: ${prSha}`);

    if (!validateSha(prSha)) {
      throw new Error(`Invalid SHA format: ${prSha}`);
    }
    core.info('✅ SHA format validated');

    core.endGroup();

    // Prepare payload
    const payload = {
      owner: repoOwner,
      repo: repoName,
      pr: prNumber,
      sha: prSha
    };

    // Make API request
    core.info(`🚀 Triggering Peqy review for PR #${prNumber}`);

    const result = await makeApiRequest(apiUrl, apiKey, payload, maxRetries, timeout);

    // Set outputs
    core.setOutput('status-code', result.statusCode.toString());
    core.setOutput('response', result.body);
    core.setOutput('success', result.success.toString());

    // Handle failure if needed
    if (!result.success) {
      const statusName = result.statusCode === 404 ? 'Not Found' :
                        result.statusCode === 401 ? 'Unauthorized' :
                        result.statusCode === 403 ? 'Forbidden' :
                        result.statusCode === 400 ? 'Bad Request' :
                        result.statusCode === 422 ? 'Unprocessable Entity' :
                        'Client Error';

      core.startGroup(`❌ Request Failed`);
      core.error(`Status: ${result.statusCode} (${statusName})`);
      core.error(`Response: ${result.body}`);
      if (result.statusCode >= 400 && result.statusCode < 500) {
        core.error(`💡 4xx errors indicate client issues and are not retried`);
      }
      core.endGroup();

      if (failOnError) {
        throw new Error(`API request failed with status ${result.statusCode}`);
      } else {
        core.warning('Continuing despite API failure (fail-on-error is false)');
      }
    } else {
      core.info('✅ Action completed successfully');
    }

  } catch (error) {
    core.setFailed(error.message);

    // Set outputs even on failure for debugging
    core.setOutput('success', 'false');

    // Add additional error context
    core.startGroup('🔍 Error Details');
    core.error(error.message);
    if (error.stack) {
      core.debug(error.stack);
    }
    core.endGroup();
  }
}

run();
