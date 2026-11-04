const byPopularity = (a, b) =>
  b.stargazers_count - a.stargazers_count ||
  b.forks_count - a.forks_count ||
  Date.parse(b.pushed_at || 0) - Date.parse(a.pushed_at || 0);

export function topRepos(repos, limit = 6) {
  const original = repos.filter((r) => !r.fork && !r.archived);
  const pool = original.length ? original : repos;

  return [...pool]
    .sort(byPopularity)
    .slice(0, limit)
    .map((r) => ({
      name: r.name,
      url: r.html_url,
      description: r.description || '',
      language: r.language || null,
      stars: r.stargazers_count,
      forks: r.forks_count,
      pushedAt: r.pushed_at,
    }));
}

export function languageBreakdown(repos, max = 5) {
  const counts = new Map();
  for (const repo of repos) {
    if (repo.fork || !repo.language) continue;
    counts.set(repo.language, (counts.get(repo.language) || 0) + 1);
  }

  const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
  if (!total) return [];

  const sorted = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const keep = sorted.length === max + 1 ? sorted.length : max;
  const shown = sorted.slice(0, keep);
  const otherCount = sorted.slice(keep).reduce((sum, [, n]) => sum + n, 0);
  if (otherCount) shown.push(['Other', otherCount]);

  return shown.map(([name, count]) => ({
    name,
    count,
    percent: Math.round((count / total) * 1000) / 10,
  }));
}

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const capitalize = (s) => (s ? s[0].toUpperCase() + s.slice(1) : '');
const squash = (s) => s.replace(/\s+/g, ' ');

function describePush(payload) {
  const commits = payload.size ?? payload.distinct_size ?? payload.commits?.length;
  const branch = (payload.ref || '').replace('refs/heads/', '');
  const count = commits ? `${plural(commits, 'commit')} ` : '';
  return branch ? `Pushed ${count}to ${branch} in` : `Pushed ${count}to`;
}

function describePullRequest(payload) {
  const pr = payload.pull_request || {};
  const action = payload.action === 'closed' ? (pr.merged ? 'Merged' : 'Closed') : capitalize(payload.action);
  return `${action} PR #${payload.number ?? pr.number ?? ''} in`;
}

const DESCRIBERS = {
  PushEvent: describePush,
  PullRequestEvent: describePullRequest,
  CreateEvent: (p) => (p.ref_type === 'repository' ? 'Created repository' : squash(`Created ${p.ref_type} ${p.ref || ''} in`)),
  DeleteEvent: (p) => squash(`Deleted ${p.ref_type} ${p.ref || ''} in`),
  PullRequestReviewEvent: () => 'Reviewed a PR in',
  PullRequestReviewCommentEvent: () => 'Commented on a PR review in',
  IssuesEvent: (p) => `${capitalize(p.action)} issue #${p.issue?.number ?? ''} in`,
  IssueCommentEvent: (p) => `Commented on #${p.issue?.number ?? ''} in`,
  WatchEvent: () => 'Starred',
  ForkEvent: () => 'Forked',
  ReleaseEvent: (p) => `Released ${p.release?.tag_name || 'a new version'} of`,
  PublicEvent: () => 'Open-sourced',
  MemberEvent: () => 'Joined as collaborator on',
  GollumEvent: () => 'Updated the wiki of',
};

export function describeEvent(event) {
  const describe = DESCRIBERS[event.type];
  return describe ? describe(event.payload || {}) : null;
}

export function summarizeEvents(events, limit = 8) {
  const lines = [];

  for (const event of events) {
    const text = describeEvent(event);
    if (!text) continue;

    const repo = event.repo?.name || '';
    const last = lines.at(-1);
    if (last && last.text === text && last.repo === repo) {
      last.times += 1;
      continue;
    }
    if (lines.length === limit) break;

    lines.push({ type: event.type, text, repo, at: event.created_at, times: 1 });
  }

  return lines;
}

export function buildCard(user, repos, events) {
  const stars = repos
    .filter((r) => !r.fork)
    .reduce((sum, r) => sum + (r.stargazers_count || 0), 0);

  return {
    login: user.login,
    name: user.name || user.login,
    avatar: user.avatar_url,
    url: user.html_url,
    bio: user.bio || '',
    type: user.type,
    company: user.company || '',
    location: user.location || '',
    blog: user.blog || '',
    createdAt: user.created_at,
    stats: {
      repos: user.public_repos,
      followers: user.followers,
      following: user.following,
      stars,
    },
    topRepos: topRepos(repos),
    languages: languageBreakdown(repos),
    activity: events === null ? null : summarizeEvents(events),
    reposSampled: repos.length,
  };
}
