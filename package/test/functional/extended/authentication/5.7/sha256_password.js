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

const config = require('../../../../config');
const expect = require('chai').expect;
const mysqlx = require('../../../../../');
const path = require('path');

describe('sha256_password authentication plugin on MySQL 5.7', () => {
    // server container (defined in docker.compose.yml)
    const baseConfig = { host: 'mysql-5.7-with-sha256-password-authentication-plugin', schema: undefined };
    const socket = path.join(__dirname, '..', '..', '..', '..', 'fixtures', 'tmp', `${baseConfig.host}.sock`);

    context('connecting without an authentication mechanism', () => {
        it('succeeds over TCP with TLS using PLAIN', () => {
            const authConfig = Object.assign({}, config, baseConfig, { socket: undefined, tls: { enabled: true } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal('PLAIN');
                    return session.close();
                });
        });

        it('succeeds over regular TCP using MYSQL41', () => {
            const authConfig = Object.assign({}, config, baseConfig, { socket: undefined, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal('MYSQL41');
                    return session.close();
                });
        });

        it('succeeds over a Unix socket using PLAIN', () => {
            const authConfig = Object.assign({}, config, baseConfig, { socket, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal('PLAIN');
                    return session.close();
                });
        });
    });

    context('connecting with the MYSQL41 authentication mechanism', () => {
        const auth = 'MYSQL41';

        it('succeeds over TCP with TLS', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket: undefined, tls: { enabled: true } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal(auth);
                    return session.close();
                });
        });

        it('succeeds over regular TCP', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket: undefined, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal(auth);
                    return session.close();
                });
        });

        it('succeeds over a Unix socket', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal(auth);
                    return session.close();
                });
        });
    });

    context('connecting with the PLAIN authentication mechanism', () => {
        const auth = 'PLAIN';

        it('succeeds over TCP with TLS', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket: undefined, tls: { enabled: true } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal(auth);
                    return session.close();
                });
        });

        it('fails over regular TCP', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket: undefined, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(() => expect.fail())
                .catch(err => {
                    expect(err.info).to.include.keys('code');
                    expect(err.info.code).to.equal(1251);
                });
        });

        it('succeeds over a Unix socket', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(session => {
                    expect(session.inspect().auth).to.equal(auth);
                    return session.close();
                });
        });
    });

    context('connecting with the SHA256_MEMORY authentication mechanism', () => {
        const auth = 'SHA256_MEMORY';

        it('fails over TCP with TLS', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket: undefined, tls: { enabled: true } });

            return mysqlx.getSession(authConfig)
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('SHA256_MEMORY authentication is not supported by the server.'));
        });

        it('fails over regular TLS', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket: undefined, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('SHA256_MEMORY authentication is not supported by the server.'));
        });

        it('fails over a Unix socket', () => {
            const authConfig = Object.assign({}, config, baseConfig, { auth, socket, tls: { enabled: false } });

            return mysqlx.getSession(authConfig)
                .then(() => expect.fail())
                .catch(err => expect(err.message).to.equal('SHA256_MEMORY authentication is not supported by the server.'));
        });
    });
});
