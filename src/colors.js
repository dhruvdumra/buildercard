const COLORS = {
  JavaScript: '#f1e05a', TypeScript: '#3178c6', Python: '#3572A5', Java: '#b07219',
  Go: '#00ADD8', Rust: '#dea584', C: '#555555', 'C++': '#f34b7d', 'C#': '#178600',
  PHP: '#4F5D95', Ruby: '#701516', Swift: '#F05138', Kotlin: '#A97BFF', Dart: '#00B4AB',
  Shell: '#89e051', HTML: '#e34c26', CSS: '#563d7c', SCSS: '#c6538c', Vue: '#41b883',
  Svelte: '#ff3e00', 'Jupyter Notebook': '#DA5B0B', Lua: '#000080', Elixir: '#6e4a7e',
  Haskell: '#5e5086', Scala: '#c22d40', Solidity: '#AA6746', Zig: '#ec915c', Nix: '#7e7eff',
  'Objective-C': '#438eff', R: '#198CE7', Perl: '#0298c3', Clojure: '#db5855', Elm: '#60B5CC',
  Dockerfile: '#384d54', MDX: '#fcb32c', Astro: '#ff5a03', OCaml: '#ef7a08', Julia: '#a270ba',
  'Vim Script': '#199f4b', 'Emacs Lisp': '#c065db', TeX: '#3D6117', Makefile: '#427819',
  Other: '#9ca3af',
};

export function langColor(name) {
  if (COLORS[name]) return COLORS[name];
  let hash = 0;
  for (const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  return `hsl(${Math.abs(hash) % 360} 55% 55%)`;
}
