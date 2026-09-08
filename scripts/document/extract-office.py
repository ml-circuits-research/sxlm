"""Streaming text extraction for Open XML office files; no macros or formulas execute."""
import sys
import re
import zipfile
import sqlite3
import tempfile
import posixpath
from pathlib import Path
from xml.etree import ElementTree as ET

source, destination, kind = sys.argv[1:]
W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A = '{http://schemas.openxmlformats.org/drawingml/2006/main}'
S = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
P = '{http://schemas.openxmlformats.org/presentationml/2006/main}'

def elements(archive, name, tag):
    with archive.open(name) as stream:
        for _, element in ET.iterparse(stream, events=('end',)):
            if element.tag == tag:
                yield element
                element.clear()

def relationships(archive, part):
    folder, name = posixpath.split(part)
    path = posixpath.join(folder, '_rels', name + '.rels')
    if path not in archive.namelist():
        return {}
    result = {}
    with archive.open(path) as stream:
        for element in ET.parse(stream).getroot():
            if element.get('TargetMode') == 'External':
                continue
            target = element.get('Target', '')
            target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(folder, target))
            result[element.get('Id')] = (target, element.get('Type', ''))
    return result

with zipfile.ZipFile(source) as archive, open(destination, 'w', encoding='utf-8') as output:
    names = archive.namelist()
    if kind == 'docx':
        for name in ['word/document.xml', 'word/footnotes.xml', 'word/endnotes.xml'] + sorted(name for name in names if re.fullmatch(r'word/(header|footer)\d+\.xml', name)):
            if name not in names:
                continue
            output.write('[Part: ' + name + ']\n')
            for paragraph in elements(archive, name, W + 'p'):
                text = ''.join(node.text or '' for node in paragraph.iter(W + 't'))
                if text:
                    output.write(text + '\n')
    elif kind == 'pptx':
        slides = sorted((name for name in names if re.fullmatch(r'ppt/slides/slide\d+\.xml', name)), key=lambda name: int(re.search(r'(\d+)\.xml$', name)[1]))
        if 'ppt/presentation.xml' in names:
            links = relationships(archive, 'ppt/presentation.xml')
            slides = [links[element.get(R + 'id')][0] for element in elements(archive, 'ppt/presentation.xml', P + 'sldId')]
        for position, name in enumerate(slides, 1):
            output.write('[Slide: ' + str(position) + '; part: ' + name + ']\n')
            for paragraph in elements(archive, name, A + 'p'):
                output.write(''.join(node.text or '' for node in paragraph.iter(A + 't')) + '\n')
            notes = next((target for target, relation in relationships(archive, name).values() if relation.endswith('/notesSlide')), None)
            if notes in names:
                output.write('[Speaker notes]\n')
                for paragraph in elements(archive, notes, A + 'p'):
                    output.write(''.join(node.text or '' for node in paragraph.iter(A + 't')) + '\n')
    elif kind == 'xlsx':
        # Shared strings can exceed memory for a large workbook; use an on-disk temporary index.
        with tempfile.TemporaryDirectory(prefix='sxlm-xlsx-') as temporary:
            database = sqlite3.connect(str(Path(temporary) / 'strings.sqlite'))
            database.execute('create table strings (id integer primary key, text text)')
            if 'xl/sharedStrings.xml' in names:
                for index, element in enumerate(elements(archive, 'xl/sharedStrings.xml', S + 'si')):
                    database.execute('insert into strings values (?, ?)', (index, ''.join(node.text or '' for node in element.iter(S + 't'))))
                database.commit()
            sheets = sorted((name for name in names if re.fullmatch(r'xl/worksheets/sheet\d+\.xml', name)), key=lambda name: int(re.search(r'(\d+)\.xml$', name)[1]))
            definitions = [(name, name, 'visible') for name in sheets]
            if 'xl/workbook.xml' in names:
                links = relationships(archive, 'xl/workbook.xml')
                definitions = [(element.get('name', ''), links[element.get(R + 'id')][0], element.get('state', 'visible')) for element in elements(archive, 'xl/workbook.xml', S + 'sheet')]
            for label, name, visibility in definitions:
                output.write('[Worksheet: ' + label + '; part: ' + name + '; ' + visibility + ']\n')
                for cell in elements(archive, name, S + 'c'):
                    address, kind = cell.get('r', ''), cell.get('t', '')
                    value = cell.findtext(S + 'v', '')
                    if kind == 's':
                        result = database.execute('select text from strings where id = ?', (int(value),)).fetchone()
                        if result is None:
                            raise ValueError('Missing shared string')
                        value = result[0]
                    elif kind == 'inlineStr':
                        value = ''.join(node.text or '' for node in cell.iter(S + 't'))
                    formula = cell.findtext(S + 'f')
                    if formula is not None:
                        value = '[Formula: ' + formula + '; cached value: ' + value + ']'
                    output.write(address + '\t' + value + '\n')
            database.close()
    else:
        raise ValueError('Unsupported office format')
