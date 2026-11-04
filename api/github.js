const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;

const RESOURCES = {
  profile: (u) => `/users/${u}`,
  repos: (u, page) => `/users/${u}/repos?per_page=100&sort=pushed&type=owner&page=${page}`,
  events: (u) => `/users/${u}/events/public?per_page=50`,
};

const PASS_HEADERS = ['x-ratelimit-limit', 'x-ratelimit-remaining', 'x-ratelimit-reset', 'retry-after'];

function cachePolicy(status) {
  if (status >= 200 && status < 300) return 'public, s-maxage=300, stale-while-revalidate=600';
  if (status === 404) return 'public, s-maxage=60';
  return 'no-store';
}

export default async function handler(req, res) {
  res.setHeader('x-builder-proxy', '1');
  res.setHeader('content-type', 'application/json; charset=utf-8');

  const send = (status, body, cache = 'no-store') => {
    res.statusCode = status;
    res.setHeader('cache-control', cache);
    res.end(JSON.stringify(body));
  };

  if (req.method !== 'GET') return send(405, { message: 'Method not allowed' });

  const q = new URL(req.url, 'http://localhost').searchParams;
  const resource = q.get('r');
  const user = q.get('u') || '';
  const page = Math.min(Math.max(parseInt(q.get('page') || '1', 10) || 1, 1), 10);

  if (!RESOURCES[resource]) return send(400, { message: 'Unknown resource' });
  if (!USERNAME_RE.test(user)) return send(400, { message: 'Invalid username' });

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'builder-card',
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  let upstream;
  try {
    upstream = await fetch('https://api.github.com' + RESOURCES[resource](user, page), {
      headers,
      signal: AbortSignal.timeout(8000),
    });
  } catch {
    return send(502, { message: 'Could not reach GitHub' });
  }

  for (const h of PASS_HEADERS) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }

  const text = await upstream.text();
  res.statusCode = upstream.status;
  res.setHeader('cache-control', cachePolicy(upstream.status));
  res.end(text || '{}');
}
