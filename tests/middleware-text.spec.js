var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

describe('express-request-transfer (text)', function () {

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

    it('should transfer html text responses', function (done) {

        var body = '<h1>Hello from transfer</h1>';

        app.get('/internal', function(req, res){
            res.status(202);
            res.type('html');
            res.send(body);
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', true);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(202);
                expect(res.text).toEqual(body);
                done();
            });
    });
});
