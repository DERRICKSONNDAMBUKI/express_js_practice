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
const expect = require('chai').expect;
const fixtures = require('../../../fixtures');
const mysqlx = require('../../../../');
const path = require('path');

describe('connecting with SSL/TLS', () => {
    const baseConfig = { host: config.host, password: config.password, port: config.port, schema: undefined, socket: undefined, user: config.user };

    context('using a configuration object', () => {
        it('succeeds and enables TLS by default', () => {
            const tlsConfig = Object.assign({}, baseConfig);

            return mysqlx.getSession(tlsConfig)
                .then(session => {
                    expect(session.inspect()).to.have.property('ssl', true);
                    return session.close();
                });
        });

        it('succeeds with TLS explicitly disabled', () => {
            const tlsConfig = Object.assign({}, baseConfig, { tls: { enabled: false } });

            return mysqlx.getSession(tlsConfig)
                .then(session => {
                    expect(session.inspect()).to.have.property('ssl', false);
                    return session.close();
                });
        });
    });

    context('using a URI', () => {
        it('succeeds and enables TLS by default', () => {
            const tlsConfig = Object.assign({}, baseConfig);
            const uri = `mysqlx://${tlsConfig.user}:${tlsConfig.password}@${tlsConfig.host}:${tlsConfig.port}`;

            return mysqlx.getSession(uri)
                .then(session => {
                    expect(session.inspect()).to.have.property('ssl', true);
                    return session.close();
                });
        });

        it('succeeds with TLS explicitly disabled', () => {
            const tlsConfig = Object.assign({}, baseConfig);
            const uri = `mysqlx://${tlsConfig.user}:${tlsConfig.password}@${tlsConfig.host}:${tlsConfig.port}?ssl-mode=DISABLED`;

            return mysqlx.getSession(uri)
                .then(session => {
                    expect(session.inspect()).to.have.property('ssl', false);
                    return session.close();
                });
        });
    });

    context('when debug mode is enabled', () => {
        it('logs the tls setup request', () => {
            // TLS is only available over TCP connections
            // The socket should be null since JSON.stringify() removes undefined properties
            const scriptConfig = { socket: null };
            const script = path.join(__dirname, '..', '..', '..', 'fixtures', 'scripts', 'connection', 'default.js');

            return fixtures.collectLogs('protocol:outbound:Mysqlx.Connection.CapabilitiesSet', script, [JSON.stringify(scriptConfig)])
                .then(proc => {
                    expect(proc.logs).to.have.lengthOf(1);
                    expect(proc.logs[0]).to.contain.keys('capabilities');
                    expect(proc.logs[0].capabilities).to.contain.keys('capabilities');
                    expect(proc.logs[0].capabilities.capabilities).to.be.an('array').and.have.lengthOf(2);
                    // The capability should be the first in the list (capabilities[0]).
                    expect(proc.logs[0].capabilities.capabilities[0].name).to.equal('tls');
                    expect(proc.logs[0].capabilities.capabilities[0].value).to.contain.keys('scalar');
                    expect(proc.logs[0].capabilities.capabilities[0].value.scalar).to.contain.keys('v_bool');
                    return expect(proc.logs[0].capabilities.capabilities[0].value.scalar.v_bool).to.be.true;
                });
        });
    });
});
