#!/bin/bash

# Integration test script for Peqy GitHub Action
# This script runs the action against the mock server with different scenarios

set -e

echo "╔════════════════════════════════════════════════════════════╗"
echo "║     Peqy GitHub Action - Integration Tests                ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Function to run a test scenario
run_test() {
  local scenario=$1
  local expected_exit_code=$2
  local description=$3

  TESTS_RUN=$((TESTS_RUN + 1))
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Test $TESTS_RUN: $description"
  echo "Scenario: $scenario | Expected exit: $expected_exit_code"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Start mock server in background
  SCENARIO=$scenario PORT=3000 node test/mock-server.js > /tmp/mock-server-$scenario.log 2>&1 &
  local server_pid=$!

  # Wait for server to start
  sleep 2

  # Run the action
  set +e
  PEQY_API_URL="http://localhost:3000" \
  PEQY_API_KEY="test-api-key-at-least-32-characters-long" \
  node test/local-test.js > /tmp/test-$scenario.log 2>&1
  local exit_code=$?
  set -e

  # Stop mock server
  kill $server_pid 2>/dev/null || true
  wait $server_pid 2>/dev/null || true

  # Check result
  if [ $exit_code -eq $expected_exit_code ]; then
    echo -e "${GREEN}✓ PASSED${NC} (exit code: $exit_code)"
    TESTS_PASSED=$((TESTS_PASSED + 1))
  else
    echo -e "${RED}✗ FAILED${NC} (expected: $expected_exit_code, got: $exit_code)"
    TESTS_FAILED=$((TESTS_FAILED + 1))
    echo "--- Test Output ---"
    tail -20 /tmp/test-$scenario.log
    echo "--- Server Output ---"
    tail -20 /tmp/mock-server-$scenario.log
  fi
}

# Run tests
echo "Starting integration tests..."
echo ""

run_test "success" 0 "Success scenario (200 OK)"
run_test "created" 0 "Created scenario (201 Created)"
run_test "unauthorized" 1 "Unauthorized scenario (401)"
run_test "badRequest" 1 "Bad request scenario (400)"
run_test "serverError" 1 "Server error with retries (500)"

# Summary
echo ""
echo "╔════════════════════════════════════════════════════════════╗"
echo "║                    Test Summary                            ║"
echo "╚════════════════════════════════════════════════════════════╝"
echo ""
echo "  Total:  $TESTS_RUN"
echo -e "  ${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "  ${RED}Failed: $TESTS_FAILED${NC}"
echo ""

# Cleanup
rm -f /tmp/test-*.log /tmp/mock-server-*.log 2>/dev/null || true

if [ $TESTS_FAILED -gt 0 ]; then
  echo -e "${RED}Some tests failed!${NC}"
  exit 1
else
  echo -e "${GREEN}All tests passed!${NC}"
  exit 0
fi
