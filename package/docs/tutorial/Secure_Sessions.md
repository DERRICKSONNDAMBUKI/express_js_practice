By default, the connector creates a new session using SSL/TLS for TCP connections.

```javascript
const mysqlx = require('@mysql/xdevapi');

// using a connection string
mysqlx.getSession('mysqlx://localhost')
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: true }
    });

// using a configuration object
mysqlx.getSession({ host: 'localhost' })
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: true }
    });
```

If the server does not support secure TCP connections, the operation will fail.

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('mysqlx://localhost')
    .catch(err => {
        console.log(err.message); // will print the error message
    });
```

Note: SSL/TLS is not used with local Unix sockets.

### Disabling secure connections

The user can easily disable this feature explicitly (thus avoiding failures when using a server that does not support SSL/TLS connections):

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('mysqlx://localhost?ssl-mode=DISABLED')
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: false }
    });

// or using a plain JavaScript configuration object
const options = { host: 'localhost', tls: { enabled: false } };

mysqlx.getSession(options)
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: false }
    });
```

### Additional security options

For additional security, the user is able to customize the setup and do other things such as provide a list of hand-picked TLS protocol versions, verify that the server certificate is signed and/or isn't revoked by a given certificate authority (each one works independently of the other). To enable this additional security step, a link to each PEM file (CA and CRL) should be provided (certificate chaining and ordering should be done by the user beforehand). All these options are interchangeable and decoupled, altough a CRL is of no use in the absense of an associated CA.

#### TLS versions

A handpicked list of allowed TLS versions can be defined. Alternatively the client will rely on a default list of versions it supports, which includes `TLSv1`, `TLSv1.1` and `TLSv1.2` and `TLSv1.3` (depending on the Node.js version).

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('mysqlx://localhost?tls-versions=[TLSv1.2,TLSv1.3]')
    .catch(err => {
        console.log(err.message); // { host: 'localhost', tls: true }
    });


const options = { host: 'localhost', tls: { enabled: true, versions: ['TLSv1.2', 'TLSv1.3'] } };

mysqlx.getSession(options)
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: true }
    });
```

With Node.js v10.0.0 (or higher), where the TLS negotiation supports a range of versions, as long as the MySQL server supports the oldest TLS version in the list, the connection will be sucessful. However, on older Node.js versions, where range negotiation is not supported, since the client picks up the latest TLS version in the list by default, the connection will fail if the server does not support that specific version.

```javascript
const mysqlx = require('@mysql/xdevapi');

// With older Node.js versions, if the server does not support TLSv1.2
mysqlx.getSession('mysqlx://localhost?tls-versions=[TLSv1.1,TLSv1.2]')
    .catch(err => {
        console.log(err.message); // OpenSSL wrong version number error
    });

// With Node.js >=v10.0.0, with support for range-based negotiation, TLSv1.1 will be used
mysqlx.getSession('mysqlx://localhost?tls-versions=[TLSv1.1,TLSv1.2]')
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: true }
    });
```

If the oldest version of TLS supported by the server is newer than the one used by the client, the socket will hang up during the negotiation, regardless of the Node.js engine version being used.

```javascript
const mysqlx = require('@mysql/xdevapi');

// The server supports only TLSv1.2 or higher
mysqlx.getSession('mysqlx://localhost?tls-versions=[TLSv1,TLSv1.1]')
    .catch(err => {
        console.log(err.message); // TCP socket hang
    });
```

Both TLSv1 and TLSv1.1 are deprecated. This means that, when connecting to a server that does not support a later and more secure TLS version, or when the list of allowed TLS versions is restricted to one or both of those versions, the client will report a deprecation warning message.

When connecting to an older server with support for TLSv1.1, using the default connection options, like the following `test.js` script:

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('mysqlx://root@localhost')
    .then(session => {
        console.log('done');
    });
```

It will yield the following:

```shell
$ node test.js
The connection is using TLSv1.1 which is now deprecated and will be removed in a future release of MySQL. Be prepared to use TLSv1.2 or TLSv1.3 when you upgrade.
done
```

When connecting to an older server which supports only TLSv1, the script will yield the following:

```shell
$ node test.js
The connection is using TLSv1 which is now deprecated and will be removed in a future release of MySQL. Be prepared to use TLSv1.2 or TLSv1.3 when you upgrade.
done
```

The same should happen when connecting to any that supports TLSv1.2 or TLSv1.3 but the list of allowed TLS versions is restricted to one or more of the versions being deprecated.

```javascript
mysqlx.getSession('mysqlx://root@localhost?tls-versions=[TLSv1,TLSv1.1]')
    .then(session => {
        console.log('done');
    });
```

