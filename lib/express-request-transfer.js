'use strict';

// we use super test as it's able to execute requests on an express app object
var crypto = require('crypto');
var request = require('supertest');

var TRANSFER_GUARD_HEADER = 'x-express-request-transfer';
var TRANSFER_GUARD_VALUE = crypto.randomBytes(32).toString('hex');
var DEFAULT_TRANSFER_TIMEOUT_MS = 30000;

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

function getTransferTimeoutMs() {
    var configuredTimeout = Number(process.env.EXPRESS_REQUEST_TRANSFER_TIMEOUT_MS);

    if (!isFinite(configuredTimeout) || configuredTimeout <= 0) {
        return DEFAULT_TRANSFER_TIMEOUT_MS;
    }

    return configuredTimeout;
}

function finishTransferWithError(res) {
    if (res.headersSent || res.finished || res.writableEnded) {
        if (!res.finished && !res.writableEnded) res.end();
        return;
    }

    res.status(500);
    res.send('Internal transfer failed');
}

// add req.transfer function to all requests object via express middleware
module.exports = function(req, res, next) {

    var expressApp = req.app;
    var currentMethod = String(req.method || 'GET').toLowerCase();
    var currentQueryParams = req.query || {};
    var currentFormParams = req.body || {};
    var currentHttpHeaders = req.headers || {};
    var isTransferredRequest = currentHttpHeaders[TRANSFER_GUARD_HEADER] === TRANSFER_GUARD_VALUE;

    /**
     * Transfers the current request to an internal route returning result to incoming request
     * @param {string} path - The URL path of the new page on the server to execute
     * @param {boolean} preserveData - true to preserve the QueryString and Form collections; false to clear the QueryString and Form collections
     */
    req.transfer = function(path, preserveData) {

        path = String(path || '').trim();

        if (path === '') throw new Error('Please provide a valid path');
        if (isTransferredRequest) {
            finishTransferWithError(res);
            return;
        }

        var transferRequest;

        try {
            // build an internal request
            transferRequest = request(expressApp)[currentMethod](path);
        } catch (error) {
            finishTransferWithError(res);
            return;
        }

        transferRequest.set(TRANSFER_GUARD_HEADER, TRANSFER_GUARD_VALUE);
        transferRequest.timeout(getTransferTimeoutMs());

        // pass along the data if needed
        if (preserveData) {
            transferRequest.query(currentQueryParams);
            transferRequest.set(getSafeRequestHeaders(currentHttpHeaders));
            transferRequest.send(currentFormParams);
        }

        // when request completes, pass data to response
        transferRequest.end(function(transferError, result) {
            // supertest reports 4xx/5xx as transferError but still provides a response
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
    }

    next();
};