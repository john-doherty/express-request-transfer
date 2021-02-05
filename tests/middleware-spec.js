var express = require('express');
var request = require('supertest');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

describe('express-request-transfer', function () {

    // before each test
    beforeEach(function () {

        // create a new express app before each test to avoid controller collision
        app = express();

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


});