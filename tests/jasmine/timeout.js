/**
 * Sets the default timeout interval for Jasmine tests.
 *
 * Jasmine v5 and above does not allow setting the default timeout via CLI or config files,
 * so we must set it programmatically. This ensures that asynchronous tests have enough time
 * to complete before Jasmine considers them as timed out.
 */
// jasmine/timeout.js
jasmine.DEFAULT_TIMEOUT_INTERVAL = 30000;