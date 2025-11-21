#!/usr/bin/env node

/**
 * Mock API server for testing Peqy GitHub Action
 *
 * This creates a local HTTP server that simulates the Peqy API endpoint.
 * Run with: node test/mock-server.js
 */

const http = require('http');

const PORT = process.env.PORT || 3000;

// Configuration for different test scenarios
const scenarios = {
  success: { status: 200, body: { status: 'success', message: 'Review queued' } },
  created: { status: 201, body: { status: 'created', reviewId: '12345' } },
  badRequest: { status: 400, body: { error: 'Invalid request payload' } },
  unauthorized: { status: 401, body: { error: 'Invalid API key' } },
  forbidden: { status: 403, body: { error: 'Insufficient permissions' } },
  notFound: { status: 404, body: { error: 'Endpoint not found' } },
  unprocessable: { status: 422, body: { error: 'Validation failed', details: ['PR number is required'] } },
  serverError: { status: 500, body: { error: 'Internal server error' } },
  timeout: { status: 200, body: { status: 'success' }, delay: 35000 }, // Simulates timeout
};

// Choose scenario via environment variable
const scenarioName = process.env.SCENARIO || 'success';
const scenario = scenarios[scenarioName] || scenarios.success;

const server = http.createServer(async (req, res) => {
  const timestamp = new Date().toISOString();

  console.log(`\n[${timestamp}] ${req.method} ${req.url}`);
  console.log('Headers:', JSON.stringify(req.headers, null, 2));

  // Read request body
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });

  req.on('end', async () => {
    if (body) {
      try {
        const payload = JSON.parse(body);
        console.log('Payload:', JSON.stringify(payload, null, 2));

        // Validate expected payload structure
        if (!payload.owner || !payload.repo || !payload.pr || !payload.sha) {
          console.log('⚠️  Warning: Payload missing required fields');
        } else {
          console.log('✓ Payload structure valid');
        }

        // Validate API key header
        const apiKey = req.headers['x-api-key'];
        if (!apiKey) {
          console.log('⚠️  Warning: Missing X-API-Key header');
        } else {
          console.log(`✓ API Key received: ${apiKey.substring(0, 10)}...`);
        }
      } catch (err) {
        console.log('⚠️  Invalid JSON:', err.message);
      }
    }

    // Simulate delay if specified
    if (scenario.delay) {
      console.log(`⏱️  Simulating ${scenario.delay}ms delay...`);
      await new Promise(resolve => setTimeout(resolve, scenario.delay));
    }

    // Send response
    console.log(`📤 Responding with ${scenario.status}`);
    res.writeHead(scenario.status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(scenario.body));
  });
});

server.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║        Peqy Mock API Server - Running                      ║
╚════════════════════════════════════════════════════════════╝

  📍 URL:      http://localhost:${PORT}
  🎭 Scenario: ${scenarioName}
  📊 Status:   ${scenario.status}

  Available scenarios (set with SCENARIO env var):
    • success        - 200 OK (default)
    • created        - 201 Created
    • badRequest     - 400 Bad Request
    • unauthorized   - 401 Unauthorized
    • forbidden      - 403 Forbidden
    • notFound       - 404 Not Found
    • unprocessable  - 422 Unprocessable Entity
    • serverError    - 500 Internal Server Error
    • timeout        - 200 OK (after 35s delay)

  Example: SCENARIO=unauthorized node test/mock-server.js

  Waiting for requests...
  `);
});

process.on('SIGINT', () => {
  console.log('\n\n👋 Shutting down mock server...');
  server.close();
  process.exit(0);
});
