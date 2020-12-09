/* Copyright (C) 2020 SURFnet B.V.
 *
 * This program is free software: you can redistribute it and/or modify it
 * under the terms of the GNU General Public License as published by the Free
 * Software Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * This program is distributed in the hope that it will be useful, but WITHOUT
 * ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or
 * FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public License for
 * more details.
 *
 * You should have received a copy of the GNU General Public License along
 * with this program. If not, see http://www.gnu.org/licenses/.
 */

/* eslint-env mocha */

const https = require('https')
const http = require('http')
const querystring = require('querystring')
const path = require('path')
const { GenericContainer, TestContainers, Wait } = require('testcontainers')

let container, testBackend, otherTestBackend, mockOauth
const skipTest = process.env.MOCHA_SKIP === 'integration'

const TEST_BACKEND_CONTAINER_URL = 'http://host.testcontainers.internal:8082/'
const TEST_BACKEND_URL = 'http://localhost:8082/'
const OTHER_TEST_BACKEND_CONTAINER_URL = 'http://host.testcontainers.internal:8083/ooapi/'
const OTHER_TEST_BACKEND_URL = 'http://localhost:8083/ooapi/'
const MOCK_OAUTH_TOKEN_CONTAINER_URL = 'http://host.testcontainers.internal:8084/mock/token'
const MOCK_OAUTH_TOKEN_URL = 'http://localhost:8084/mock/token'
const RATE_LIMIT_MAX = 10
const RATE_LIMIT_WINDOW_MS = 1000

// As reflected in config/credentials.json.test
const testCredentials = {
  fred: 'fred:96557fbdbcf0ac9d83876f17165c0f16',
  barney: 'barney:df9b24c6f9f412f73b70579b049ff993'
}

const httpRequest = (url, { data, ...opts }) => {
  const lib = url.startsWith('https://') ? https : http

  // allow self-signed certificates
  opts = { ...opts, agent: false, rejectUnauthorized: false }

  return new Promise(
    (resolve, reject) => {
      try {
        const req = lib.request(url, opts, (res, req) => {
          let body = ''
          res.on('data', (chunk) => { body += chunk })
          res.on('end', () => {
            res.body = body
            resolve(res)
          })
        })
        if (data) req.write(data)
        req.end()
      } catch (err) {
        reject(err)
      }
    }
  )
}

const httpGet = (url, opts) => httpRequest(url, { ...opts, method: 'GET' })

const httpPost = (url, { params, ...opts }) => {
  const data = querystring.stringify(params)
  return httpRequest(url, {
    data,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(data)
    }
  })
}

module.exports = {
  up: async ({ rateLimitMax, rateLimitWindowMs }) => {
    if (skipTest) return

    testBackend = require('../scripts/test-backend')
    otherTestBackend = require('../scripts/other-test-backend')
    mockOauth = require('../scripts/mock-oauth')

    await TestContainers.exposeHostPorts(8082, 8083, 8084)

    const composeFilePath = path.resolve(__dirname, '..')
    const composeFile = 'Dockerfile.test'
    const image = await GenericContainer
      .fromDockerfile(composeFilePath, composeFile)
      .build()

    container = await image
      .withEnv('OOAPI_TEST_BACKEND_URL', TEST_BACKEND_CONTAINER_URL)
      .withEnv('OOAPI_OTHER_TEST_BACKEND_URL', OTHER_TEST_BACKEND_CONTAINER_URL)
      .withEnv('MOCK_OAUTH_TOKEN_URL', MOCK_OAUTH_TOKEN_CONTAINER_URL)
      .withEnv('RATE_LIMIT_MAX', rateLimitMax || RATE_LIMIT_MAX)
      .withEnv('RATE_LIMIT_WINDOW_MS', rateLimitWindowMs || -RATE_LIMIT_WINDOW_MS)
      .withEnv('LOG_LEVEL', process.env.LOG_LEVEL || 'info')
      .withWaitStrategy(Wait.forLogMessage('gateway https server listening'))
      .withExposedPorts(8080, 4444)
      .start()
  },

  down: async () => {
    if (skipTest) return
    await container.stop()

    testBackend.close()
    otherTestBackend.close()
    mockOauth.close()
  },

  integrationContext: (description, callback) => {
    if (skipTest) {
      describe.skip(description, callback)
    } else {
      describe(description, callback)
    }
  },

  skipTest,
  httpGet,
  httpPost,

  testCredentials,

  gatewayUrl: (app, path) => {
    const auth = app ? testCredentials[app] + '@' : ''
    return `https://${auth}localhost:${container.getMappedPort(4444)}${path || ''}`
  },

  TEST_BACKEND_CONTAINER_URL,
  TEST_BACKEND_URL,
  OTHER_TEST_BACKEND_CONTAINER_URL,
  OTHER_TEST_BACKEND_URL,
  MOCK_OAUTH_TOKEN_CONTAINER_URL,
  MOCK_OAUTH_TOKEN_URL,

  sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms))
}
