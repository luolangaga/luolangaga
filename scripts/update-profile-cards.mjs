import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const owner = process.env.GITHUB_REPOSITORY_OWNER ?? 'luolangaga';
const number = new Intl.NumberFormat('en-US');
const palette = ['#9ef5da', '#bcb1ff', '#95c7ff', '#ffc78f'];

function github(...args) {
  return JSON.parse(execFileSync('gh', ['api', ...args], { encoding: 'utf8' }));
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

function card(title, description, index, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="426" height="178" viewBox="0 0 426 178" role="img" aria-labelledby="title description">
  <title id="title">${escapeXml(title)}</title>
  <desc id="description">${escapeXml(description)}</desc>
  <rect x=".5" y=".5" width="425" height="177" rx="16" fill="#101827" stroke="#35435f"/>
  <g font-family="Segoe UI, Arial, sans-serif">
    <text x="22" y="34" font-size="12" fill="#9ef5da" letter-spacing="2">${index} / GITHUB SNAPSHOT</text>
    <text x="22" y="66" font-size="24" font-weight="700" fill="#f3f6ff">${escapeXml(title)}</text>
    ${content}
  </g>
</svg>
`;
}

function statsCard(repositories, followers) {
  const stars = repositories.reduce((total, repo) => total + repo.stargazers_count, 0);
  const metrics = [
    [stars, 'Stars'],
    [followers, 'Followers'],
    [repositories.length, 'Public repos'],
  ];
  const content = metrics.map(([value, label], index) => {
    const x = 22 + index * 131;
    return `<rect x="${x}" y="88" width="120" height="68" rx="9" fill="#172237"/>
    <text x="${x + 12}" y="119" font-size="24" font-weight="700" fill="#f3f6ff">${number.format(value)}</text>
    <text x="${x + 12}" y="140" font-size="13" fill="#bcc9df">${label}</text>`;
  }).join('\n    ');
  const description = metrics.map(([value, label]) => `${number.format(value)} ${label.toLowerCase()}`).join(', ');
  return card('Open source at a glance', description, '01', content);
}

function languageCard(repositories) {
  const counts = new Map();
  for (const { language } of repositories) {
    if (language) counts.set(language, (counts.get(language) ?? 0) + 1);
  }

  const ranked = [...counts].sort(([left, a], [right, b]) => b - a || left.localeCompare(right, 'en'));
  const total = ranked.reduce((sum, [, count]) => sum + count, 0);
  const leading = ranked.slice(0, 3);
  if (ranked.length > 3) {
    const other = ranked.slice(3).reduce((sum, [, count]) => sum + count, 0);
    leading.push(['Other', other]);
  }

  if (!total) {
    return card('Primary languages', 'No language data is available.', '02',
      '<text x="22" y="112" font-size="14" fill="#bcc9df">No language data available</text>');
  }

  let x = 22;
  const bar = leading.map(([, count], index) => {
    const width = count / total * 382;
    const rect = `<rect x="${x.toFixed(2)}" y="87" width="${width.toFixed(2)}" height="12" fill="${palette[index]}"/>`;
    x += width;
    return rect;
  }).join('\n      ');
  const legend = leading.map(([language, count], index) => {
    const x = 22 + (index % 2) * 195;
    const y = 123 + Math.floor(index / 2) * 24;
    const label = escapeXml(language.length > 19 ? `${language.slice(0, 18)}…` : language);
    return `<circle cx="${x + 4}" cy="${y - 4}" r="4" fill="${palette[index]}"/>
    <text x="${x + 15}" y="${y}" font-size="13" fill="#d9e3f4">${label}</text>
    <text x="${x + 183}" y="${y}" text-anchor="end" font-size="13" fill="#bcc9df">${number.format(count)}</text>`;
  }).join('\n    ');
  const description = leading.map(([language, count]) => `${language}: ${count}`).join(', ');

  return card('Primary languages', `Repositories by primary language. ${description}.`, '02',
    `<clipPath id="bar"><rect x="22" y="87" width="382" height="12" rx="6"/></clipPath>
    <g clip-path="url(#bar)">
      ${bar}
    </g>
    ${legend}`);
}

const { followers } = github(`users/${owner}`);
const pages = github('--paginate', '--slurp', `users/${owner}/repos?type=owner&per_page=100`);
const repositories = pages.flat().filter(repo => !repo.private && !repo.fork);

writeFileSync(new URL('../assets/github-stats.svg', import.meta.url), statsCard(repositories, followers));
writeFileSync(new URL('../assets/languages.svg', import.meta.url), languageCard(repositories));
