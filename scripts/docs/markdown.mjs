export const escapeHTML = value => value.replace(/&/g, '&amp;').replace(/</g, '&lt;')
  .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Deliberately small renderer for repository-owned documentation, not model input.
export function renderMarkdown(source, { headingId, target = value => value } = {}) {
  const inline = source => {
    const stored = [];
    const hold = html => `\u0001${stored.push(html) - 1}\u0001`;
    let text = source.replace(/`([^`]+)`/g, (_, code) => hold(`<code>${escapeHTML(code)}</code>`));
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
      hold(`<a href="${escapeHTML(target(href))}">${escapeHTML(label)}</a>`));
    text = escapeHTML(text).replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Restore repeatedly so inline code in a link label keeps its own escaping.
    for (let n = 0; n <= stored.length; n++) {
      text = text.replace(/\u0001(\d+)\u0001/g, (_, index) => stored[Number(index)]);
    }
    return text;
  };
  const lines = source.split('\n'), output = [];
  let paragraph = [], list = [], ordered = false;
  const flush = () => {
    if (paragraph.length) output.push(`<p>${inline(paragraph.join(' '))}</p>`);
    if (list.length) {
      const tag = ordered ? 'ol' : 'ul';
      output.push(`<${tag}>${list.map(item => `<li>${inline(item)}</li>`).join('')}</${tag}>`);
    }
    paragraph = []; list = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i], trimmed = line.trim();
    if (!trimmed) { flush(); continue; }
    if (trimmed === '<!-- documentation-map -->') { flush(); output.push(trimmed); continue; }
    if (trimmed.startsWith('```')) {
      flush(); const language = trimmed.slice(3), code = [];
      while (++i < lines.length && !lines[i].trim().startsWith('```')) code.push(lines[i]);
      if (i === lines.length) throw new Error('Unclosed documentation fence');
      output.push(language === 'mermaid'
        ? `<figure class="diagram"><pre class="mermaid">${escapeHTML(code.join('\n'))}</pre><figcaption><em>Reasoning and evidence flow</em></figcaption></figure>`
        : `<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`);
      continue;
    }
    const heading = /^(#{1,6}) (.+)$/.exec(line);
    if (heading) {
      flush(); const level = heading[1].length, id = headingId?.(heading[2], level);
      output.push(`<h${level}${id ? ` id="${id}"` : ''}>${escapeHTML(heading[2])}</h${level}>`);
      continue;
    }
    if (/^\|/.test(trimmed) && /^\|[\s:|\-]+\|$/.test(lines[i + 1]?.trim() ?? '')) {
      flush(); const cells = text => text.trim().slice(1, -1).split('|').map(value => inline(value.trim()));
      const headers = cells(line), rows = []; i++;
      while (i + 1 < lines.length && /^\|/.test(lines[i + 1].trim())) rows.push(cells(lines[++i]));
      output.push(`<div class="table-wrap"><table><thead><tr>${headers.map(value => `<th scope="col">${value}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(value => `<td>${value}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
      continue;
    }
    const item = /^(?:- |\d+\. )(.+)$/.exec(line);
    if (item) {
      if (paragraph.length || list.length && ordered !== /^\d/.test(line)) flush();
      ordered = /^\d/.test(line); list.push(item[1]); continue;
    }
    if (list.length) flush();
    if (trimmed.startsWith('> ')) { flush(); output.push(`<blockquote><p>${inline(trimmed.slice(2))}</p></blockquote>`); }
    else paragraph.push(trimmed);
  }
  flush(); return output.join('\n');
}
