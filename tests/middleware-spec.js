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

        return request(app).get('/test').end();
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

        return request(app)
            .post('/external')
            .type('form')
            .send({ field1: field1 })
            .send({ field2: field2 })
            .end();
    });

    it('should return headers, status, body etc', function (done) {

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

        return request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(status)
                expect(res.get(headerName)).toEqual(headerValue);
                expect(res.body).toEqual(body);
                done()
            });
    });
});