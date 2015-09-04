var express = require('express')
  , cluster = require('express-cluster')
  , bodyParser = require('body-parser')
  , bearerToken = require('express-bearer-token')
  , _ = require('lodash')
  , crypto = require('crypto')
  , port = process.env.POSTBIN_TOKEN_PORT || process.env.POSTBIN_PORT || 4000
  , spawnCount = process.env.POSTBIN_SPAWN_COUNT || 1;

cluster(function() {
  var app = express();

  app.use('/token', bodyParser.urlencoded({ extended: false }));
  app.post('/token', logHeader, delayResponse, wildcard, tokenEndpoint);

  app.use(bearerToken());
  app.use(bodyParser.json({ limit: '50mb', strict: false }));

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

  app.all('/status/:statusCode*', delayResponse, function (req, res) {
    res.status(req.params.statusCode).send({});
  });

  app.all('/logged/:statusCode*', logHeader, delayResponse, loggedEndpoint);

  app.all('/auth/:authCode*', function (req, res) {
    var authed = req.headers['x-messagesystems-webhook-token'] === req.params.authCode;
    if (!authed) {
      console.error('bad auth: ' + req.headers['x-messagesystems-webhook-token']);
    }
    res.status(authed ? 200 : 401).send({});
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

  app.all('/logged', logHeader, delayResponse, wildcard, authTimeout, loggedEndpoint);

  app.use(function(err, req, res, next) {
    console.error(err.stack);
    res.status(500).send('Something broke!');
  });
  
  app.listen(port, function () {
    console.log('Express server listening on port ' + port);
  });
}, { count: spawnCount });




// Endpoint functions

/**
 * Logs the body and headers.
 * @param req
 * @param res
 */
function loggedEndpoint (req, res) {
  var body = req.body;

  console.log('Headers: ' + JSON.stringify(req.headers));
  if (Array.isArray(body)) {
    console.log("Body is an array of length", body.length);
  } else {
    console.log("Body is an object:\n" + JSON.stringify(body));
  }

  res.status(req.params.statusCode || 200).send({});
}

/**
 * Sends an access_token back.
 *
 * @param req
 * @param res
 */
function tokenEndpoint(req, res) {

  var contentType = req.headers['content-type'];

  if (contentType !== 'application/x-www-form-urlencoded') {
    console.log('Invalid content type of ' + contentType + ', responding with 415');
    return res.status(415).send('Please submit data in "x-www-form-urlencoded" format only');
  }

  switch (req.body.grant_type) {
    case 'client_credentials':
      var response = _.pick(req.body, 'expires_in', 'refresh_token');
      response.access_token = new Date().getTime().toString();

      console.log('Valid token generated: ' + response.access_token);
      res.status(200).send(response);
      break;

    default:
      console.log('Invalid grant_type in token request body: ' + req.body.grant_type);
      res.status(400).send({
        error: 'invalid grant type'
      });
  }

  console.log('Body: ' + JSON.stringify(req.body));
}



// Middleware functions

/**
 * Middleware for checking timestamp token
 * against authTimeout ms value, and responding
 * with 401 if token is older than authTimeout ms ago
 */
function authTimeout(req, res, next) {
  var timeout = req.query.authTimeout
    , token = req.token
    , elapsed = new Date().getTime() - token;
  
  if (!timeout) {
    return next();
  }

  if (!_.isUndefined(req.headers['x-messagesystems-batch-id'])) {
    console.log('x-messagesystems-batch-id:', req.headers['x-messagesystems-batch-id']);
  }

  if (!token) {
    console.log('No token included in request, responding with 400');
    res.status(400).send({
      error: 'no access_token'
    });
    return;
  }

  if (elapsed > timeout) {
    console.log('Invalid or expired token %s, responding with 401', token);
    res.status(401).send({
      error: 'invalid or expired token: ' + token
    });
    return;
  }

  console.log('%s ms remaining before token %s expires', (timeout - elapsed), token);  
  next();
}

/**
 * Sets a random response code, given a list of response codes and weights.
 * e.g. badResponses="{\"400\":0.1,\"401\":0.25}"
 *
 * @param req
 * @param res
 * @param next
 * @returns {*}
 */
function wildcard(req, res, next) {
var random = Math.random()
  , badResponses = {}
  , statusCode;

  if (!req.query.badResponses) {
    return next();
  }

  try {
    var codes = req.query.badResponses.split(',');
    codes.forEach(function(item) {
      var c = item.split(':');
      badResponses[c[0]] = parseFloat(c[1]);
    });
  } catch (e) {
    console.log('could not parse badResponses: ' + req.query.badResponses);
    next();
  }

  if (!badResponses) {
    return next();
  }

  _.reduce(badResponses, function(totalPercentage, percentage, code) {
    totalPercentage += percentage;
    if (!statusCode && random <= totalPercentage) {
      statusCode = code;
    }
    return totalPercentage;
  }, 0);

  if (statusCode) {
    console.log('Bad response womp womp, responding with %s', statusCode);
    res.status(statusCode).send();
    return;
  }

  next();
}

/**
 * Middleware to add a styled header to a
 * block of logs, use this as the first middleware
 * on a route that includes logging
 */
function logHeader(req, res, next) {
  req.hash = md5(req.url + req.ip).substr(0, 6);
  console.log('\n' + timestamp() + ' | ' + req.hash + ' | ' + req.ip + ' | ' + req.url);
  next();
}

/**
 * Middleware for delaying a response,
 * can accept ?delay=500 for 500ms or
 * ?delay=500-1500 for random ms delay 
 * between 500 and 1500 ms
 * 
 */
function delayResponse(req, res, next) {
  var delay = req.query.delay;  
  if (!delay) {
    return next();
  }
  var ms, range = delay.split('-');
  if (range.length === 1) {
    ms = delay;
  } else {
    ms = _.random.apply(_, range);
  }
  console.log('Delay for ' + ms + 'ms');
  setTimeout(next, ms);
}

/**
 * Timestamp convenience method
 * @return {[type]} [description]
 */
function timestamp() {
  var d = new Date();
  return d.toTimeString().split(' ').shift() + ' ' + d.toDateString();
}

/**
 * Return an md5 hash
 * @param  {String} value String to hash
 * @return {String}       Hashed value
 */
function md5(value) {
  var md5sum = crypto.createHash('md5');
  md5sum.update(value);
  return md5sum.digest('hex');
}

