import { GitHubError, classifyResponse } from './errors.js';
import { buildCard } from './shape.js';
import { isValidUsername, normalizeUsername } from './username.js';

const GITHUB_API = 'https://api.github.com';
const MAX_REPO_PAGES = 3;

const PATHS = {
  profile: (user) => `/users/${user}`,
  repos: (user, page = 1) => `/users/${user}/repos?per_page=100&sort=pushed&type=owner&page=${page}`,
  events: (user) => `/users/${user}/events/public?per_page=50`,
};

const DIRECT_HEADERS = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
};

const isAbort = (err) => err?.name === 'AbortError';

function validate(raw) {
  const username = normalizeUsername(raw);
  if (!username) {
    throw new GitHubError('invalid', 'Enter a GitHub username.');
  }
  if (!isValidUsername(username)) {
    throw new GitHubError(
      'invalid',
      'That is not a valid GitHub username (letters, numbers and single hyphens, max 39 characters).'
    );
  }
  return username;
}

export function createClient({ fetchImpl = globalThis.fetch.bind(globalThis), proxyBase = '/api/github', onQuota } = {}) {
  let mode = proxyBase ? 'auto' : 'direct';

  async function viaProxy(resource, username, page, signal) {
    const query = new URLSearchParams({ r: resource, u: username });
    if (page) query.set('page', page);

    let res;
    try {
      res = await fetchImpl(`${proxyBase}?${query}`, { signal, headers: { Accept: 'application/json' } });
    } catch (err) {
      if (isAbort(err) || mode === 'proxy') throw err;
      return null;
    }

    if (!res.headers.get('x-builder-proxy')) return null;
    return res;
  }

  function direct(resource, username, page, signal) {
    return fetchImpl(GITHUB_API + PATHS[resource](username, page), { signal, headers: DIRECT_HEADERS });
  }

  function reportQuota(res) {
    const limit = res.headers.get('x-ratelimit-limit');
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (onQuota && limit && remaining) onQuota({ limit: +limit, remaining: +remaining, via: mode });
  }

  async function request(resource, username, page, signal) {
    let res = null;
    try {
      if (mode !== 'direct') {
        res = await viaProxy(resource, username, page, signal);
        mode = res ? 'proxy' : 'direct';
      }
      res ??= await direct(resource, username, page, signal);
    } catch (err) {
      if (isAbort(err)) throw err;
      throw new GitHubError('network', 'Could not reach GitHub. Check your connection and try again.');
    }

    reportQuota(res);
    const body = await res.json().catch(() => null);
    if (!res.ok) throw classifyResponse(res.status, res.headers, body || {});
    return body;
  }

  async function fetchRepos(username, total, signal) {
    const pages = Math.min(MAX_REPO_PAGES, Math.max(1, Math.ceil(total / 100)));
    const results = await Promise.all(
      Array.from({ length: pages }, (_, i) => request('repos', username, i + 1, signal))
    );
    return results.flat();
  }

  async function fetchEvents(username, signal) {
    try {
      return await request('events', username, undefined, signal);
    } catch (err) {
      if (isAbort(err)) throw err;
      return null;
    }
  }

  return {
    get mode() {
      return mode;
    },

    async fetchCard(raw, { signal } = {}) {
      const username = validate(raw);
      const user = await request('profile', username, undefined, signal);
      const [repos, events] = await Promise.all([
        fetchRepos(user.login, user.public_repos, signal),
        fetchEvents(user.login, signal),
      ]);
      return buildCard(user, repos, events);
    },
  };
}
