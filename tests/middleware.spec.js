var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

describe('express-request-transfer', function () {

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

    it('should add .transfer to request object', function (done) {

        app.get('/test', function(req, res){
            expect(req.transfer).toBeDefined();
            done()
        });

        request(app).get('/test').end();
    });

    it('should transfer form variables', function (done) {

        var field1 = String(new Date().getTime());
        var field2 = String(field1 *1000);

        app.post('/internal', function(req, res){
            expect(req.body.field1).toEqual(field1);
            expect(req.body.field2).toEqual(field2);
            done()
        });

        app.post('/external', function(req, res){
            req.transfer('/internal', true); 
        });

        request(app)
            .post('/external')
            .type('form')
            .send({ field1: field1 })
            .send({ field2: field2 })
            .end();
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

    it('should only forward safe request headers when preserving data', function (done) {

        app.get('/internal', function(req, res){
            expect(req.headers.authorization).toBeUndefined();
            expect(req.headers.cookie).toBeUndefined();
            expect(req.headers['x-custom-header']).toEqual('custom-value');
            expect(req.headers['accept-language']).toEqual('en-GB');
            expect(req.headers['x-request-id']).toEqual('abc-123');

            res.set('x-safe-response-header', 'true');
            res.status(200);
            res.send('ok');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', true);
        });

        request(app)
            .get('/external')
            .set('authorization', 'Bearer token')
            .set('cookie', 'sid=123')
            .set('x-custom-header', 'custom-value')
            .set('accept-language', 'en-GB')
            .set('x-request-id', 'abc-123')
            .then(function(res) {
                expect(res.statusCode).toEqual(200);
                expect(res.get('x-safe-response-header')).toEqual('true');
                done();
            });
    });

    it('should not trust client transfer guard headers', function (done) {

        app.get('/internal', function(req, res){
            res.status(200);
            res.send('ok');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .set('x-express-request-transfer', '1')
            .then(function(res) {
                expect(res.statusCode).toEqual(200);
                expect(res.text).toEqual('ok');
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

    it('should transfer empty responses', function (done) {

        app.get('/internal', function(req, res){
            res.status(204);
            res.end();
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(204);
                expect(res.text).toEqual('');
                done();
            });
    });
});