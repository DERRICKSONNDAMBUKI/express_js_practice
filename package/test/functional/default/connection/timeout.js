/*
 * Copyright (c) 2020, 2021, Oracle and/or its affiliates.
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License, version 2.0, as
 * published by the Free Software Foundation.
 *
 * This program is also distributed with certain software (including
 * but not limited to OpenSSL) that is licensed under separate terms,
 * as designated in a particular file or component or in included license
 * documentation.  The authors of MySQL hereby grant you an
 * additional permission to link the program and your derivative works
 * with the separately licensed software that they have included with
 * MySQL.
 *
 * Without limiting anything contained in the foregoing, this file,
 * which is part of MySQL Connector/Node.js, is also subject to the
 * Universal FOSS Exception, version 1.0, a copy of which can be found at
 * http://oss.oracle.com/licenses/universal-foss-exception.
 *
 * This program is distributed in the hope that it will be useful, but
 * WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.
 * See the GNU General Public License, version 2.0, for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program; if not, write to the Free Software Foundation, Inc.,
 * 51 Franklin St, Fifth Floor, Boston, MA 02110-1301  USA
 */

'use strict';

/* eslint-env node, mocha */

const config = require('../../../config');
const errors = require('../../../../lib/constants/errors');
const expect = require('chai').expect;
const mysqlx = require('../../../../');
const net = require('net');
const os = require('os');
const path = require('path');

