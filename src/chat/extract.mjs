import { createReadStream } from 'node:fs';
import { open, mkdir, readFile, writeFile, stat, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join, extname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { check, digest } from '../kernel/data.mjs';

const office = fileURLToPath(new URL('../../scripts/document/extract-office.py', import.meta.url));
export function documentFormat(name) {
  const extension = extname(name).slice(1).toLowerCase();
  if (['pdf', 'docx', 'pptx', 'xlsx', 'png', 'jpg', 'jpeg', 'tif', 'tiff', 'webp', 'bmp'].includes(extension)) return extension;
  if (['txt', 'md', 'markdown', 'csv', 'tsv', 'html', 'htm', 'xml', 'log', 'sop', ''].includes(extension)) return 'text';
  return 'unsupported';
}

export async function prepareDocument(store, document, directory, run, cancelled = () => false) {
  const format = document.format ?? 'text';
  check(format !== 'unsupported', 'Unsupported document type. Attach PDF, DOCX, PPTX, XLSX, a text file, or an image.');
  await mkdir(join(directory, 'input'), { recursive: true });
  await mkdir(join(directory, 'source'), { recursive: true });
  const original = join(directory, 'input', 'document.' + (format === 'text' ? 'txt' : format));
  const destination = await open(original, 'w', 0o600);
  try {
    for (let index = 0; index < document.chunks; index++) {
      check(!cancelled(), 'Document processing cancelled');
      await destination.write(await readFile(store.documentPath(document.chat, document.id, `chunk-${index}.txt`)));
    }
  } finally { await destination.close(); }
  let extracted = original, extractor = 'utf8-source', limitations = [];
  if (format === 'pdf') {
    extracted = join(directory, 'extracted.txt'); extractor = 'pdftotext-layout';
    await run('pdftotext', ['-layout', '-enc', 'UTF-8', original, extracted]);
    check((await stat(extracted)).size > 0, 'PDF has no extractable text. Supply an OCR text export or attach page images.');
    limitations = ['PDF reading order, tables and diagram labels can be lossy. Scanned pages without text require OCR.', 'Coordinates refer to extracted UTF-16 text, not PDF page rectangles.'];
  } else if (['docx', 'pptx', 'xlsx'].includes(format)) {
    extracted = join(directory, 'extracted.txt'); extractor = 'openxml-stream-v1';
    await run('python3', [office, original, extracted, format]);
    limitations = ['Text, office part/slide/worksheet labels and cell addresses are retained. Layout, drawings and embedded objects require inspection of the original.', 'Spreadsheet formulas are reported with cached values; formulas are never executed and caches may be stale.', 'Word table paragraphs retain text order but do not preserve merged-cell geometry.'];
  } else if (format !== 'text') {
    extracted = join(directory, 'extracted.txt'); extractor = 'tesseract-eng';
    await run('tesseract', [original, join(directory, 'extracted'), '-l', 'eng']);
    limitations = ['OCR is an interpretation of pixels and can misread characters, layout or handwriting. Source spans point into OCR output.'];
  }
  const decoder = new TextDecoder('utf-8', { fatal: true }), fullHash = createHash('sha256');
  let pending = '', chunks = 0, characters = 0, visible = 0;
  const emit = async text => {
    await writeFile(join(directory, 'source', `chunk-${chunks++}.txt`), text, { mode: 0o600 });
    characters += text.length; visible += text.trim().length;
  };
  for await (const bytes of createReadStream(extracted)) {
    check(!cancelled(), 'Document processing cancelled'); fullHash.update(bytes);
    pending += decoder.decode(bytes, { stream: true });
    while (pending.length > 16000) {
      let boundary = pending.lastIndexOf('\n', 16000);
      if (boundary < 8000) boundary = /[\uD800-\uDBFF]/.test(pending[15999]) ? 15999 : 16000;
      else boundary++;
      await emit(pending.slice(0, boundary)); pending = pending.slice(boundary);
    }
  }
  pending += decoder.decode(); if (pending) await emit(pending);
  check(chunks > 0 && visible > 0, 'The document contains no extractable text');
  const extraction = { schema: 'sxlm.document-extraction.v1', originalHash: document.hash,
    originalFile: 'input/document.' + (format === 'text' ? 'txt' : format), format, extractor,
    extractorSourceHash: format === 'docx' || format === 'pptx' || format === 'xlsx' ? digest(await readFile(office, 'utf8')) : null,
    textHash: fullHash.digest('hex'), chunks, characters, limitations, storage: 'extraction-' + basename(directory).replace(/^job-/, '') };
  const archive = store.documentPath(document.chat, document.id, extraction.storage);
  await mkdir(archive, { recursive: true });
  await cp(join(directory, 'source'), join(archive, 'source'), { recursive: true });
  store.write(join(archive, 'extraction.sop'), extraction);
  store.write(join(directory, 'extraction.sop'), extraction);
  return extraction;
}