Running the script will yield the following:

```shell
$ node test.js
The connection is using TLSv1.1 which is now deprecated and will be removed in a future release of MySQL. Be prepared to use TLSv1.2 or TLSv1.3 when you upgrade.
done
```

If we restrict it to TLSv1 only, the behavior should be the same, but the message will mention TLSv1 instead.

```javascript
mysqlx.getSession('mysqlx://root@localhost?tls-versions=[TLSv1]')
    .then(session => {
        console.log('done');
    });
```

In which case, the script will yield the following:

```shell
$ node test.js
The connection is using TLSv1 which is now deprecated and will be removed in a future release of MySQL. Be prepared to use TLSv1.2 or TLSv1.3 when you upgrade.
done
```

The deprecation message is written in the process stderr stream as [`'warning'`](https://nodejs.org/docs/v12.0.0/api/process.html#process_event_warning) event, using the same infrastructure as the one used for deprecation messages generated by the core Node.js engine.

When using a connection pool, the message is reported only when the pool creates a new connection or when it re-creates one that expired in the meantime. Idle connections that are re-used by the pool do not report the deprecation message.

#### TLS Ciphersuites

Connector/Node.js passes the following default ciphersuite list to the OpenSSL package that is statically linked with the available Node.js engine:

```
TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
TLS_AES_128_GCM_SHA256
TLS_AES_256_GCM_SHA384
TLS_CHACHA20_POLY1305_SHA256
TLS_AES_128_CCM_SHA256
TLS_AES_128_CCM_8_SHA256
TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
TLS_DHE_RSA_WITH_AES_128_GCM_SHA256
TLS_DHE_DSS_WITH_AES_128_GCM_SHA256
TLS_DHE_DSS_WITH_AES_256_GCM_SHA384
TLS_DHE_RSA_WITH_AES_256_GCM_SHA384
TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256
TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256
TLS_DH_DSS_WITH_AES_128_GCM_SHA256
TLS_ECDH_ECDSA_WITH_AES_128_GCM_SHA256
TLS_DH_DSS_WITH_AES_256_GCM_SHA384
TLS_ECDH_ECDSA_WITH_AES_256_GCM_SHA384
TLS_DH_RSA_WITH_AES_128_GCM_SHA256
TLS_ECDH_RSA_WITH_AES_128_GCM_SHA256
TLS_DH_RSA_WITH_AES_256_GCM_SHA384
TLS_ECDH_RSA_WITH_AES_256_GCM_SHA384
TLS_DHE_RSA_WITH_AES_256_CBC_SHA
TLS_DHE_RSA_WITH_AES_128_CBC_SHA
TLS_RSA_WITH_AES_256_CBC_SHA
```

The last three ciphersuites from the list are deprecated, and exist only to provide compatibility with older MySQL server versions based on WolfSSL/YaSSL.

Applications are allowed to override this list by providing their own set of ciphersuites, using the respective IANA name, like the following:

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('mysqlx://localhost?tls-ciphersuites=[TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256,TLS_DHE_RSA_WITH_AES_128_CBC_SHA256]')
    .then(session => {
        console.log(session.inspect()); // { host: 'foobar', tls: true }
    });

const options = { host: 'localhost', tls: { ciphersuites: ['TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256', 'TLS_DHE_RSA_WITH_AES_128_CBC_SHA256'], enabled: true } };

mysqlx.getSession(options)
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: true }
    });
```

Applications are free to use older TLSv1 and TLSv1.1 compatible ciphersuites (like it is depicted in the above example) but these are not recommended.

Non-TLS ciphersuites, including the `MD5`, `SSLv3` and other older sets are not supported and will be ignored if the application wants to use them. If none of the ciphers provided by the application is actually supported by the client, an error will be thrown.

#### Certificate authority validation

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('mysqlx://localhost?ssl-ca=(/path/to/ca.pem)&ssl-crl=(/path/to/crl.pem)')
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: true }
    });


const options = { host: 'localhost', tls: { ca: '/path/to/ca.pem', crl: '/path/to/crl.pem', enabled: true } };

mysqlx.getSession(options)
    .then(session => {
        console.log(session.inspect()); // { host: 'localhost', tls: true }
    });
```

