var express = require('express')
  , cluster = require('express-cluster')
  , bodyParser = require('body-parser');

cluster(function() {
  var app = express();

  app.use(bodyParser.json({limit: '50mb', strict:false}));

  app.all('/', function (req, res) {
    var delay = req.headers['x-delay'] || null;
    var statusCode = req.headers['x-status'] || 200;

    if (delay) {
      setTimeout(function () {
        res.status(statusCode).send({});
      }, delay);
    } else {
      res.status(statusCode).send({});
    }
  });

  app.all('/wildcard/:freq*', function (req, res) {
    var failed = (Math.random() * req.params.freq < 1);
    res.status(failed ? 500 : 200).send({});
  });

  app.all('/status/:statusCode*', function (req, res) {
    res.status(req.params.statusCode).send({});
  });

  app.all('/auth/:authCode*', function (req, res) {
    var authed = req.headers['x-messagesystems-webhook-token'] === req.params.authCode;
    if (!authed) {
      console.error('bad auth: ' + req.headers['x-messagesystems-webhook-token']);
    }
    res.status(authed ? 200 : 401).send({});
  });

  app.all('/logged/:statusCode*', function (req, res) {
    var body = req.body;
    if (Array.isArray(body)) {
      console.log("got an array of length: " + body.length);
    } else {
      console.log("got an object: " + body);
    }
    console.log(JSON.stringify(body));
    res.status(req.params.statusCode).send({});
  });

  app.all('/slow/:averageTime*', function (req, res) {
    var time = Math.floor(Math.random() * req.params.averageTime * 2);
    var msg = 'Waited ' + time + 'ms';
    msg = { message: msg };

    setTimeout(function () {
      res.status(200).send(msg);
    }, time);
  });

  app.all('/delay/:delayTime*', function (req, res) {
    setTimeout(function () {
      res.status(200).send({});
    }, req.params.delayTime);
  });

  app.post('/token', function (req, res) {
    console.log('token endpoint called', req.body);
    switch(req.body.grant_type) {
      case 'client_credentials':
        var expires_in = req.query.expires_in
          , token_type = req.query.token_type
          , refresh_token = req.query.refresh_token;

        res.status(200).send({
          access_token: new Date().getTime(),
          refresh_token: refresh_token,
          expires_in: expires_in,
          token_type: token_type
        });
        return;
    }
    res.status(400).send({
       error: 'invalid grant type'
    });
  });

  app.listen(3000, function () {
    console.log('Express server listening on port 3000');
  });
}, { count: 4 });
