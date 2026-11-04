import { test } from 'node:test';
import assert from 'node:assert/strict';
import { languageBreakdown, summarizeEvents, topRepos } from '../src/shape.js';

const repo = (name, o = {}) => ({
  name,
  html_url: `https://github.com/x/${name}`,
  description: null,
  language: 'JavaScript',
  stargazers_count: 0,
  forks_count: 0,
  fork: false,
  archived: false,
  pushed_at: '2026-01-01T00:00:00Z',
  ...o,
});

const event = (type, name, payload = {}) => ({
  type,
  repo: { name },
  payload,
  created_at: '2026-11-01T00:00:00Z',
});

test('topRepos skips forks and archived repos, ranks by stars then forks', () => {
  const ranked = topRepos([
    repo('a', { stargazers_count: 5 }),
    repo('b', { stargazers_count: 50, fork: true }),
    repo('c', { stargazers_count: 10 }),
    repo('d', { stargazers_count: 10, forks_count: 3 }),
    repo('e', { stargazers_count: 99, archived: true }),
  ]);
  assert.deepEqual(ranked.map((r) => r.name), ['d', 'c', 'a']);
});

test('topRepos falls back to forks when there is nothing else', () => {
  assert.equal(topRepos([repo('f', { fork: true })]).length, 1);
});

test('languageBreakdown groups the tail into Other', () => {
  const repos = [
    ...['Go', 'Go', 'Go', 'Rust', 'Rust', 'C', 'Zig', 'Lua', 'Nix'].map((language, i) => repo(`r${i}`, { language })),
    repo('forked', { language: 'Go', fork: true }),
    repo('nolang', { language: null }),
  ];
  const langs = languageBreakdown(repos, 3);
  assert.deepEqual(langs.map((l) => l.name), ['Go', 'Rust', 'C', 'Other']);
  assert.equal(langs[0].percent, 33.3);
  assert.equal(langs.at(-1).count, 3);
});

test('languageBreakdown does not make an Other bucket for a single language', () => {
  const repos = ['Go', 'Rust', 'C'].map((language, i) => repo(`r${i}`, { language }));
  assert.deepEqual(languageBreakdown(repos, 2).map((l) => l.name), ['C', 'Go', 'Rust']);
  assert.deepEqual(languageBreakdown([]), []);
});

test('summarizeEvents describes events and collapses repeats', () => {
  const lines = summarizeEvents([
    event('PushEvent', 'me/app', { size: 2, ref: 'refs/heads/main' }),
    event('PushEvent', 'me/app', { size: 2, ref: 'refs/heads/main' }),
    event('SponsorshipEvent', 'me/app'),
    event('PullRequestEvent', 'org/lib', { action: 'closed', number: 7, pull_request: { merged: true } }),
    event('PushEvent', 'me/app', { ref: 'refs/heads/dev' }),
    event('WatchEvent', 'cool/tool'),
  ]);
  assert.deepEqual(lines.map((l) => [l.text, l.repo, l.times]), [
    ['Pushed 2 commits to main in', 'me/app', 2],
    ['Merged PR #7 in', 'org/lib', 1],
    ['Pushed to dev in', 'me/app', 1],
    ['Starred', 'cool/tool', 1],
  ]);
});
