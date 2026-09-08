import { readFileSync } from 'node:fs';

// HTML views select prose from specifications; they have no parallel Markdown source.
export function readChapter([, page, specification], docs = new URL('../../docs/', import.meta.url)) {
  const source = readFileSync(new URL('specs/' + specification, docs), 'utf8');
  const start = `<!-- chapter:${page} -->\n`, end = `<!-- /chapter:${page} -->`;
  if (source.split(start).length !== 2 || source.split(end).length !== 2) {
    throw new Error(`Expected exactly one chapter ${page} in ${specification}`);
  }
  const content = source.split(start)[1].split(end)[0];
  let fence = false;
  return content.split('\n').map(line => {
    if (line.startsWith('```')) fence = !fence;
    if (fence || line.startsWith('```')) return line;
    return line.replace(/^(#{3,6}) /, (_, marks) => '#'.repeat(marks.length - 2) + ' ');
  }).join('\n');
}

export function chapterLink(href) {
  if (/^(?:[a-z]+:|#|\/)/i.test(href)) return href;
  if (/^DS\d{3}-.+\.md(?:#.*)?$/.test(href)) {
    const [name, fragment] = href.split('#');
    return `specsLoader.html?spec=${name}${fragment ? '#' + fragment : ''}`;
  }
  return href.startsWith('../') ? href.slice(3) : 'specs/' + href;
}
