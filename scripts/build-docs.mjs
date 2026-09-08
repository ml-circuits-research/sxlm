import { readFileSync, writeFileSync, readdirSync, copyFileSync } from 'node:fs';
import { groups, sources, slug } from './docs/catalog.mjs';
import { renderMarkdown, escapeHTML as esc } from './docs/markdown.mjs';
import { readChapter, chapterLink } from './docs/chapters.mjs';

const root = new URL('../docs/', import.meta.url);
copyFileSync(new URL('./docs/specsLoader.html', import.meta.url), new URL('specsLoader.html', root));
copyFileSync(new URL('./docs/nojekyll', import.meta.url), new URL('.nojekyll', root));
const read = name => readFileSync(new URL(name, root), 'utf8');
const write = (name, source) => writeFileSync(new URL(name, root), source + '\n');
const target = chapterLink;
const navigation = groups.map(([label, pages], index) => `<div class="nav-menu"><button type="button" aria-expanded="false" aria-controls="menu-${index}">${label}<span aria-hidden="true"> ▾</span></button><div id="menu-${index}" class="submenu" hidden>${pages.map(([label, href]) => `<a href="${href}">${label}</a>`).join('')}</div></div>`).join('\n');
const header = `<header class="site-header"><strong class="site-title">SXLM Documentation</strong><nav aria-label="Primary">${navigation}</nav></header>`;
write('partials/header.html', header);
write('partials/footer.html', '<footer class="site-footer">SXLM · Symbolic language, explicit evidence.</footer>');
const map = `<section aria-labelledby="documentation-map"><h2 id="documentation-map">Documentation Map</h2><div class="table-wrap"><table class="documentation-map"><thead><tr>${groups.map(([label]) => `<th scope="col">${label}</th>`).join('')}</tr></thead><tbody>${Array.from({ length: Math.max(...groups.map(([, pages]) => pages.length)) }, (_, i) => `<tr>${groups.map(([, pages]) => pages[i] ? `<td><a href="${pages[i][1]}">${pages[i][0]}</a><p>${pages[i][2]}</p></td>` : '<td></td>').join('')}</tr>`).join('')}</tbody></table></div><p>Start with Overview and Usage in Start, then use Interfaces for integration. Model explains the execution contracts before Learning introduces Training and Evaluation. Reference contains the normative Specifications and canonical Wiki. Design decisions connects measured limits to extension and scaling choices.</p></section>`;
const mermaid = read('partials/diagrams.html').trim();
for (const entry of sources) {
  const [, page] = entry;
  let content = renderMarkdown(readChapter(entry, root), {
    target, headingId: (text, level) => page === 'wiki' && level === 2 ? 'definition-' + slug(text) : slug(text),
  }).replace('<!-- documentation-map -->', map);
  const name = groups.flatMap(([, pages]) => pages).find(([, href]) => href === page + '.html')?.[0] ?? page;
  write(page + '.html', `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>SXLM Documentation</title><link rel="stylesheet" href="styles.css">${mermaid}<script src="partials-loader.js" defer></script></head><body>\n<a class="skip-link" href="#main-content">Skip to content</a>\n<div data-include="partials/header.html">${header}</div>\n<main id="main-content" class="page"><article class="page__panel"><p class="breadcrumb"><a href="index.html">Home</a> / ${esc(name)}</p>\n${content}\n</article></main><div data-include="partials/footer.html"><footer class="site-footer">SXLM · Symbolic language, explicit evidence.</footer></div>\n</body></html>`);
}
// Keep the matrix reproducible without a runtime dependency on installed agent tooling.
const specs = readdirSync(new URL('specs/', root)).filter(name => /^DS\d{3}-.+\.md$/.test(name)).sort();
const rows = specs.map((name, i) => {
  if (!name.startsWith(`DS${String(i).padStart(3, '0')}-`)) throw new Error('Non-contiguous DS numbering');
  const source = read('specs/' + name), front = /^---\ntitle: (.+)\nsummary: (.+)\n---\n/.exec(source);
  if (!front || front[1] !== name.slice(0, -3)) throw new Error(`Invalid DS frontmatter: ${name}`);
  return `| [${front[1]}](specsLoader.html?spec=${name}) | ${front[2]} |`;
});
write('specs/matrix.md', '# Specification Matrix\n\n| Name | Description |\n| --- | --- |\n' + rows.join('\n'));
console.log(`Built ${sources.length} documentation chapters and ${specs.length} specification entries.`);
