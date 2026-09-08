import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { execFileSync, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { ChatStore } from '../src/chat/store.mjs';
import { prepareDocument } from '../src/chat/extract.mjs';
const execute = promisify(execFile);
const fixture = `import zipfile, sys
from pathlib import Path
root=Path(sys.argv[1])
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
A='http://schemas.openxmlformats.org/drawingml/2006/main'
S='http://schemas.openxmlformats.org/spreadsheetml/2006/main'
files={
 'lesson.docx':{'word/document.xml':f'<w:document xmlns:w="{W}"><w:body><w:p><w:r><w:t>Cedar is a pilot.</w:t></w:r></w:p><w:p><w:r><w:t>Every pilot is careful.</w:t></w:r></w:p></w:body></w:document>'},
 'lesson.pptx':{'ppt/slides/slide1.xml':f'<root xmlns:a="{A}"><a:p><a:r><a:t>Cedar owns a bird.</a:t></a:r></a:p></root>'},
 'lesson.xlsx':{'xl/sharedStrings.xml':f'<sst xmlns="{S}"><si><t>Cedar</t></si><si><t>Pilot</t></si></sst>', 'xl/worksheets/sheet1.xml':f'<worksheet xmlns="{S}"><sheetData><row><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1"><f>2+3</f><v>5</v></c></row></sheetData></worksheet>'}
}
for name, parts in files.items():
 with zipfile.ZipFile(root/name,'w') as z:
  for path, text in parts.items(): z.writestr(path,text)
stream=b'BT /F1 18 Tf 50 750 Td (Cedar is a pilot.) Tj ET'
objects=[b'<< /Type /Catalog /Pages 2 0 R >>',b'<< /Type /Pages /Kids [3 0 R] /Count 1 >>',b'<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',b'<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',b'<< /Length '+str(len(stream)).encode()+b' >>\\nstream\\n'+stream+b'\\nendstream']
pdf=b'%PDF-1.4\\n'; offsets=[0]
for index, item in enumerate(objects,1): offsets.append(len(pdf));pdf+=str(index).encode()+b' 0 obj\\n'+item+b'\\nendobj\\n'
xref=len(pdf);pdf+=b'xref\\n0 6\\n0000000000 65535 f \\n'
for offset in offsets[1:]:pdf+=('%010d 00000 n \\n'%offset).encode()
pdf+=b'trailer\\n<< /Size 6 /Root 1 0 R >>\\nstartxref\\n'+str(xref).encode()+b'\\n%%EOF\\n';(root/'lesson.pdf').write_bytes(pdf)
`;

test('PDF, Word, slide, workbook and image OCR extraction preserves attributed evidence and format limitations', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'sxlm-extract-'));
  try {
    execFileSync('python3', ['-c', fixture, directory]);
    execFileSync('pdftoppm', ['-singlefile', '-png', '-r', '150', join(directory, 'lesson.pdf'), join(directory, 'lesson')]);
    const store = new ChatStore(join(directory, 'store')), chat = store.create('model');
    for (const [name, expected] of [['lesson.docx', 'Every pilot is careful.'], ['lesson.pptx', 'Cedar owns a bird.'], ['lesson.xlsx', 'C1\t[Formula: 2+3; cached value: 5]'], ['lesson.pdf', 'Cedar is a pilot.'], ['lesson.png', 'Cedar is a pilot.']]) {
      const doc = store.createDocument(chat.id, name), bytes = readFileSync(join(directory, name));
      for (let offset = 0, index = 0; offset < bytes.length; offset += 65536, index++) store.appendChunk(chat.id, doc.id, index, bytes.subarray(offset, offset + 65536));
      const ready = store.finishDocument(chat.id, doc.id), job = randomUUID(), workspace = store.jobPath(chat.id, job);
      mkdirSync(workspace);
      const result = await prepareDocument(store, ready, workspace, (name, args) => execute(name, args, { timeout: 20000 }));
      const privatePath = store.documentPath(chat.id, doc.id, result.storage, 'source', 'chunk-0.txt');
      const text = readFileSync(privatePath, 'utf8');
      assert.ok(text.includes(expected), name + ': ' + text);
      assert.ok(result.limitations.length > 0); assert.equal(result.originalHash, ready.hash);
      writeFileSync(join(workspace, 'source/chunk-0.txt'), 'Agent-modified text');
      assert.equal(readFileSync(privatePath, 'utf8'), text, 'The coding agent must not own the evidence archive');
    }
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
