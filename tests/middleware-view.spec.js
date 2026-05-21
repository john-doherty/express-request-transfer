var path = require('path');
var express = require('express');
var request = require('supertest');
var bodyParser = require('body-parser');
var requestTransfer = require('../lib/express-request-transfer.js');

var app = null;

function renderFormTemplate(options) {
    return [
        '<form>',
        '  <h1>' + String(options.title || '') + '</h1>',
        '  <p>' + String(options.message || '') + '</p>',
        '</form>'
    ].join('');
}

describe('express-request-transfer (views)', function () {

    // before each test
    beforeEach(function () {

        // create a new express app before each test to avoid controller collision
        app = express();

        // parse application/json
        app.use(bodyParser.json())

        // parse application/x-www-form-urlencoded
        app.use(bodyParser.urlencoded({ extended: true }))

        app.set('views', path.join(__dirname, 'views'));
        app.engine('html', function(filePath, options, callback) {
            callback(null, renderFormTemplate(options));
        });
        app.set('view engine', 'html');

        // add middleware
        app.use(requestTransfer);
    });

    // after each test
    afterEach(function () {
        app = null;
    });

    it('should transfer rendered view responses', function (done) {

        app.get('/internal', function(req, res){
            var model = {
                title: 'Transfer Form',
                message: 'Rendered through res.render'
            };

            res.status(200);
            res.render('form', model);
        });

        app.get('/external', function(req, res){
            req.transfer('/internal', false);
        });

        request(app)
            .get('/external')
            .then(function(res) {
                expect(res.statusCode).toEqual(200);
                expect(res.text).toContain('<form>');
                expect(res.text).toContain('Transfer Form');
                expect(res.text).toContain('Rendered through res.render');
                done();
            });
    });
});
