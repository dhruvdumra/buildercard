import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isValidUsername, normalizeUsername } from '../src/username.js';

test('normalizeUsername accepts handles and profile URLs', () => {
  assert.equal(normalizeUsername('  octocat '), 'octocat');
  assert.equal(normalizeUsername('@octocat'), 'octocat');
  assert.equal(normalizeUsername('https://github.com/octocat?tab=repos'), 'octocat');
  assert.equal(normalizeUsername('github.com/octo-cat/'), 'octo-cat');
});

test('isValidUsername follows GitHub naming rules', () => {
  for (const name of ['a', 'octocat', 'octo-cat', 'a1b2', 'x'.repeat(39)]) {
    assert.ok(isValidUsername(name), name);
  }
  for (const name of ['', '-octo', 'octo-', 'oc--to', 'octo cat', 'octo_cat', 'x'.repeat(40), '../etc']) {
    assert.ok(!isValidUsername(name), name);
  }
});
