#!/usr/bin/env node

/**
 * Local test script for the Peqy GitHub Action
 *
 * This simulates the GitHub Actions environment locally.
 * Run with: node test/local-test.js
 */

// Mock GitHub Actions environment variables
// GitHub Actions converts input names to INPUT_<NAME> with hyphens replaced by underscores
process.env['INPUT_API-KEY'] = process.env.PEQY_API_KEY || 'test-api-key-at-least-32-characters-long-for-validation';
process.env['INPUT_API-URL'] = process.env.PEQY_API_URL || 'https://httpbin.org/post';
process.env['INPUT_TIMEOUT'] = '30000';
process.env['INPUT_MAX-RETRIES'] = '3';
process.env['INPUT_FAIL-ON-ERROR'] = 'true';

// Mock GitHub context - simulate a pull request event
process.env.GITHUB_EVENT_NAME = 'pull_request';
process.env.GITHUB_REPOSITORY = 'test-owner/test-repo';

// Create mock event payload
const mockEvent = {
  pull_request: {
    number: 123,
    head: {
      sha: 'abc123def456789012345678901234567890abcd'
    }
  },
  repository: {
    name: 'test-repo',
    owner: {
      login: 'test-owner'
    }
  }
};

process.env.GITHUB_EVENT_PATH = '/tmp/github-event.json';
const fs = require('fs');
fs.writeFileSync(process.env.GITHUB_EVENT_PATH, JSON.stringify(mockEvent));

console.log('🧪 Running Peqy GitHub Action locally...\n');
console.log('Environment:');
console.log('  API URL:', process.env['INPUT_API-URL']);
console.log('  API Key:', process.env['INPUT_API-KEY'].substring(0, 10) + '...');
console.log('  Timeout:', process.env['INPUT_TIMEOUT']);
console.log('  Max Retries:', process.env['INPUT_MAX-RETRIES']);
console.log('  Repository:', process.env.GITHUB_REPOSITORY);
console.log('  PR Number:', mockEvent.pull_request.number);
console.log('  SHA:', mockEvent.pull_request.head.sha);
console.log('\n---\n');

// Run the action
require('../index.js');

// Cleanup
setTimeout(() => {
  fs.unlinkSync(process.env.GITHUB_EVENT_PATH);
}, 2000);
