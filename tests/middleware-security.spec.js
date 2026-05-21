var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

describe('express-request-transfer (security)', function () {

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

    it('should reject absolute transfer URLs', function (done) {

        app.get('/external', function(req, res){
            var thrownError = null;

            try {
                req.transfer('https://example.com/internal', true);
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

    it('should reject protocol-relative transfer URLs', function (done) {

        app.get('/external', function(req, res){
            var thrownError = null;

            try {
                req.transfer('//example.com/internal', true);
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
});