Note: file paths can be either [pct-encoded](https://en.wikipedia.org/wiki/Percent-encoding) or unencoded but enclosed by parenthesis (as demonstrated in the example).

### Authentication Mechanisms

Currently, the MySQL X plugin supports the following authentication methods:

- [`MYSQL41`](https://dev.mysql.com/doc/internals/en/x-protocol-authentication-authentication.html#x-protocol-authentication-mysql41-authentication) (available for any kind of connection)
- [`PLAIN`](https://dev.mysql.com/doc/internals/en/x-protocol-authentication-authentication.html#x-protocol-authentication-plain-authentication) (requires TLS)
- `SHA256_MEMORY` (requires previously cached password)

Since server connections are secure by default, unless one explicitely disables TLS support, the connection will use the `PLAIN` authentication mechanism. The same happens if the server connection is established via a local UNIX socket (albeit not over TLS).

On the other hand, connections established via regular unencrypted TCP links will try to authenticate the user via `MYSQL41` first, if that does not work, `SHA256_MEMORY` authentication will then be attempted and finally, if none of those work, the client will just relay the server error.

The `SHA256_MEMORY` authentication mechanism will only work if the server already contains the account password in the authentication cache, after an earlier authentication attempt using a different mechanism.

The user is allowed to override this automatic choice, and fallback to `MYSQL41` on secure connections. The same does not apply to insecure connections because the `PLAIN` authentication mechanism requires TLS. There are some other rules to have in mind with regards to the compabitility between client authentication mechanism and server authentication plugins associated to each database user account.

Below is an overview of the major compatibility rules, which change based not only if the server connection uses TLS or unix sockets (secure - S) or uses an unencrypted TCP channel (insecure - N) but also on the server version. The examples provided are valid for MySQL 8.0.11 or later versions.

#### `mysql_native_password`

The `mysql_native_password` authentication plugin is used by default from [MySQL 5.7](https://dev.mysql.com/doc/refman/5.7/en/native-pluggable-authentication.html) up to [MySQL 8.0.11](https://dev.mysql.com/doc/refman/8.0/en/native-pluggable-authentication.html).

| Authentication mechanism  | 5.7 (S)   | 5.7 (N)   | 8.0.11 (S) | 8.0.11 (N) |
| --------------------------|-----------|-----------|------------|------------|
| `MYSQL41`                 | OK        | OK        | OK         | OK         |
| `PLAIN`                   | OK        | NO        | OK         | NO         |
| `SHA256_MEMORY`           | N/A       | N/A       | OK         | OK         |

`MYSQL41` will always work, whereas `PLAIN` will only work over TLS. `SHA256_MEMORY` requires the password to be previously cached (see examples below).

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('root@localhost?auth=MYSQL41')
    .then(session => {
        console.log(session.inspect().auth); // 'MYSQL41'
    })

mysqlx.getSession({ auth: 'MYSQL41', tls: false, user: 'root' })
    .then(session => {
        console.log(session.inspect().auth); // 'MYSQL41'
    })

mysqlx.getSession('root@localhost?ssl-mode=DISABLED')
    .then(session => {
        console.log(session.inspect().auth); // 'MYSQL41'
    })

mysqlx.getSession({ user: 'root' })
    .then(session => {
        console.log(session.inspect().auth); // 'PLAIN'
    })

mysqlx.getSession('root@localhost?auth=PLAIN&ssl-mode=DISABLED')
    .catch(err => {
        console.log(err.message); // 'Invalid user or password'
    });
```

#### `caching_sha2_password`

The `caching_sha2_password` authentication plugin was introduced with [MySQL 8.0.11](https://dev.mysql.com/doc/refman/8.0/en/caching-sha2-pluggable-authentication.html) and is used by default since then. It is not supported on older server versions.

| Authentication mechanism  | 5.7 (S)   | 5.7 (N)   | 8.0.11 (S) | 8.0.11 (N) |
| --------------------------|-----------|-----------|------------|------------|
| `MYSQL41`                 | N/A       | N/A       | NO         | NO         |
| `PLAIN`                   | N/A       | N/A       | OK         | NO         |
| `SHA256_MEMORY`           | N/A       | N/A       | OK         | OK         |

To save the password on the server cache, first, the client must authenticate using `PLAIN` over TLS. Any other authentication setup will not work.

```javascript
const mysqlx = require('@mysql/xdevapi');

mysqlx.getSession('root@localhost')
    .then(session => {
        console.log(session.inspect().auth); // 'PLAIN'

        return mysqlx.getSession('root@localhost?auth=SHA256_MEMORY')
    })
    .then(session => {
        console.log(session.inspect().auth); // 'SHA256_MEMORY'
    });

mysqlx.getSession('root@localhost?ssl-mode=DISABLED')
    .catch(err => {
        console.log(err.message); // 'Authentication failed using "MYSQL41" and "SHA256_MEMORY", check username and password or try a secure connection.'
    });

mysqlx.getSession('root@localhost?auth=MYSQL41')
    .catch(err => {
        console.log(err.message); // 'Invalid user or password'
    });
```
