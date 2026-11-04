import { langColor } from './colors.js';
import { h } from './dom.js';
import { GitHubError } from './errors.js';
import { clockTime, displayUrl, formatCount, safeUrl, timeAgo } from './format.js';

const TITLES = {
  invalid: 'Check that username',
  not_found: 'User not found',
  rate_limit: 'Rate limit reached',
  forbidden: 'Access blocked',
  upstream: 'GitHub is down',
  network: 'You seem to be offline',
  unknown: 'Something went wrong',
};

const RETRYABLE = new Set(['network', 'upstream', 'unknown']);

const external = (href, attrs = {}) => ({ href, target: '_blank', rel: 'noopener', ...attrs });
const dot = (language) => h('i', { style: `background:${langColor(language)}` });

export function renderLoading(root, username) {
  root.setAttribute('aria-busy', 'true');
  root.replaceChildren(
    h('article', { class: 'card skeleton', 'aria-label': `Loading ${username}` },
      h('div', { class: 'sk-row' },
        h('div', { class: 'sk sk-avatar' }),
        h('div', { class: 'sk-col' },
          h('div', { class: 'sk sk-line w60' }),
          h('div', { class: 'sk sk-line w40' }))),
      h('div', { class: 'sk sk-block' }),
      h('div', { class: 'sk sk-block short' }))
  );
}

function rateLimitDetail(err, viaProxy) {
  let text = viaProxy
    ? "This site's shared GitHub API quota is used up."
    : 'GitHub allows 60 anonymous API calls per hour from one network (about 15 lookups).';

  if (err.resetAt) {
    const minutes = Math.max(1, Math.ceil((err.resetAt - Date.now()) / 60000));
    text += ` It resets at ${clockTime(err.resetAt)} (in ${minutes} min).`;
  }
  return text + ' Profiles you already looked up are still available.';
}

function errorDetail(err, kind, username, viaProxy) {
  if (kind === 'not_found') {
    return `There's no GitHub account called “${username}”. Check the spelling — usernames can't contain spaces or underscores.`;
  }
  if (kind === 'rate_limit') return rateLimitDetail(err, viaProxy);
  return err.message;
}

export function renderError(root, err, username, { viaProxy = false } = {}) {
  root.setAttribute('aria-busy', 'false');

  const kind = err instanceof GitHubError ? err.kind : 'unknown';
  const title = TITLES[kind] || TITLES.unknown;
  const retry = RETRYABLE.has(kind)
    ? h('button', { type: 'button', class: 'retry', 'data-retry': username }, 'Try again')
    : null;

  root.replaceChildren(
    h('div', { class: `error error-${kind}`, role: 'alert' },
      h('strong', {}, title),
      h('p', {}, errorDetail(err, kind, username, viaProxy)),
      retry)
  );
}

