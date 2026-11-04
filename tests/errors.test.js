import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyResponse } from '../src/errors.js';

const headers = (o = {}) => new Headers(o);

test('404 is not_found', () => {
  assert.equal(classifyResponse(404, headers()).kind, 'not_found');
});

test('primary rate limit carries the reset time', () => {
  const err = classifyResponse(403, headers({ 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' }));
  assert.equal(err.kind, 'rate_limit');
  assert.equal(err.resetAt.getTime(), 1800000000 * 1000);
});

test('secondary rate limit uses retry-after', () => {
  const err = classifyResponse(403, headers({ 'retry-after': '60' }), { message: 'You have exceeded a secondary rate limit' });
  assert.equal(err.kind, 'rate_limit');
  assert.ok(err.resetAt > new Date());
});

test('other statuses', () => {
  assert.equal(classifyResponse(429, headers()).kind, 'rate_limit');
  assert.equal(classifyResponse(403, headers({ 'x-ratelimit-remaining': '42' })).kind, 'forbidden');
  assert.equal(classifyResponse(502, headers()).kind, 'upstream');
  assert.equal(classifyResponse(418, headers()).kind, 'unknown');
});
