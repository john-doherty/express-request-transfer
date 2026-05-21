var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

describe('express-request-transfer (headers)', function () {

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

    it('should only forward safe request headers when preserving data', function (done) {

        app.get('/internal', function(req, res){
            expect(req.headers.authorization).toEqual('Bearer token');
            expect(req.headers['proxy-authorization']).toEqual('Basic YTpi');
            expect(req.headers.cookie).toEqual('sid=123');
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
            .set('proxy-authorization', 'Basic YTpi')
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

    it('should forward original host context for internal transfers', function (done) {

        app.get('/internal', function(req, res){
            expect(req.headers['x-forwarded-proto']).toEqual('http');
            expect(req.headers['x-forwarded-host']).toEqual('localhost');
            expect(req.headers['x-forwarded-port']).toEqual('4567');

            res.status(200);
            res.send('ok');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .set('host', 'localhost:4567')
            .then(function(res) {
                expect(res.statusCode).toEqual(200);
                expect(res.text).toEqual('ok');
                done();
            });
    });

    it('should normalize forwarded host header values that include a port', function (done) {

        app.get('/internal', function(req, res){
            expect(req.headers['x-forwarded-proto']).toEqual('https');
            expect(req.headers['x-forwarded-host']).toEqual('public.example.com');
            expect(req.headers['x-forwarded-port']).toEqual('8443');

            res.status(200);
            res.send('ok');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .set('host', '127.0.0.1:3000')
            .set('x-forwarded-proto', 'https,http')
            .set('x-forwarded-host', 'public.example.com:8443, internal.proxy.local')
            .then(function(res) {
                expect(res.statusCode).toEqual(200);
                expect(res.text).toEqual('ok');
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
});
