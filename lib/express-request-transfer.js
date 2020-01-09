'use strict';

// we use super test as it's able to execute requests on an express app object
var request = require('supertest');

// add req.transfer function to all requests object via express middleware
module.exports = function(req, res, next) {

    var expressApp = req.app;
    var currentMethod = String(req.method || 'GET').toLowerCase();
    var currentQueryParams = req.query || {};
    var currentFormParams = req.body || {};
    var currentHttpHeaders = req.headers || {};

    /**
     * Transfers the current request to an internal route returning result to incoming request
     * @param {string} path - The URL path of the new page on the server to execute
     * @param {boolean} preserveData - true to preserve the QueryString and Form collections; false to clear the QueryString and Form collections
     */
    req.transfer = function(path, preserveData) {

        path = String(path || '').trim();

        if (path === '') throw new Error('Please provide a valid path');

        // build an internal request
        var transferRequest = request(expressApp)[currentMethod](path);

        // pass along the data if needed
        if (preserveData) {
            transferRequest.query(currentQueryParams);
            transferRequest.set(currentHttpHeaders);
            transferRequest.send(currentFormParams);
        }

        // return result to client
        transferRequest.pipe(res);
    }

    next();
};