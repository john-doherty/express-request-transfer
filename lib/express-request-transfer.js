'use strict';

// we use super test as it's able to execute requests on an express app object
var crypto = require('crypto');
var request = require('supertest');

var TRANSFER_GUARD_HEADER = 'x-express-request-transfer';
var TRANSFER_GUARD_VALUE = crypto.randomBytes(32).toString('hex');
var DEFAULT_TRANSFER_TIMEOUT_MS = 30000;
var TRANSFER_ERROR_MESSAGE = 'Internal transfer failed';

var BLOCKED_REQUEST_HEADERS = {
    'authorization': true,
    'cookie': true,
    'proxy-authorization': true,
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

        if (path === '') throw new Error('Please provide a valid path');

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