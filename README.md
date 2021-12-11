# express-request-transfer

[![Build Status][build-status]][build-url]
[![NPM version][npm-image]][npm-url]
[![Twitter Follow][twitter-image]][twitter-url]

[build-status]:https://github.com/orca-scan/express-request-transfer/workflows/Build/badge.svg
[build-url]:https://github.com/john-doherty/express-request-transfer/actions
[npm-image]:http://img.shields.io/npm/v/express-request-transfer.svg
[npm-url]:https://npmjs.org/package/express-request-transfer
[twitter-image]:https://img.shields.io/twitter/follow/mrjohndoherty.svg?style=social&label=Follow
[twitter-url]:https://twitter.com/mrjohndoherty

[Server.Transfer in C#](https://docs.microsoft.com/en-us/previous-versions/iis/6.0-sdk/ms525800(v%3Dvs.90)) allows an incoming request to one route, to be transfered to another without using 30x redirects _(saving a client/server roundtrip)_. This module brings the same feature to express:

```js
req.transfer('/new-route', true) // true = include form and query data
```

## How is this different from `res.redirect`?

Use `res.redirect('/new-route')` when:

* you want to redirect the request to another server
* you don't care about additional round-trips to the server
* you don't need to preserve Query String and Form Variables
* you want the user to see the new redirected URL _(and maybe bookmark it)_

Use `req.transfer('/new-route', preserveData)` when:

* you want to transfer current request to another URL on the same server
* you want to reduce server load by avoiding unnecessary round-trips
* you want to preserve Query String and Form Variables _(optional)_
* you don't need the user to see the final URL in their browser

## Installation

```bash
npm install --save express-request-transfer
```

## Usage

```js
var express = require('express');
var requestTransfer = require('express-request-transfer');

var app = express();

// add req.transfer method to all routes
app.use(requestTransfer);

// route 1
app.get('/api/time', function(req, res){
    res.send(new Date());
});

// route 2
app.post('/', function(req, res){

    // transfer request without form/query data
    req.transfer('/api/time');

    // transfer request with incoming form/query data
    // req.transfer('/api/time', true);
});
```

If the user requested http://localhost _route 2_ would receive the request and switch code execution to _route 1_. The response from _route 1_ would be returned to the client. The users browser URL would be unchanged.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'my new feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## History

For change-log, check [releases](https://github.com/john-doherty/express-request-transfer/releases).

