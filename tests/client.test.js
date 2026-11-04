import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '../src/client.js';
import { GitHubError } from '../src/errors.js';

const user = {
  login: 'octo',
  name: 'Octo',
  public_repos: 2,
  followers: 1,
  following: 0,
  avatar_url: 'a',
  html_url: 'h',
  created_at: '2020-01-01T00:00:00Z',
};

const repo = (name, o = {}) => ({
  name, html_url: '', language: 'JavaScript', stargazers_count: 0, forks_count: 0, fork: false, ...o,
});

function fakeFetch(routes, { proxy = false } = {}) {
  const calls = [];
  const fetchImpl = async (url) => {
    calls.push(url);
    if (url.startsWith('/api/github') && !proxy) {
      return new Response('<html>404</html>', { status: 404, headers: { 'content-type': 'text/html' } });
    }
    const match = Object.keys(routes).find((key) => url.includes(key));
    if (!match) throw new TypeError('network down');
    const [status, body, headers = {}] = routes[match];
    return new Response(JSON.stringify(body), {
      status,
      headers: { ...headers, ...(proxy && { 'x-builder-proxy': '1' }) },
    });
  };
  fetchImpl.calls = calls;
  return fetchImpl;
}

test('falls back to the GitHub API on a static host', async () => {
  const fetchImpl = fakeFetch({
    '/users/octo/repos': [200, [repo('one', { stargazers_count: 3 }), repo('two', { language: 'Go' })]],
    '/users/octo/events': [200, []],
    '/users/octo': [200, user],
  });
  const client = createClient({ fetchImpl });
  const card = await client.fetchCard('@octo');

  assert.equal(client.mode, 'direct');
  assert.equal(card.stats.stars, 3);
  assert.equal(card.topRepos[0].name, 'one');
  assert.deepEqual(card.activity, []);
  assert.equal(fetchImpl.calls.filter((url) => url.startsWith('/api')).length, 1);
});

test('uses the proxy when it is deployed', async () => {
  const fetchImpl = fakeFetch({
    'r=repos': [200, []],
    'r=events': [200, []],
    'r=profile': [200, { ...user, public_repos: 0 }],
  }, { proxy: true });
  const client = createClient({ fetchImpl });
  await client.fetchCard('octo');

  assert.equal(client.mode, 'proxy');
  assert.ok(fetchImpl.calls.every((url) => url.startsWith('/api/github')));
});

test('unknown user is not_found and bad input never hits the network', async () => {
  const fetchImpl = fakeFetch({ '/users/ghost': [404, { message: 'Not Found' }] });
  const client = createClient({ fetchImpl });

  await assert.rejects(client.fetchCard('ghost'), (e) => e instanceof GitHubError && e.kind === 'not_found');

  const before = fetchImpl.calls.length;
  await assert.rejects(client.fetchCard('bad name!'), (e) => e.kind === 'invalid');
  assert.equal(fetchImpl.calls.length, before);
});

test('rate limit error includes the reset time', async () => {
  const fetchImpl = fakeFetch({
    '/users/octo': [403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1800000000' }],
  });
  await assert.rejects(
    createClient({ fetchImpl }).fetchCard('octo'),
    (e) => e.kind === 'rate_limit' && e.resetAt instanceof Date
  );
});

test('a failing events call still returns a card', async () => {
  const fetchImpl = fakeFetch({
    '/users/octo/repos': [200, []],
    '/users/octo/events': [500, {}],
    '/users/octo': [200, user],
  });
  const card = await createClient({ fetchImpl }).fetchCard('octo');
  assert.equal(card.activity, null);
});

test('network failure becomes a network error', async () => {
  await assert.rejects(
    createClient({ fetchImpl: fakeFetch({}), proxyBase: '' }).fetchCard('octo'),
    (e) => e.kind === 'network'
  );
});