describe('connecting to unavailable servers with a timeout', () => {
    context('when the timeout value is not valid', () => {
        const baseConfig = { schema: undefined, socket: undefined };

        it('fails using a configuration object', () => {
            const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: -1 });

            return mysqlx.getSession(timeoutConfig)
                .then(() => {
                    return expect.fail();
                })
                .catch(err => {
                    return expect(err.message).to.equal(errors.MESSAGES.ERR_INVALID_CONNECTION_TIMEOUT_VALUE);
                });
        });

        it('fails using a URI', () => {
            const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: -1 });
            const uri = `mysqlx://${timeoutConfig.user}:${timeoutConfig.password}@(${timeoutConfig.socket})?connect-timeout=${timeoutConfig.connectTimeout}`;

            return mysqlx.getSession(uri)
                .then(() => {
                    return expect.fail();
                })
                .catch(err => {
                    return expect(err.message).to.equal(errors.MESSAGES.ERR_INVALID_CONNECTION_TIMEOUT_VALUE);
                });
        });
    });

    context('when the timeout is not exceeded', () => {
        const baseConfig = { schema: undefined, socket: undefined };

        it('disables the timeout for subsequent activity', () => {
            const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100 });

            return mysqlx.getSession(timeoutConfig)
                .then(session => {
                    return new Promise(resolve => setTimeout(() => resolve(session), timeoutConfig.connectTimeout * 2))
                        .then(() => session.sql('SELECT 1'))
                        .then(() => session.close());
                });
        });
    });

    context('when the timeout value is exceeded', () => {
        // The dummy TCP server is created in the host where the tests are running.
        const baseConfig = { host: 'localhost', schema: undefined, socket: undefined };

        context('with a single target host', () => {
            let server;

            beforeEach('create fake server', () => {
                server = net.createServer();

                server.on('connection', socket => {
                    server.on('close', () => socket.destroy());
                    socket.pause();
                });
            });

            afterEach('close fake server', done => {
                // If the server is not listening, there is nothing to do.
                if (!server.listening) {
                    return done();
                }

                // Make sure the server does not accept any new connections.
                server.close(done);
                // The callback on "close" is only called after all
                // connections are closed, so we need to make sure that
                // happens.
                server.emit('close');
            });

            context('using a Unix socket', () => {
                const socket = path.join(os.tmpdir(), 'dummy.sock');

                beforeEach('start fake server', function (done) {
                    if (os.platform() === 'win32') {
                        return this.skip();
                    }

                    server.listen(socket, done).on('error', done);
                });

                it('fails using a configuration object', function () {
                    if (os.platform() === 'win32') {
                        return this.skip();
                    }

                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, socket });
                    const error = `Connection attempt to the server was aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded.`;

                    return mysqlx.getSession(timeoutConfig)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });

                it('fails using a URI', function () {
                    if (os.platform() === 'win32') {
                        return this.skip();
                    }

                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, socket });
                    const uri = `mysqlx://${timeoutConfig.user}:${timeoutConfig.password}@(${timeoutConfig.socket})?connect-timeout=${timeoutConfig.connectTimeout}`;
                    const error = `Connection attempt to the server was aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded.`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });
            });

            context('using TCP', () => {
                let port;

                beforeEach('start fake server', done => {
                    server.listen(0, () => {
                        port = server.address().port;
                        return done();
                    });
                });

                it('fails using a configuration object', () => {
                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, port });
                    const error = `Connection attempt to the server was aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded.`;

                    return mysqlx.getSession(timeoutConfig)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });

                it('fails using a URI', () => {
                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, port });
                    const uri = `mysqlx://${timeoutConfig.user}:${timeoutConfig.password}@${timeoutConfig.host}:${timeoutConfig.port}?connect-timeout=${timeoutConfig.connectTimeout}`;
                    const error = `Connection attempt to the server was aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded.`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });
            });
        });

        context('with multiple target hosts', () => {
            let primary, secondary;

            beforeEach('create fake servers', () => {
                primary = net.createServer();
                secondary = net.createServer();

                [primary, secondary].forEach(server => {
                    server.on('connection', socket => {
                        primary.on('close', () => socket.destroy());
                        socket.pause();
                    });
                });
            });

            afterEach('close fake servers', done => {
                // If the servers are not listening, there is nothing to do.
                if (!secondary.listening && !primary.listening) {
                    return done();
                }

                // If only the primary is listening.
                if (!secondary.listening) {
                    // We prevent it from accepting new connections.
                    primary.close(done);
                    // And close the existing ones.
                    primary.emit('close');
                    return;
                }

                // By this point both the primary and secondary should be
                // listening.
                secondary.close(err => {
                    if (!err) {
                        return primary.close(done);
                    }

                    // Even if there is an error, we should try to close
                    // the primary as well.
                    return primary.close(err => {
                        if (err) {
                            return done(err);
                        }

                        return done(err);
                    });
                });

                [primary, secondary].forEach(server => {
                    server.emit('close');
                });
            });

            context('using a Unix socket', () => {
                const primarysocket = path.join(os.tmpdir(), 'dummy-primary.sock');
                const secondarySocket = path.join(os.tmpdir(), 'dummy-secondary.sock');

                beforeEach('start fake server', function (done) {
                    if (os.platform() === 'win32') {
                        return this.skip();
                    }

                    primary.listen(primarysocket, () => secondary.listen(secondarySocket, done));
                });

                it('fails using a configuration object', function () {
                    if (os.platform() === 'win32') {
                        return this.skip();
                    }

                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, endpoints: [{ socket: primarysocket }, { socket: secondarySocket }] });
                    const error = `All server connection attempts were aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded for each selected server.`;

                    return mysqlx.getSession(timeoutConfig)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });

                it('fails using a URI', function () {
                    if (os.platform() === 'win32') {
                        return this.skip();
                    }

                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, endpoints: [{ socket: primarysocket }, { socket: secondarySocket }] });
                    const uri = `mysqlx://${timeoutConfig.user}:${timeoutConfig.password}@[${timeoutConfig.endpoints.map(e => encodeURIComponent(e.socket)).join(',')}]?connect-timeout=${timeoutConfig.connectTimeout}`;
                    const error = `All server connection attempts were aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded for each selected server.`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });
            });

            context('using TCP', () => {
                let primaryPort, secondaryPort;

                beforeEach('start fake server', done => {
                    primary.listen(0, () => {
                        primaryPort = primary.address().port;
                        secondary.listen(0, () => {
                            secondaryPort = secondary.address().port;
                            return done();
                        });
                    });
                });

                it('fails using a configuration object', () => {
                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, endpoints: [{ port: primaryPort }, { port: secondaryPort }] });
                    const error = `All server connection attempts were aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded for each selected server.`;

                    return mysqlx.getSession(timeoutConfig)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });

                it('fails using a URI', () => {
                    const timeoutConfig = Object.assign({}, config, baseConfig, { connectTimeout: 100, endpoints: [{ host: baseConfig.host, port: primaryPort }, { host: baseConfig.host, port: secondaryPort }] });
                    const uri = `mysqlx://${timeoutConfig.user}:${timeoutConfig.password}@[${timeoutConfig.endpoints.map(e => `${e.host}:${e.port}`).join(',')}]?connect-timeout=${timeoutConfig.connectTimeout}`;
                    const error = `All server connection attempts were aborted. Timeout of ${timeoutConfig.connectTimeout} ms was exceeded for each selected server.`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => expect(err.message).to.equal(error));
                });
            });
        });
    });
});
