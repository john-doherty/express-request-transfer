var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

describe('express-request-transfer (failure)', function () {

    // before each test
    beforeEach(function () {

        // create a new express app before each test to avoid controller collision
        app = express();

        // parse application/json
        app.use(bodyParser.json())

        // parse application/x-www-form-urlencoded
        app.use(bodyParser.urlencoded({ extended: true }))

        // add middleware
        app.use(requestTransfer);
    });

    // after each test
    afterEach(function () {
        app = null;
    });

    it('should complete outer request on internal route errors', function (done) {

        app.get('/internal', function(req, res){
            throw new Error('Internal failure');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(500);
                expect(res.text.length > 0).toEqual(true);
                done();
            });
    });

    it('should prevent infinite transfer loops', function (done) {

        app.get('/loop', function(req, res){
            req.transfer('/loop', false);
        });

        request(app)
            .get('/loop')
            .then(function(res) {
                expect(res.statusCode).toEqual(500);
                expect(res.text).toEqual('Internal transfer failed');
                done();
            });
    });

    it('should block second-hop transfers', function (done) {

        app.get('/target', function(req, res){
            res.status(200);
            res.send('ok');
        });

        app.get('/hop1', function(req, res){
            req.transfer('/target', false);
        });

        app.get('/hop0', function(req, res){
            req.transfer('/hop1', false);
        });

        request(app)
            .get('/hop0')
            .then(function(res) {
                expect(res.statusCode).toEqual(500);
                expect(res.text).toEqual('Internal transfer failed');
                done();
            });
    });

    it('should throw on invalid transfer paths', function (done) {

        app.get('/external', function(req, res){
            var thrownError = null;

            try {
                req.transfer('   ', false);
            } catch (error) {
                thrownError = error;
            }

            expect(thrownError).toBeDefined();
            expect(thrownError.message).toEqual('Please provide a valid path');

            res.status(204);
            res.end();
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(204);
                done();
            });
    });

    it('should fail fast on timed out internal transfers', function (done) {

        var previousTimeout = process.env.EXPRESS_REQUEST_TRANSFER_TIMEOUT_MS;
        process.env.EXPRESS_REQUEST_TRANSFER_TIMEOUT_MS = '25';

        function restoreTimeout() {
            if (typeof previousTimeout === 'undefined') {
                delete process.env.EXPRESS_REQUEST_TRANSFER_TIMEOUT_MS;
                return;
            }

            process.env.EXPRESS_REQUEST_TRANSFER_TIMEOUT_MS = previousTimeout;
        }

        app.get('/internal', function(req, res){
            // intentionally left open to trigger transfer timeout
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(500);
                expect(res.text).toEqual('Internal transfer failed');
                restoreTimeout();
                done();
            }, function(error) {
                restoreTimeout();
                done(error);
            });
    });
});
