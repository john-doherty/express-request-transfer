# express-request-transfer

Brings the power of C# [Server.Transfer](https://docs.microsoft.com/en-us/previous-versions/iis/6.0-sdk/ms525800(v%3Dvs.90)) to express, allowing you to transfer a request from one route to another without a redirect.

## What's difference between `req.transfer` and `res.redirect`?

Use `res.redirect('/new-route')` when:

* you want to redirect the request to another server
* you don't care about additional round-trips to the server
* you don't need to preserve Query String and Form Variables
* you want the user to see the new redirected URL _(and maybe bookmark it)_

Use `req.transfer('/new-route', true)` when:

* you want to transfer current request to another page on the same server
* you want to preserve server resources and avoid unnecessary round-trips to the server
* you want to preserve Query String and Form Variables _(optional)_
* you don't need the user to see the real URL in the browser

## Installation

```bash
$ npm install --save express-request-transfer
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
    req.transfer('/api/time'); // add `true` to include form and query data
});

```

If the user requested http://localhost _route 2_ would receive the request and switch code execution to _route 1_. The response from _route 1_ would be returned to the client. The users browser URL would be unchanged.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'my new feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Star the repo

If you find this useful :star2: the repo, it helps me prioritize support.

## History

For change-log, check [releases](https://github.com/john-doherty/express-request-transfer/releases).

## License

Licensed under [MIT License](LICENSE) &copy; [John Doherty](https://twitter.com/mrJohnDoherty)
