var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

describe('express-request-transfer (json)', function () {

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

    it('should transfer json responses', function (done) {

        var headerName = 'x-test-header';
        var headerValue = String(new Date().getTime());
        var status = 409;
        var body = { firstName: 'Buzz', lastName: 'Lightyear' };

        app.get('/internal', function(req, res){
            res.set(headerName, headerValue);
            res.status(status);
            res.send(body);
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', true);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(status)
                expect(res.get(headerName)).toEqual(headerValue);
                expect(res.body).toEqual(body);
                done()
            });
    });

    it('should transfer +json responses', function (done) {

        var status = 422;
        var body = { code: 'problem', message: 'Validation failed' };

        app.get('/internal', function(req, res){
            res.type('application/problem+json');
            res.status(status);
            res.send(body);
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(status);
                expect(res.body).toEqual(body);
                done();
            });
    });
});
