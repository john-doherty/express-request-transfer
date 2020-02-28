# express-request-transfer

Adds the power of C# [Server.Transfer](https://docs.microsoft.com/en-us/previous-versions/iis/6.0-sdk/ms525800(v%3Dvs.90)) to express.

Call `req.transfer('/new-route')` from within one of your routes to transfer the request without an additional request _(optionally preserves data)_.

## Why is this useful

`res.redirect('/new-route')` sends a HTTP `301` or `302` response to the browser. This causes the browser to make another request to the server and modifies the browser URL.

`req.transfer(internalPath, preserveData)` transfers the request to another route internally, without redirecting the browser, thus reducing server load and preserving the browser URL.

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
