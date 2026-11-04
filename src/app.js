import { readCache, writeCache } from './cache.js';
import { createClient } from './client.js';
import { $ } from './dom.js';
import { renderCard, renderError, renderLoading } from './render.js';
import { normalizeUsername } from './username.js';

const form = $('#search');
const input = $('#username');
const button = $('#go');
const result = $('#result');
const quota = $('#quota');

const client = createClient({
  onQuota: ({ limit, remaining, via }) => {
    quota.textContent = `GitHub API quota: ${remaining}/${limit}${via === 'proxy' ? ' (server)' : ''}`;
  },
});

let current = null;

function updateUrl(username) {
  const url = new URL(location.href);
  if (username) url.searchParams.set('u', username);
  else url.searchParams.delete('u');
  history.pushState({ u: username }, '', url);
}

async function lookup(raw, { push = true, force = false } = {}) {
  const username = normalizeUsername(raw);
  input.value = username;
  if (push) updateUrl(username);
  document.title = username ? `${username} · Builder Card` : 'Builder Card';

  const key = username.toLowerCase();
  const cached = !force && readCache(key);
  if (cached) {
    renderCard(result, cached);
    return;
  }

  current?.abort();
  const controller = new AbortController();
  current = controller;
  button.disabled = true;
  renderLoading(result, username);

  try {
    const card = await client.fetchCard(username, { signal: controller.signal });
    writeCache(key, card);
    if (current === controller) renderCard(result, card);
  } catch (err) {
    if (err.name !== 'AbortError' && current === controller) {
      renderError(result, err, username, { viaProxy: client.mode === 'proxy' });
    }
  } finally {
    if (current === controller) {
      button.disabled = false;
      current = null;
    }
  }
}

async function copyLink(btn) {
  try {
    await navigator.clipboard.writeText(location.href);
    btn.textContent = 'Copied!';
  } catch {
    btn.textContent = 'Copy failed';
  }
  setTimeout(() => (btn.textContent = 'Copy link'), 1500);
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  lookup(input.value);
});

document.addEventListener('click', (e) => {
  const retry = e.target.closest('[data-retry]');
  if (retry) return lookup(retry.dataset.retry, { push: false, force: true });

  if (e.target.id === 'copy') copyLink(e.target);
});

window.addEventListener('popstate', () => {
  const username = new URL(location.href).searchParams.get('u');
  if (username) {
    lookup(username, { push: false });
  } else {
    input.value = '';
    result.replaceChildren();
  }
});

const initial = new URL(location.href).searchParams.get('u');
if (initial) lookup(initial, { push: false });
else input.focus();
