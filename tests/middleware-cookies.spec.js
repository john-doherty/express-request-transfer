var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;
var COOKIE_SECRET = 'transfer-test-secret';

describe('express-request-transfer (cookies)', function () {

    // before each test
    beforeEach(function () {

        // create a new express app before each test to avoid controller collision
        app = express();

        // parse application/json
        app.use(bodyParser.json())

        // parse application/x-www-form-urlencoded
        app.use(bodyParser.urlencoded({ extended: true }))

        // parse cookies (including signed cookies) for downstream route assertions
        app.use(cookieParser(COOKIE_SECRET));

        // add middleware
        app.use(requestTransfer);
    });

    // after each test
    afterEach(function () {
        app = null;
    });

    it('should forward a single set-cookie header to the client', function (done) {

        app.get('/internal', function(req, res){
            res.cookie('session_id', 'abc123', {
                httpOnly: true,
                sameSite: 'lax'
            });
            res.status(200);
            res.send('ok');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                var setCookie = res.headers['set-cookie'] || [];

                expect(res.statusCode).toEqual(200);
                expect(Array.isArray(setCookie)).toEqual(true);
                expect(setCookie.length).toEqual(1);
                expect(setCookie[0]).toContain('session_id=abc123');
                expect(setCookie[0]).toContain('HttpOnly');
                expect(setCookie[0]).toContain('SameSite=Lax');
                done();
            });
    });

    it('should forward multiple set-cookie headers to the client', function (done) {

        app.get('/internal', function(req, res){
            res.cookie('cookie_a', 'one');
            res.cookie('cookie_b', 'two', { httpOnly: true });
            res.status(200);
            res.send('ok');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                var setCookie = res.headers['set-cookie'] || [];
                var joined = setCookie.join('\n');

                expect(res.statusCode).toEqual(200);
                expect(Array.isArray(setCookie)).toEqual(true);
                expect(setCookie.length).toEqual(2);
                expect(joined).toContain('cookie_a=one');
                expect(joined).toContain('cookie_b=two');
                expect(joined).toContain('HttpOnly');
                done();
            });
    });

    it('should forward clearCookie headers with security attributes', function (done) {

        app.get('/internal', function(req, res){
            res.clearCookie('form_access', {
                signed: true,
                httpOnly: true,
                sameSite: 'lax',
                secure: true
            });
            res.status(200);
            res.send('cleared');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                var setCookie = res.headers['set-cookie'] || [];
                var cookieHeader = setCookie[0] || '';

                expect(res.statusCode).toEqual(200);
                expect(setCookie.length).toEqual(1);
                expect(cookieHeader).toContain('form_access=');
                expect(cookieHeader).toContain('Expires=');
                expect(cookieHeader).toContain('HttpOnly');
                expect(cookieHeader).toContain('Secure');
                expect(cookieHeader).toContain('SameSite=Lax');
                done();
            });
    });

    it('should forward cookies when preserveData is true', function (done) {

        app.post('/internal', function(req, res){
            expect(req.body.user).toEqual('buzz');
            res.cookie('flow', 'preserved', { sameSite: 'lax' });
            res.status(200);
            res.send('ok');
        });

        app.post('/external', function(req, res){
            req.transfer('/internal', true);
        });

        request(app)
            .post('/external')
            .type('form')
            .send({ user: 'buzz' })
            .then(function(res) {
                var setCookie = res.headers['set-cookie'] || [];

                expect(res.statusCode).toEqual(200);
                expect(setCookie.length).toEqual(1);
                expect(setCookie[0]).toContain('flow=preserved');
                expect(setCookie[0]).toContain('SameSite=Lax');
                done();
            });
    });

    it('should preserve signed cookies for destination routes when preserving data', function (done) {

        var agent = request.agent(app);

        app.get('/seed', function(req, res){
            res.cookie('form_access', 'granted', {
                signed: true,
                httpOnly: true,
                sameSite: 'lax'
            });
            res.status(204);
            res.end();
        });

        app.get('/internal', function(req, res){
            expect(req.signedCookies).toBeDefined();
            expect(req.signedCookies.form_access).toEqual('granted');

            res.status(200);
            res.send('ok');
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', true);
        });

        agent
            .get('/seed')
            .then(function(seedRes) {
                expect(seedRes.statusCode).toEqual(204);
                return agent.get('/external');
            })
            .then(function(res) {
                expect(res.statusCode).toEqual(200);
                expect(res.text).toEqual('ok');
                done();
            }, done);
    });
});
