# express-request-transfer

Express middleware that brings the power of [Server.Transfer](https://docs.microsoft.com/en-us/previous-versions/iis/6.0-sdk/ms525800(v%3Dvs.90)) from C# to node/express.

Call `req.transfer` to transfer an incoming request to another route without a browser redirect and incoming data optionally included.

## Why is this useful

`res.redirect` sends a HTTP `301` or `302` message to the browser asking it to make another request to a new URL.

`req.transfer(internalPath, preserveData)` internally transfers the incoming request to another route without redirecting the client. The browser URL remains the same and you remove the need for an additional request.

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
    req.transfer('/api/time');
});

```

If the user requested http://localhost _route 2_ would receive the request and switch code execution to _route 1_. The response from _route 1_ would be returned to the client.

## Contributing

1. Fork it!
2. Create your feature branch: `git checkout -b my-new-feature`
3. Commit your changes: `git commit -m 'my new feature'`
4. Push to the branch: `git push origin my-new-feature`
5. Submit a pull request

## Star the repo

If you find this useful please :star2: the repo as it helps me prioritize bug fixes.

## History

For change-log, check [releases](https://github.com/john-doherty/express-request-transfer/releases).

## License

Licensed under [MIT License](LICENSE) &copy; [John Doherty](https://twitter.com/mrJohnDoherty)
