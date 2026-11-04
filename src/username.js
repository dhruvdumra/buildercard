const USERNAME_RE = /^[a-z\d](?:[a-z\d]|-(?=[a-z\d])){0,38}$/i;
const PROFILE_URL_RE = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/?#\s]+)/i;

export function normalizeUsername(input) {
  const value = String(input ?? '').trim();
  const fromUrl = value.match(PROFILE_URL_RE);
  return (fromUrl ? fromUrl[1] : value).replace(/^@/, '');
}

export function isValidUsername(name) {
  return USERNAME_RE.test(name);
}
