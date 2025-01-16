
# DEPRECATED

`@ibm-functions/iam-token-manager` is not maintained anymore

# IBM IAM Token Manager library

[![Build Status](https://travis-ci.org/ibm-functions/iam-token-manager-nodejs.svg?branch=master)](https://travis-ci.org/ibm-functions/iam-token-manager-nodejs)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](http://www.apache.org/licenses/LICENSE-2.0)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


## Installation
```
npm install @ibm-functions/iam-token-manager
```

## Usage
Provide constructor parameters `iamApikey` and `iamUrl` (Optional) to create a new instance.
```javascript
const itm = require('@ibm-functions/iam-token-manager')
const m = new itm({
    "iamApikey":"1234ABCD..."
})
```

Use the function `getToken` to get an IAM acess token. This function returns a `Promise`.
```javascript
m.getToken().then(token => console.log('Authorization:', 'Bearer', token))
```
output:
```bash'
Authorization: Bearer eyJhbGciOiJIUz......sgrKIi8hdFs
```

Use the function `getAuthHeader` to get a Bearer HTTP Authorization header including the token. This function returns a `Promise`.
```javascript
m.getAuthHeader().then(header => console.log('Authorization:', header))
```
output:
```bash
Authorization: Bearer eyJhbGciOiJIUz......sgrKIi8hdFs
```

## Using with OpenWhisk client library
```javascript
const itm = require('@ibm-functions/iam-token-manager')
const m = new itm({
    "iamApikey":"1234ABCD..."
})
const openwhisk = require('openwhisk')
const ow = openwhisk({
    auth_handler:m
})
```
Note: Need to use a version of `openwhisk` that supports `auth_handler` plugin.

### Using Within IBM Cloud Functions nodejs v8 runtime
The nodejs v8 runtime provides an openwhisk npm module already including the iam token manager plugin pre-installed, it will use the environment variable `__OW_IAM_NAMESPACE_API_KEY` as the `iamApikey`
```javascript
var openwhisk = require('openwhisk');

function action() {
  var ow = openwhisk();
  return ow.actions.invoke('sample')
}

exports.main = action
```

## License
[Apache-2.0](LICENSE.txt)