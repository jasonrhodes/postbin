# Postbin

## Group Installation

You will need NodeJS installed to use this project. Once you've installed NodeJS and NPM successfully, install the postbin's dependencies by changing to the postbin directory and running `npm install`.

To run, use `npm start`, or to keep it running in the background, use `npm run forever:start` and `npm run forever:stop` to stop later.

## Group Endpoints

### GET /status/{statusCode}

Returns an HTTP response with the given status code.

+ Parameters
  + statusCode (required, integer, `200`) ... The response status to return.

### GET /wildcard/{chance}

Returns an HTTP response whose status code is either 200 or 500, with the chance of success determined by the `chance` parameter.

+ Parameters
  + chance (required, integer, `2`) ... The HTTP request will succeed (return status 200) about one time in this many; for example, with a value of 2, approximately half the requests will succeed.

### GET /auth/{authCode}

Returns an HTTP response whose status code is either 200 or 400, depending on whether the given `authCode` matches the value of the request's `X-MessageSystems-Webhook-Token` header.

+ Parameters
  + authCode (required, string, `foo`) ... The authentication token value to compare against the request's `X-MessageSystems-Webhook-Token` header.

### GET /logged/{statusCode}

Returns an HTTP response with the given status code, and also logs the request body to the console.

+ Parameters
  + statusCode (required, integer, `200`) ... The response status to return.

### GET /slow/{averageTime}

Returns an HTTP response with status 200, after waiting between 0 and `averageTime * 2` milliseconds.

+ Parameters
  + averageTime (required, integer, `1000`) ... The average number of milliseconds to wait before returning a response.

### GET /delay/{delayTime}

Returns an HTTP response with status 200, after waiting exactly `delayTime` milliseconds.

+ Parameters
  + delay (required, integer, `1000`) ... The number of milliseconds to wait before returning a response.