function avatarSrc(url) {
  if (!/^https:/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}s=160`;
}

function languageRing(langs) {
  if (!langs.length) return 'var(--line)';
  let start = 0;
  const stops = langs.map((l) => {
    const end = start + l.percent;
    const stop = `${langColor(l.name)} ${start}% ${end}%`;
    start = end;
    return stop;
  });
  return `conic-gradient(${stops.join(', ')})`;
}

function header(card) {
  const blog = safeUrl(card.blog);
  const meta = [
    card.company && h('span', {}, card.company),
    card.location && h('span', {}, card.location),
    blog && h('a', external(blog, { rel: 'noopener nofollow' }), displayUrl(blog)),
    h('span', {}, `Joined ${new Date(card.createdAt).getFullYear()}`),
  ].filter(Boolean);

  return h('header', { class: 'card-head' },
    h('div', { class: 'avatar-ring', style: `background:${languageRing(card.languages)}` },
      h('img', { class: 'avatar', src: avatarSrc(card.avatar), alt: '', width: 80, height: 80 })),
    h('div', { class: 'who' },
      h('h2', {}, card.name, card.type === 'Organization' && h('span', { class: 'badge' }, 'Org')),
      h('a', external(card.url, { class: 'login' }), '@' + card.login),
      card.bio && h('p', { class: 'bio' }, card.bio),
      h('p', { class: 'meta' }, meta)));
}

function stats({ stats: s }) {
  const stat = (label, value) =>
    h('div', { class: 'stat' }, h('span', { class: 'stat-v' }, formatCount(value)), h('span', { class: 'stat-l' }, label));

  return h('div', { class: 'stats' },
    stat('repos', s.repos),
    stat('stars earned', s.stars),
    stat('followers', s.followers),
    stat('following', s.following));
}

function languages({ languages: langs }) {
  if (!langs.length) return h('p', { class: 'empty' }, 'No language data — no original public repos yet.');

  const label = langs.map((l) => `${l.name} ${l.percent}%`).join(', ');
  return h('div', {},
    h('div', { class: 'langbar', role: 'img', 'aria-label': label },
      langs.map((l) => h('span', { style: `width:${l.percent}%;background:${langColor(l.name)}`, title: `${l.name} ${l.percent}%` }))),
    h('ul', { class: 'langs' },
      langs.map((l) => h('li', {}, dot(l.name), l.name, h('em', {}, `${l.percent}%`)))));
}

function repoItem(repo) {
  return h('li', {},
    h('a', external(repo.url, { class: 'repo-name' }), repo.name),
    repo.description && h('p', {}, repo.description),
    h('div', { class: 'repo-meta' },
      repo.language && h('span', {}, dot(repo.language), repo.language),
      h('span', { title: 'Stars' }, '★ ', formatCount(repo.stars)),
      h('span', { title: 'Forks' }, '⑂ ', formatCount(repo.forks)),
      repo.pushedAt && h('span', {}, 'updated ', timeAgo(repo.pushedAt))));
}

function repos({ topRepos: list }) {
  if (!list.length) return h('p', { class: 'empty' }, 'No public repositories.');
  return h('ol', { class: 'repos' }, list.map(repoItem));
}

function activityItem(item) {
  return h('li', { 'data-type': item.type },
    h('span', { class: 'act-text' },
      item.text, ' ',
      h('a', external(`https://github.com/${item.repo}`), item.repo),
      item.times > 1 && h('span', { class: 'times' }, ` ×${item.times}`)),
    h('time', { datetime: item.at, title: new Date(item.at).toLocaleString() }, timeAgo(item.at)));
}

function activity({ activity: items }) {
  if (items === null) return h('p', { class: 'empty' }, 'Recent activity is temporarily unavailable.');
  if (!items.length) return h('p', { class: 'empty' }, 'No public activity in the last 90 days.');
  return h('ul', { class: 'activity' }, items.map(activityItem));
}

function section(index, title, body) {
  return h('section', { class: 'block' },
    h('h3', {}, h('span', { class: 'index' }, String(index).padStart(2, '0')), title),
    body);
}

function sampleNote(card) {
  if (card.reposSampled >= card.stats.repos) return null;
  return h('p', { class: 'fineprint' },
    `Based on the ${card.reposSampled} most recently pushed of ${formatCount(card.stats.repos)} repos.`);
}

export function renderCard(root, card) {
  root.setAttribute('aria-busy', 'false');
  root.replaceChildren(
    h('article', {
      class: 'card',
      'aria-label': `Builder card for ${card.login}`,
      style: `--glow:${langColor(card.languages[0]?.name || 'Other')}`,
    },
      header(card),
      stats(card),
      section(1, 'Languages', languages(card)),
      h('div', { class: 'cols' },
        section(2, 'Top repositories', repos(card)),
        section(3, 'Recent activity', activity(card))),
      sampleNote(card),
      h('div', { class: 'card-actions' },
        h('button', { type: 'button', class: 'ghost', id: 'copy' }, 'Copy link'),
        h('button', { type: 'button', class: 'ghost', 'data-retry': card.login }, 'Refresh')))
  );
}
