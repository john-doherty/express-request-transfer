'use strict';

// we use super test as it's able to execute requests on an express app object
var crypto = require('crypto');
var request = require('supertest');

var TRANSFER_GUARD_HEADER = 'x-express-request-transfer';
var TRANSFER_GUARD_VALUE = crypto.randomBytes(32).toString('hex');
var DEFAULT_TRANSFER_TIMEOUT_MS = 30000;
var TRANSFER_ERROR_MESSAGE = 'Internal transfer failed';
var INVALID_PATH_ERROR_MESSAGE = 'Please provide a valid path';

var BLOCKED_REQUEST_HEADERS = {
    'connection': true,
    'keep-alive': true,
    'te': true,
    'trailer': true,
    'transfer-encoding': true,
    'upgrade': true,
    'content-length': true,
    'host': true,
    'set-cookie': true,
    'set-cookie2': true,
    'x-express-request-transfer': true
};

var BLOCKED_RESPONSE_HEADERS = {
    'connection': true,
    'keep-alive': true,
    'proxy-authenticate': true,
    'proxy-authorization': true,
    'te': true,
    'trailer': true,
    'transfer-encoding': true,
    'upgrade': true,
    'content-length': true
};

/**
 * Returns request headers that are safe to forward to the internal transfer.
 * @param {Object<string, string>} headers
 * @returns {Object<string, string>}
 */
function getSafeRequestHeaders(headers) {
    var safeHeaders = {};

    Object.keys(headers || {}).forEach(function(name) {
        var lowerName = String(name || '').toLowerCase();

        if (!BLOCKED_REQUEST_HEADERS[lowerName]) {
            safeHeaders[name] = headers[name];
        }
    });

    return safeHeaders;
}

/**
 * Builds a lookup map of headers referenced by the Connection header.
 * Any headers listed there should not be forwarded in the response.
 * @param {Object<string, string>} headers
 * @returns {Object<string, boolean>}
 */
function getBlockedConnectionHeaders(headers) {
    var blocked = {};
    var connection = headers && headers.connection;

    if (!connection) return blocked;

    String(connection).split(',').forEach(function(name) {
        var lowerName = String(name || '').trim().toLowerCase();
        if (lowerName !== '') blocked[lowerName] = true;
    });

    return blocked;
}

/**
 * Returns response headers that are safe to send back to the client.
 * @param {Object<string, string>} headers
 * @returns {Object<string, string>}
 */
function getSafeResponseHeaders(headers) {
    var safeHeaders = {};
    var connectionBlockedHeaders = getBlockedConnectionHeaders(headers);

    Object.keys(headers || {}).forEach(function(name) {
        var lowerName = String(name || '').toLowerCase();

        if (BLOCKED_RESPONSE_HEADERS[lowerName]) return;
        if (connectionBlockedHeaders[lowerName]) return;

        safeHeaders[name] = headers[name];
    });

    return safeHeaders;
}

/**
 * Returns first value from a potentially comma-separated header.
 * @param {string|undefined} value
 * @returns {string}
 */
function getFirstHeaderValue(value) {
    return String(value || '').split(',')[0].trim();
}

/**
 * Splits a host header into host and optional port parts.
 * Supports IPv4, hostname, and bracketed IPv6 host values.
 * @param {string|undefined} hostHeader
 * @returns {{host: string, port: string}}
 */
function parseHostHeader(hostHeader) {
    var value = String(hostHeader || '').trim();
    var host = value;
    var port = '';

    if (host === '') {
        return { host: '', port: '' };
    }

    // Bracketed IPv6 host: [::1]:3000
    if (host.charAt(0) === '[') {
        var closingBracketIndex = host.indexOf(']');

        if (closingBracketIndex !== -1) {
            var remainder = host.slice(closingBracketIndex + 1);
            if (remainder.charAt(0) === ':') {
                port = remainder.slice(1);
            }

            host = host.slice(0, closingBracketIndex + 1);
            return { host: host, port: port };
        }
    }

    // hostname:port or ipv4:port
    var firstColonIndex = host.indexOf(':');
    var lastColonIndex = host.lastIndexOf(':');

    if (firstColonIndex !== -1 && firstColonIndex === lastColonIndex) {
        port = host.slice(lastColonIndex + 1);
        host = host.slice(0, lastColonIndex);
    }

    return { host: host, port: port };
}

/**
 * Builds forwarding headers so internal routes can resolve the original
 * public-facing host/protocol/port instead of supertest defaults.
 * @param {{headers?: Object<string, string>, protocol?: string}} req
 * @returns {Object<string, string>}
 */
