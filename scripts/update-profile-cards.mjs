import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const owner = process.env.GITHUB_REPOSITORY_OWNER ?? 'luolangaga';
const number = new Intl.NumberFormat('en-US');
const sectionWidth = 380;

function github(...args) {
  return JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }));
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

function countLanguages(repositories) {
  const counts = new Map();
  for (const { language } of repositories) {
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const ranked = [...counts].sort(([left, a], [right, b]) => b - a || left.localeCompare(right, 'en'));
  const leading = ranked.slice(0, 3);
  if (ranked.length > 3) {
    const other = ranked.slice(3).reduce((sum, [, count]) => sum + count, 0);
    leading.push(['Other', other]);
  }
  return leading;
}

function statsSection(metrics) {
  return `<text x="0" y="21" class="heading">Open source</text>
      <text x="0" y="46" class="caption">Public GitHub activity</text>
      ${metrics.map(([label, value], index) => {
        const x = index * 129;
        return `<text x="${x}" y="99" class="value">${number.format(value)}</text>
      <text x="${x + 1}" y="126" class="label">${label}</text>`;
      }).join('\n      ')}`;
}

function languageSection(languages) {
  const total = languages.reduce((sum, [, count]) => sum + count, 0);
  const heading = `<text x="0" y="21" class="heading">Primary languages</text>
      <text x="0" y="46" class="caption">Public repositories by main language</text>`;
  if (!total) {
    return `${heading}
      <text x="0" y="95" class="label">No language data available</text>`;
  }

  let x = 0;
  const bars = languages.map(([, count], index) => {
    const width = count / total * sectionWidth;
    const bar = `<rect x="${x.toFixed(2)}" y="64" width="${width.toFixed(2)}" height="12" fill="var(--bar${index})"/>`;
    x += width;
    return bar;
  }).join('\n        ');
  const legend = languages.map(([language, count], index) => {
    const x = (index % 2) * 194;
    const y = 104 + Math.floor(index / 2) * 23;
    const label = escapeXml(language.length > 17 ? `${language.slice(0, 16)}…` : language);
    return `<circle cx="${x + 4}" cy="${y - 5}" r="4" fill="var(--bar${index})"/>
      <text x="${x + 16}" y="${y}" class="label">${label}</text>
      <text x="${x + 182}" y="${y}" class="label" text-anchor="end">${number.format(count)}</text>`;
  }).join('\n      ');

  return `${heading}
      <g clip-path="url(#bar)">
        ${bars}
      </g>
      ${legend}`;
}

function snapshot(metrics, languages, mobile) {
  const width = mobile ? 428 : 880;
  const height = mobile ? 337 : 184;
  const description = [
    ...metrics.map(([label, value]) => `${label}: ${number.format(value)}`),
    ...languages.map(([label, value]) => `${label}: ${number.format(value)} repositories`),
  ].join(', ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub snapshot</title>
  <desc id="desc">${escapeXml(description)}</desc>
  <defs>
    <style>
      svg { --base:#f3f8fb; --tint:#cceaf4; --ink:#152c3d; --muted:#435d70; --accent:#14679d; --edge:#cedfe9; --highlight:#fff; --bar0:#2e8ec7; --bar1:#50b3bb; --bar2:#91badb; --bar3:#b7c7d7; }
      @media (prefers-color-scheme:dark) {
        svg { --base:#202b36; --tint:#224558; --ink:#f0f7ff; --muted:#becfdd; --accent:#91cfff; --edge:#445e71; --highlight:#668396; --bar0:#65b7ea; --bar1:#69c5c9; --bar2:#8aaac9; --bar3:#778a9e; }
      }
      text { font-family:Segoe UI Variable, Segoe UI, system-ui, sans-serif; }
      .heading { font-size:24px; font-weight:650; fill:var(--ink); }
      .caption, .label { font-size:15px; fill:var(--muted); }
      .value { font-size:36px; font-weight:650; fill:var(--accent); }
    </style>
    <radialGradient id="mica" cx=".82" cy="0" r=".8">
      <stop stop-color="var(--tint)"/>
      <stop offset="1" stop-color="var(--base)"/>
    </radialGradient>
    <clipPath id="bar"><rect y="64" width="${sectionWidth}" height="12" rx="6"/></clipPath>
  </defs>
  <rect x=".5" y=".5" width="${width - 1}" height="${height - 1}" rx="16" fill="url(#mica)" stroke="var(--edge)"/>
  <path d="M17 1.5h${width - 34}" stroke="var(--highlight)" stroke-opacity=".8"/>
  <path d="${mobile ? 'M24 165h380' : 'M440 23v138'}" stroke="var(--edge)"/>
  <g transform="translate(${mobile ? '24 25' : '28 25'})">
      ${statsSection(metrics)}
  </g>
  <g transform="translate(${mobile ? '24 185' : '468 25'})">
      ${languageSection(languages)}
  </g>
</svg>
`;
}

const { followers } = github(`users/${owner}`);
const pages = github('--paginate', '--slurp', `users/${owner}/repos?type=owner&per_page=100`);
const repositories = pages.flat().filter(repo => !repo.private && !repo.fork);
const stars = repositories.reduce((total, repo) => total + repo.stargazers_count, 0);
const metrics = [['Stars', stars], ['Followers', followers], ['Public repos', repositories.length]];
const languages = countLanguages(repositories);

writeFileSync(new URL('../assets/github-snapshot.svg', import.meta.url), snapshot(metrics, languages, false));
writeFileSync(new URL('../assets/github-snapshot-mobile.svg', import.meta.url), snapshot(metrics, languages, true));
