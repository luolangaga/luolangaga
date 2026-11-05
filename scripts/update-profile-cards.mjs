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
  const total = leading.reduce((sum, [, count]) => sum + count, 0);
  if (!total) return [];

  // Allocate any rounding difference to the largest remainders.
  const shares = leading.map(([language, count]) => ({
    language,
    count,
    percent: Math.floor(count * 100 / total),
    remainder: (count * 100) % total,
  }));
  const unallocated = 100 - shares.reduce((sum, { percent }) => sum + percent, 0);
  const largestRemainders = [...shares].sort((a, b) => b.remainder - a.remainder);
  for (const share of largestRemainders.slice(0, unallocated)) {
    share.percent++;
  }
  return shares;
}

function statsSection(metrics) {
  return `<text x="0" y="21" class="heading">Open source</text>
      <path d="M0 29q68 4 156-1" class="underline green"/>
      <text x="0" y="46" class="caption">Public GitHub activity</text>
      <g transform="translate(0 75)" stroke-linecap="round" stroke-linejoin="round">
        <path d="m12-3 4 8 9 1-6 6 1 9-8-4-8 4 1-9-7-6 10-2Z" fill="var(--gold)" stroke="var(--star-ink)" stroke-width="1.7"/>
        <path d="m10 3-2 5-5 1" fill="none" stroke="#fff7da" stroke-width="1.6"/>
      </g>
      ${metrics.map(([label, value], index) => {
        const valueX = [30, 151, 280][index];
        const formatted = number.format(value);
        const fit = formatted.length > 5 ? ' textLength="105" lengthAdjust="spacingAndGlyphs"' : '';
        return `<text x="${valueX}" y="98" class="value"${fit}>${formatted}</text>
      <text x="${valueX}" y="125" class="label">${label}</text>`;
      }).join('\n      ')}`;
}

function languageSection(languages) {
  const total = languages.reduce((sum, { count }) => sum + count, 0);
  const heading = `<text x="0" y="21" class="heading">Primary languages</text>
      <path d="M1 28q100 5 247 0" class="underline blue"/>
      <text x="0" y="46" class="caption">Share of public repos by main language</text>`;
  if (!total) {
    return `${heading}
      <text x="0" y="95" class="label">No language data available</text>`;
  }

  let x = 0;
  const bars = languages.map(({ count }, index) => {
    const width = count / total * sectionWidth;
    const bar = `<rect x="${x.toFixed(2)}" y="64" width="${width.toFixed(2)}" height="12" fill="var(--bar${index})"/>`;
    x += width;
    return bar;
  }).join('\n        ');
  const legend = languages.map(({ language, percent }, index) => {
    const x = (index % 2) * 194;
    const y = 104 + Math.floor(index / 2) * 23;
    const label = escapeXml(language.length > 17 ? `${language.slice(0, 16)}…` : language);
    return `<circle cx="${x + 4}" cy="${y - 5}" r="4" fill="var(--bar${index})"/>
      <text x="${x + 16}" y="${y}" class="label">${label}</text>
      <text x="${x + 182}" y="${y}" class="label" text-anchor="end">${percent}%</text>`;
  }).join('\n      ');

  return `${heading}
      <g clip-path="url(#bar)">
        ${bars}
      </g>
      <path d="M6 64q93 1 188 0t180 0q6 0 6 6t-6 6H6q-6 0-6-6t6-6Z" fill="none" stroke="var(--rule)" stroke-width="1.1"/>
      ${legend}`;
}

function snapshot(metrics, languages, mobile) {
  const width = mobile ? 428 : 880;
  const height = mobile ? 337 : 184;
  const frame = `M16 3Q${width / 4} .5 ${width / 2} 3T${width - 17} 3Q${width - 3} 3 ${width - 3} 17L${width - 2} ${height - 19}Q${width - 3} ${height - 5} ${width - 17} ${height - 5}Q${width / 2} ${height - 2} 16 ${height - 5}Q2 ${height - 6} 3 ${height - 20}L2 18Q2 4 16 3Z`;
  const description = [
    ...metrics.map(([label, value]) => `${label}: ${number.format(value)}`),
    ...languages.map(({ language, percent }) => `${language}: ${percent}%`),
  ].join(', ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">GitHub snapshot</title>
  <desc id="desc">${escapeXml(description)}</desc>
  <defs>
    <style>
      svg { --paper:#fff8e9; --ink:#514334; --muted:#675749; --edge:#d1c4a8; --rule:#b4a982; --green:#a5b966; --blue:#88bfc4; --gold:#f3ce73; --star-ink:#765536; --bar0:#a2b968; --bar1:#81bcc9; --bar2:#dfbd73; --bar3:#bca187; }
      @media (prefers-color-scheme:dark) {
        svg { --paper:#2b2c25; --ink:#fbefd9; --muted:#ded0b6; --edge:#555b47; --rule:#807d61; --green:#a2bb76; --blue:#88b8bd; --gold:#eec76c; --star-ink:#655035; --bar0:#a8bf76; --bar1:#85bec8; --bar2:#d7b871; --bar3:#b5a083; }
      }
      text { font-family:"Segoe Print","Comic Sans MS","Chalkboard SE","Trebuchet MS",sans-serif; }
      .heading { font-size:23px; font-weight:700; fill:var(--ink); }
      .caption, .label { font-size:14px; fill:var(--muted); }
      .value { font-size:31px; font-weight:700; fill:var(--ink); }
      .underline { fill:none; stroke-width:2.4; stroke-linecap:round; }
      .green { stroke:var(--green); }
      .blue { stroke:var(--blue); }
    </style>
    <path id="sheet" d="${frame}"/>
    <pattern id="dots" width="14" height="14" patternUnits="userSpaceOnUse">
      <circle cx="7" cy="7" r=".8" fill="var(--rule)" opacity=".23"/>
    </pattern>
    <clipPath id="bar"><rect y="64" width="${sectionWidth}" height="12" rx="6"/></clipPath>
  </defs>
  <use href="#sheet" transform="translate(0 2)" fill="var(--edge)" opacity=".6"/>
  <use href="#sheet" fill="var(--paper)" stroke="var(--edge)" stroke-width="1.6"/>
  <use href="#sheet" fill="url(#dots)"/>
  <path d="${mobile ? 'M24 165q184-3 380 1' : 'M440 23q3 68-1 138'}" fill="none" stroke="var(--rule)" stroke-width="1.4" stroke-dasharray="4 5" stroke-linecap="round"/>
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
