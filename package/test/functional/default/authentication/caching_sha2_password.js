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
const crypto = require('crypto');
const expect = require('chai').expect;
const fixtures = require('../../../fixtures');
const mysqlx = require('../../../../');
const os = require('os');
const path = require('path');

describe('caching_sha2_password authentication plugin', () => {
    const baseConfig = { schema: undefined };
    const user = 'foo';
    const password = 'bar';
    const plugin = 'caching_sha2_password';

    context('connecting without an authentication mechanism', () => {
        context('without a password in the server authentication cache', () => {
            context('over TCP and TLS', () => {
                const tcpConfig = { socket: undefined, tls: { enabled: true } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeds while falling back to PLAIN using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });

                it('succeeds while falling back to PLAIN using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });

                it('fails when a wrong password is provided using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });

                    return mysqlx.getSession(authConfig)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });

                it('fails when a wrong password is provided using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });
            });

            context('over regular TCP', () => {
                const tcpConfig = { socket: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('fails using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Authentication failed using "MYSQL41" and "SHA256_MEMORY"/);
                        });
                });

                it('fails using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?ssl-mode=DISABLED`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Authentication failed using "MYSQL41" and "SHA256_MEMORY"/);
                        });
                });
            });

            context('over a Unix socket', () => {
                const socketConfig = { host: undefined, port: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                afterEach('delete user', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeeds while falling back to PLAIN using a configuration object', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });

                it('succeeds while falling back to PLAIN using a URI', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });

                it('fails when a wrong password is provided using a configuration object', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return mysqlx.getSession(authConfig)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });

                it('fails when a wrong password is provided using a URI', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });
            });

            context('when debug mode is enabled', () => {
                const script = path.join(__dirname, '..', '..', '..', 'fixtures', 'scripts', 'connection', 'auth.js');
                const debugConfig = { socket: undefined };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('logs the appropriate authentication mechanim and data', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig, { user, password });

                    return fixtures.collectLogs('protocol:outbound:Mysqlx.Session.AuthenticateStart', script, [authConfig.user, authConfig.password], { config: authConfig })
                        .then(proc => {
                            expect(proc.logs).to.have.lengthOf(1);
                            expect(proc.logs[0]).to.contain.keys('mech_name', 'auth_data');
                            expect(proc.logs[0].mech_name).to.equal('PLAIN');
                            expect(proc.logs[0].auth_data).to.contain.keys('type', 'data');
                            expect(Buffer.from(proc.logs[0].auth_data.data).toString()).to.have.string(authConfig.user);
                        });
                });
            });
        });

        context('with the password in the server authentication cache', () => {
            context('over TCP and TLS', () => {
                const tcpConfig = { socket: undefined, tls: { enabled: true } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                beforeEach('save the password in the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return fixtures.savePasswordInAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeds while falling back to PLAIN using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });

                it('succeeds while falling back to PLAIN using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });
            });

            context('over regular TCP', () => {
                const tcpConfig = { socket: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                beforeEach('save the password in the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return fixtures.savePasswordInAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeds while falling back to SHA256_MEMORY using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('SHA256_MEMORY');
                            return session.close();
                        });
                });

                it('succeeds while falling back to SHA256_MEMORY using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?ssl-mode=DISABLED`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('SHA256_MEMORY');
                            return session.close();
                        });
                });
            });

            context('over a Unix socket', () => {
                const socketConfig = { host: undefined, port: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                beforeEach('save the password in the server authentication cache', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.savePasswordInAuthenticationCache(authConfig);
                });

                afterEach('delete user', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeds while falling back to PLAIN using a configuration object', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });

                it('succeeds while falling back to PLAIN using a URI', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})?ssl-mode=DISABLED`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal('PLAIN');
                            return session.close();
                        });
                });
            });
        });
    });

    context('connecting with the MYSQL41 authentication mechanism', () => {
        const auth = 'MYSQL41';

        context('over TCP and TLS', () => {
            const tcpConfig = { auth, socket: undefined, tls: { enabled: true } };

            beforeEach('create user with caching_sha2_password plugin', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.createUser(user, plugin, password, authConfig);
            });

            beforeEach('invalidate the server authentication cache', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.resetAuthenticationCache(authConfig);
            });

            afterEach('delete user', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.dropUser(user, authConfig);
            });

            it('fails using a configuration object', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                return mysqlx.getSession(authConfig)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });

            it('fails using a URI', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?auth=${auth}`;

                return mysqlx.getSession(uri)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });
        });

        context('over regular TCP', () => {
            const tcpConfig = { auth, socket: undefined, tls: { enabled: false } };

            beforeEach('create user with caching_sha2_password plugin', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.createUser(user, plugin, password, authConfig);
            });

            beforeEach('invalidate the server authentication cache', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.resetAuthenticationCache(authConfig);
            });

            afterEach('delete user', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.dropUser(user, authConfig);
            });

            it('fails using a configuration object', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                return mysqlx.getSession(authConfig)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });

            it('fails using a URI', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?ssl-mode=DISABLED&auth=${auth}`;

                return mysqlx.getSession(uri)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });
        });

        context('over a Unix socket', () => {
            const socketConfig = { auth, host: undefined, port: undefined, tls: { enabled: false } };

            beforeEach('create user with caching_sha2_password plugin', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return fixtures.createUser(user, plugin, password, authConfig);
            });

            beforeEach('invalidate the server authentication cache', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return fixtures.resetAuthenticationCache(authConfig);
            });

            afterEach('delete user', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return fixtures.dropUser(user, authConfig);
            });

            it('fails using a configuration object', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return mysqlx.getSession(authConfig)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });

            it('fails using a URI', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})?ssl-mode=DISABLED&auth=${authConfig.auth}`;

                return mysqlx.getSession(uri)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });
        });
    });

    context('connecting with the PLAIN authentication mechanism', () => {
        const auth = 'PLAIN';

        context('over TCP and TLS', () => {
            const tcpConfig = { auth, socket: undefined, tls: { enabled: true } };

            beforeEach('create user with caching_sha2_password plugin', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.createUser(user, plugin, password, authConfig);
            });

            beforeEach('invalidate the server authentication cache', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.resetAuthenticationCache(authConfig);
            });

            afterEach('delete user', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.dropUser(user, authConfig);
            });

            it('succeeds using a configuration object', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                return mysqlx.getSession(authConfig)
                    .then(session => {
                        expect(session.inspect().auth).to.equal(auth);
                        return session.close();
                    });
            });

            it('succeeds using a URI', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?auth=${auth}`;

                return mysqlx.getSession(uri)
                    .then(session => {
                        expect(session.inspect().auth).to.equal(auth);
                        return session.close();
                    });
            });

            it('fails when a wrong password is provided using a configuration object', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });

                return mysqlx.getSession(authConfig)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });

            it('fails when a wrong password is provided using a URI', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });
                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?auth=${auth}`;

                return mysqlx.getSession(uri)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });
        });

        context('over regular TCP', () => {
            const tcpConfig = { auth, socket: undefined, tls: { enabled: false } };

            beforeEach('create user with caching_sha2_password plugin', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.createUser(user, plugin, password, authConfig);
            });

            beforeEach('invalidate the server authentication cache', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.resetAuthenticationCache(authConfig);
            });

            afterEach('delete user', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                return fixtures.dropUser(user, authConfig);
            });

            it('fails using a configuration object', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                return mysqlx.getSession(authConfig)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1251);
                    });
            });

            it('fails using a URI', () => {
                const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?ssl-mode=DISABLED&auth=${auth}`;

                return mysqlx.getSession(uri)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1251);
                    });
            });
        });

        context('over a Unix socket', () => {
            const socketConfig = { auth, host: undefined, port: undefined, tls: { enabled: false } };

            beforeEach('create user with caching_sha2_password plugin', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return fixtures.createUser(user, plugin, password, authConfig);
            });

            beforeEach('invalidate the server authentication cache', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return fixtures.resetAuthenticationCache(authConfig);
            });

            afterEach('delete user', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return fixtures.dropUser(user, authConfig);
            });

            it('succeeds using a configuration object', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return mysqlx.getSession(authConfig)
                    .then(session => {
                        expect(session.inspect().auth).to.equal(auth);
                        return session.close();
                    });
            });

            it('succeeds using a URI', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})?ssl-mode=DISABLED&auth=${authConfig.auth}`;

                return mysqlx.getSession(uri)
                    .then(session => {
                        expect(session.inspect().auth).to.equal(auth);
                        return session.close();
                    });
            });

            it('fails when a wrong password is provided using a configuration object', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                return mysqlx.getSession(authConfig)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });

            it('fails when a wrong password is provided using a URI', function () {
                const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password: password.concat(crypto.randomBytes(4).toString('hex')) });

                if (!authConfig.socket || os.platform() === 'win32') {
                    return this.skip();
                }

                const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})?ssl-mode=DISABLED&auth=${authConfig.auth}`;

                return mysqlx.getSession(uri)
                    .then(() => expect.fail())
                    .catch(err => {
                        expect(err.info).to.include.keys('code');
                        expect(err.info.code).to.equal(1045);
                        expect(err.message).to.match(/Access denied for user/);
                    });
            });
        });

        context('when debug mode is enabled', () => {
            const script = path.join(__dirname, '..', '..', '..', 'fixtures', 'scripts', 'connection', 'auth.js');
            const debugConfig = { auth, socket: undefined };

            beforeEach('create user with caching_sha2_password plugin', () => {
                const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                return fixtures.createUser(user, plugin, password, authConfig);
            });

            beforeEach('invalidate the server authentication cache', () => {
                const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                return fixtures.resetAuthenticationCache(authConfig);
            });

            afterEach('delete user', () => {
                const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                return fixtures.dropUser(user, authConfig);
            });

            it('logs the appropriate authentication mechanim and data', () => {
                const authConfig = Object.assign({}, config, baseConfig, debugConfig, { user, password });

                return fixtures.collectLogs('protocol:outbound:Mysqlx.Session.AuthenticateStart', script, [authConfig.user, authConfig.password, authConfig.auth], { config: authConfig })
                    .then(proc => {
                        expect(proc.logs).to.have.lengthOf(1);
                        expect(proc.logs[0]).to.contain.keys('mech_name', 'auth_data');
                        expect(proc.logs[0].mech_name).to.equal(authConfig.auth);
                        expect(proc.logs[0].auth_data).to.contain.keys('type', 'data');
                        expect(Buffer.from(proc.logs[0].auth_data.data).toString()).to.have.string(authConfig.user);
                    });
            });
        });
    });

    context('connecting with the SHA256_MEMORY authentication mechanism', () => {
        const auth = 'SHA256_MEMORY';

        context('without a password in the server authentication cache', () => {
            context('over TCP and TLS', () => {
                const tcpConfig = { auth, socket: undefined, tls: { enabled: true } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('fails using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });

                it('fails using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?auth=${auth}`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });
            });

            context('over regular TCP', () => {
                const tcpConfig = { auth, socket: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('fails using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });

                it('fails using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?ssl-mode=DISABLED&auth=${auth}`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });
            });

            context('over a Unix socket', () => {
                const socketConfig = { auth, host: undefined, port: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                afterEach('delete user', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.dropUser(user, authConfig);
                });

                it('fails using a configuration object', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return mysqlx.getSession(authConfig)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });

                it('fails using a URI', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})?ssl-mode=DISABLED&auth=${authConfig.auth}`;

                    return mysqlx.getSession(uri)
                        .then(() => expect.fail())
                        .catch(err => {
                            expect(err.info).to.include.keys('code');
                            expect(err.info.code).to.equal(1045);
                            expect(err.message).to.match(/Access denied for user/);
                        });
                });
            });
        });

        context('with the password in the server authentication cache', () => {
            context('over TCP and TLS', () => {
                const tcpConfig = { auth, socket: undefined, tls: { enabled: true } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                beforeEach('save the password in the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return fixtures.savePasswordInAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeds using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal(auth);
                            return session.close();
                        });
                });

                it('succeeds using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?auth=${auth}`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal(auth);
                            return session.close();
                        });
                });
            });

            context('over regular TCP', () => {
                const tcpConfig = { auth, socket: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                beforeEach('save the password in the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return fixtures.savePasswordInAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeds using a configuration object', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal(auth);
                            return session.close();
                        });
                });

                it('succeeds using a URI', () => {
                    const authConfig = Object.assign({}, config, baseConfig, tcpConfig, { user, password });
                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@${authConfig.host}:${authConfig.port}?ssl-mode=DISABLED&auth=${auth}`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal(auth);
                            return session.close();
                        });
                });
            });

            context('over a Unix socket', () => {
                const socketConfig = { auth, host: undefined, port: undefined, tls: { enabled: false } };

                beforeEach('create user with caching_sha2_password plugin', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                beforeEach('save the password in the server authentication cache', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.savePasswordInAuthenticationCache(authConfig);
                });

                afterEach('delete user', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig);

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return fixtures.dropUser(user, authConfig);
                });

                it('succeeds using a configuration object', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    return mysqlx.getSession(authConfig)
                        .then(session => {
                            expect(session.inspect().auth).to.equal(auth);
                            return session.close();
                        });
                });

                it('succeeds using a URI', function () {
                    const authConfig = Object.assign({}, config, baseConfig, socketConfig, { user, password });

                    if (!authConfig.socket || os.platform() === 'win32') {
                        return this.skip();
                    }

                    const uri = `mysqlx://${authConfig.user}:${authConfig.password}@(${authConfig.socket})?ssl-mode=DISABLED&auth=${authConfig.auth}`;

                    return mysqlx.getSession(uri)
                        .then(session => {
                            expect(session.inspect().auth).to.equal(auth);
                            return session.close();
                        });
                });
            });

            context('when debug mode is enabled', () => {
                const script = path.join(__dirname, '..', '..', '..', 'fixtures', 'scripts', 'connection', 'auth.js');
                const debugConfig = { auth, socket: undefined };

                beforeEach('create user with caching_sha2_password plugin', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                    return fixtures.createUser(user, plugin, password, authConfig);
                });

                beforeEach('invalidate the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                    return fixtures.resetAuthenticationCache(authConfig);
                });

                beforeEach('save the password in the server authentication cache', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig, { user, password });

                    return fixtures.savePasswordInAuthenticationCache(authConfig);
                });

                afterEach('delete user', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig);

                    return fixtures.dropUser(user, authConfig);
                });

                it('logs the appropriate authentication mechanism', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig, { user, password });

                    return fixtures.collectLogs('protocol:outbound:Mysqlx.Session.AuthenticateStart', script, [authConfig.user, authConfig.password, authConfig.auth], { config: authConfig })
                        .then(proc => {
                            expect(proc.logs).to.have.lengthOf(1);
                            expect(proc.logs[0]).to.contain.keys('mech_name', 'auth_data');
                            expect(proc.logs[0].mech_name).to.equal(debugConfig.auth);
                            expect(proc.logs[0].auth_data).to.contain.keys('type', 'data');
                        });
                });

                it('logs the appropriate authentication data', () => {
                    const authConfig = Object.assign({}, config, baseConfig, debugConfig, { user, password });

                    return fixtures.collectLogs('protocol:outbound:Mysqlx.Session.AuthenticateContinue', script, [authConfig.user, authConfig.password, authConfig.auth], { config: authConfig })
                        .then(proc => {
                            expect(proc.logs).to.have.lengthOf(1);
                            expect(proc.logs[0]).to.contain.keys('auth_data');
                            expect(proc.logs[0].auth_data).to.contain.keys('type', 'data');
                            expect(Buffer.from(proc.logs[0].auth_data.data).toString()).to.have.string(authConfig.user);
                        });
                });
            });
        });
    });
});
