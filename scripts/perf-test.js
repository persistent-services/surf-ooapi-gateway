#!/usr/bin/env node

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

const httpcode = require('../lib/httpcode')
const assert = require('assert').strict

const NANOS_PER_SECOND = 1000000000

// call function f once and return the number of nanoseconds it
// took. This is a Number so precision is limited to 2^53-1
// nanoseconds; about 104 days - more than good enough for our
// purposes

const time = async (f) => {
  const start = process.hrtime.bigint()
  await f()
  return Number(process.hrtime.bigint() - start)
}

const {
  up,
  down,
  gatewayUrl,
  httpGet
} = require('../test/integration.environment.js')

const timerTest = async (description, numRequests, f) => {
  const nanoseconds = await time(async () => { await f(numRequests) })
  console.log(
    '%s: ran %d requests for %s seconds: %s requests / second',
    description,
    numRequests,
    (nanoseconds / NANOS_PER_SECOND).toFixed(2),
    (numRequests * NANOS_PER_SECOND / nanoseconds).toFixed(2)
  )
}

const performanceTest = async () => {
  await up({
    rateLimitMax: 1000000,
    rateLimitWindowMs: 1
  })
  console.log('Ready to run')
  const get = async (i) => {
    const res = await httpGet(gatewayUrl('fred', '/'), {
      headers: {
        'X-Route': 'endpoint=OtherTestBackend'
      }
    })
    assert.equal(res.statusCode, httpcode.OK)
    return i
  }

  console.log('Serial requests throughput')
  await timerTest(
    "serially",
    1000,
    async (numRequests) => {
      for (var i = 0; i < numRequests; i++) {
        await get(i)
      }
    }
  )

  console.log('Requests throughput')

  const tests = [1, 10, 25, 50, 100, 250, 500]
  do {
    const concurrency = tests.shift()
    await timerTest(
      "concurrently <" + concurrency + ">",
      1000,
      async (numRequests) => {
        const promises = []
        for (var t = 0; t < concurrency; t++) {
          promises.push(get(t))
        }
        var i = concurrency
        do {
          t = await Promise.any(promises)
          promises[t] = get(t)
        }
        while (i++ < numRequests)
        return Promise.all(promises)
      }
    )
  }
  while (tests.length > 0)

  await down()
}

module.exports = performanceTest()