function getForwardingHeaders(req) {
    var headers = req && req.headers ? req.headers : {};
    var forwardedHeaders = {};
    var forwardedHostHeaderValue = getFirstHeaderValue(headers['x-forwarded-host']);
    var forwardedHostParts = parseHostHeader(forwardedHostHeaderValue);
    var hostParts = parseHostHeader(headers.host);
    var proto = getFirstHeaderValue(headers['x-forwarded-proto']) || String(req.protocol || '');
    var host = forwardedHostParts.host || hostParts.host;
    var port = getFirstHeaderValue(headers['x-forwarded-port']) || forwardedHostParts.port || hostParts.port;

    if (proto !== '') forwardedHeaders['x-forwarded-proto'] = proto;
    if (host !== '') forwardedHeaders['x-forwarded-host'] = host;
    if (port !== '') forwardedHeaders['x-forwarded-port'] = port;

    return forwardedHeaders;
}

/**
 * Chooses the correct response body value based on content type.
 * JSON payloads should use result.body, while text responses use result.text.
 * @param {{headers: Object<string, string>, body: any, text: string}} result
 * @returns {*}
 */
function getResponseBody(result) {
    var headers = result && result.headers ? result.headers : {};
    var contentType = String(headers['content-type'] || '').toLowerCase();

    if (contentType.indexOf('application/json') !== -1 || contentType.indexOf('+json') !== -1) {
        return result.body;
    }

    if (typeof result.text !== 'undefined') {
        return result.text;
    }

    return result.body;
}

/**
 * Reads timeout from environment with a safe fallback.
 * @returns {number}
 */
function getTransferTimeoutMs() {
    var configuredTimeout = Number(process.env.EXPRESS_REQUEST_TRANSFER_TIMEOUT_MS);

    if (!isFinite(configuredTimeout) || configuredTimeout <= 0) {
        return DEFAULT_TRANSFER_TIMEOUT_MS;
    }

    return configuredTimeout;
}

/**
 * Returns true when a transfer path looks like an absolute/protocol-relative URL.
 * Transfers must only target internal routes on the current Express app.
 * @param {string} path
 * @returns {boolean}
 */
function isDisallowedTransferPath(path) {
    return /^([a-z][a-z0-9+\-.]*:)?\/\//i.test(String(path || ''));
}

/**
 * Completes the outer response with a generic transfer failure.
 * If the response already started, this only ensures it is ended cleanly.
 * @param {import('express').Response} res
 */
function finishTransferWithError(res) {
    if (res.headersSent || res.finished || res.writableEnded) {
        if (!res.finished && !res.writableEnded) res.end();
        return;
    }

    res.status(500);
    res.send(TRANSFER_ERROR_MESSAGE);
}

// add req.transfer function to all requests object via express middleware
module.exports = function(req, res, next) {

    var expressApp = req.app;
    var requestMethod = String(req.method || 'GET').toLowerCase();
    var requestQuery = req.query || {};
    var requestBody = req.body || {};
    var requestHeaders = req.headers || {};
    var isTransferredRequest = requestHeaders[TRANSFER_GUARD_HEADER] === TRANSFER_GUARD_VALUE;

    /**
     * Transfers the current request to an internal route returning result to incoming request
     * @param {string} path - The URL path of the new page on the server to execute
     * @param {boolean} preserveData - true to preserve the QueryString and Form collections; false to clear the QueryString and Form collections
     */
    req.transfer = function(path, preserveData) {

        path = String(path || '').trim();

        if (path === '' || isDisallowedTransferPath(path)) {
            throw new Error(INVALID_PATH_ERROR_MESSAGE);
        }

        // Prevent recursive transfer chains.
        if (isTransferredRequest) {
            finishTransferWithError(res);
            return;
        }

        // Step 1: build an internal request against this express app.
        var transferRequest;
        try {
            transferRequest = request(expressApp)[requestMethod](path);
        } catch (error) {
            finishTransferWithError(res);
            return;
        }

        // Step 2: mark as internal transfer and apply timeout.
        transferRequest.set(TRANSFER_GUARD_HEADER, TRANSFER_GUARD_VALUE);
        transferRequest.set(getForwardingHeaders(req));
        transferRequest.timeout(getTransferTimeoutMs());

        // Step 3: optionally preserve original query/body/headers.
        if (preserveData) {
            transferRequest.query(requestQuery);
            transferRequest.set(getSafeRequestHeaders(requestHeaders));
            transferRequest.send(requestBody);
        }

        // Step 4: execute internal route and mirror result to the client.
        transferRequest.end(function(transferError, result) {
            // supertest reports 4xx/5xx as transferError but still provides a response.
            if (result) {
                try {
                    res.set(getSafeResponseHeaders(result.headers));
                    res.status(result.status);

                    var body = getResponseBody(result);

                    if (typeof body === 'undefined' || body === null) {
                        res.end();
                        return;
                    }

                    res.send(body);
                } catch (error) {
                    finishTransferWithError(res);
                }

                return;
            }

            if (transferError) {
                finishTransferWithError(res);
                return;
            }

            finishTransferWithError(res);
        });
    };

    next();
};