export class GitHubError extends Error {
  constructor(kind, message, extra = {}) {
    super(message);
    this.name = 'GitHubError';
    this.kind = kind;
    Object.assign(this, extra);
  }
}

function resetTime(headers) {
  const reset = Number(headers?.get('x-ratelimit-reset'));
  if (reset) return new Date(reset * 1000);

  const retryAfter = Number(headers?.get('retry-after'));
  if (retryAfter) return new Date(Date.now() + retryAfter * 1000);

  return null;
}

function isRateLimited(status, headers, message) {
  if (status === 429) return true;
  if (status !== 403) return false;
  return headers?.get('x-ratelimit-remaining') === '0' || /rate limit/i.test(message);
}

export function classifyResponse(status, headers, body = {}) {
  const message = body?.message || '';

  if (status === 404) {
    return new GitHubError('not_found', 'No GitHub user or organisation with that name.');
  }
  if (isRateLimited(status, headers, message)) {
    return new GitHubError('rate_limit', 'GitHub API rate limit reached.', { resetAt: resetTime(headers) });
  }
  if (status === 403 || status === 451) {
    return new GitHubError('forbidden', message || 'GitHub refused access to this profile.');
  }
  if (status >= 500) {
    return new GitHubError('upstream', 'GitHub is having trouble right now. Try again shortly.');
  }
  return new GitHubError('unknown', message || `Unexpected response from GitHub (${status}).`);
}
