var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

function binaryParser(res, callback) {
    var data = '';

    res.setEncoding('binary');
    res.on('data', function(chunk) {
        data += chunk;
    });
    res.on('end', function() {
        callback(null, Buffer.from(data, 'binary'));
    });
}

describe('express-request-transfer (binary)', function () {

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

    it('should transfer binary responses', function (done) {

        var body = Buffer.from([1, 2, 3, 4, 5]);

        app.get('/internal', function(req, res){
            res.status(206);
            res.type('application/octet-stream');
            res.send(body);
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', true);
        });

        request(app)
            .get('/external')
            .buffer(true)
            .parse(binaryParser)
            .then(function(res) {
                expect(res.statusCode).toEqual(206);
                expect(Buffer.isBuffer(res.body)).toEqual(true);
                expect(res.body.equals(body)).toEqual(true);
                done();
            });
    });
});
