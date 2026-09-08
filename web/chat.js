import { encodeSOP, decodeSOP } from './sop-data.mjs';
const $ = id => document.getElementById(id);
const node = (tag, text, className) => {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
};
const active = job => ['queued', 'preparing', 'running', 'validating'].includes(job.status);
const binary = name => /\.(?:pdf|docx|pptx|xlsx|png|jpe?g|tiff?|webp|bmp)$/i.test(name);
async function* chunks(file) {
  if (binary(file.name ?? '')) {
    for (let offset = 0; offset < file.size; offset += 65536) yield new Uint8Array(await file.slice(offset, offset + 65536).arrayBuffer());
    return;
  }
  const reader = file.stream().getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      text += done ? decoder.decode() : decoder.decode(value, { stream: true });
      while (text.length > 12000) {
        const boundary = /[\uD800-\uDBFF]/.test(text[11999]) ? 11999 : 12000;
        yield new TextEncoder().encode(text.slice(0, boundary)); text = text.slice(boundary);
      }
      if (done) break;
    }
    if (text) yield new TextEncoder().encode(text);
  } finally { reader.releaseLock(); }
}

export function mountChat(api, error) {
  let selected = localStorage.getItem('sxlm.chat') || null, data, timer, generation = 0;
  let displayed = '', uploading = false, pollingError = false;
  const path = suffix => '/api/chat/' + selected + suffix;
  const safely = action => async () => { error(''); try { await action(); } catch (e) { error(e.message); } };
  function message(turn, chat) {
    const item = node('article', undefined, 'chat-turn');
    item.append(node('div', turn.text, 'chat-bubble chat-user'), node('div', turn.result.text, 'chat-bubble chat-answer'));
    const detail = node('details', undefined, 'message-details'); detail.append(node('summary', 'Evidence'));
    detail.addEventListener('toggle', safely(async () => {
      if (!detail.open || detail.dataset.loaded) return;
      const full = await api(`/api/chat/${chat}/turns/${turn.index}`);
      detail.append(node('pre', encodeSOP(full.result))); detail.dataset.loaded = 'true';
    })); item.append(detail); return item;
  }
  async function refresh() {
    const epoch = ++generation, listing = await api('/api/chat');
    if (epoch !== generation) return;
    if (!listing.chats.some(chat => chat.id === selected)) selected = listing.chats[0]?.id ?? null;
    if (!selected) { const chat = await api('/api/chat', {}); selected = chat.id; listing.chats.unshift(chat); }
    localStorage.setItem('sxlm.chat', selected);
    $('chat-select').replaceChildren(...listing.chats.map(chat => {
      const option = node('option', chat.title); option.value = chat.id; option.selected = chat.id === selected; return option;
    }));
    const id = selected, received = await api(path('?tail=1'));
    if (epoch !== generation || id !== selected) return;
    data = received;
    const signature = id + ':' + data.total;
    if (displayed !== signature) {
      displayed = signature;
      $('chat-messages').replaceChildren(...data.turns.map(turn => message(turn, id)));
      if (data.offset > 0) {
        const more = node('button', 'Earlier messages', 'text-button'); let offset = data.offset;
        more.addEventListener('click', safely(async () => {
          more.disabled = true;
          try {
            const previous = offset, next = Math.max(0, previous - 20);
            const page = await api(`/api/chat/${id}?offset=${next}`);
            more.after(...page.turns.filter(turn => turn.index < previous).map(turn => message(turn, id)));
            offset = next;
            if (!offset) more.remove();
          } finally { more.disabled = false; }
        })); $('chat-messages').prepend(more);
      }
      if (!data.turns.length) $('chat-messages').append(node('div', 'Ask a question, or attach a document to talk about it.', 'chat-empty'));
      $('chat-messages').scrollTop = $('chat-messages').scrollHeight;
    }
    renderAttachments();
    scheduleRefresh();
  }
  function scheduleRefresh() {
    clearTimeout(timer);
    if (data?.chat.id !== selected || !data.jobs.some(active)) return;
    timer = setTimeout(async () => {
      try {
        await refresh();
        if (pollingError) { error(''); pollingError = false; }
      } catch {
        pollingError = true;
        error('Unable to refresh document processing. Reconnecting…');
        scheduleRefresh();
      }
    }, 2000);
  }
  function renderAttachments() {
    const last = data.jobs.at(-1), processing = last && active(last);
    const stages = { queued: 'Waiting to process your document…', preparing: 'Reading your document…',
      running: last?.attempt > 1 ? 'Refining the interpretation…' : 'Learning from your document…',
      validating: 'Checking the interpretation…' };
    $('chat-presence').textContent = processing ? stages[last.status] : 'Ready to talk';
    $('chat-file').disabled = !!processing || uploading; $('chat-attach').disabled = !!processing || uploading;
    $('chat-send').disabled = !!processing || uploading;
    $('chat-message').disabled = !!processing;
    $('chat-attachment-status').hidden = !last && !uploading;
    if (last && !uploading) {
      const document = data.documents.find(document => document.id === last.document);
      const ready = (data.chat.activeJobs ?? []).includes(last.id);
      $('chat-attachment-status').replaceChildren(node('strong', document?.name ?? 'Document'), node('span', ready ? 'Ready — ask me about it.' : processing ? $('chat-presence').textContent : last.error ?? last.status));
      if (!ready && !processing) {
        const retry = node('button', 'Retry', 'text-button');
        retry.addEventListener('click', safely(async () => { await api(path('/jobs'), { document: last.document }); await refresh(); })); $('chat-attachment-status').append(retry);
      }
    }
    $('chat-processing').hidden = !last;
    if (last) {
      const detail = $('chat-processing-detail'); detail.replaceChildren();
      detail.append(node('p', 'Formal proofs depend on the document interpretation.', 'hint'));
      if (last.attempt > 1)
        detail.append(node('p', 'The first interpretation failed validation. The coding agent received a diagnostic and one correction attempt.', 'hint'));
      for (const limitation of [...(last.receipt?.limitations ?? last.interpretationLimitations ?? []), ...(last.extraction?.limitations ?? [])])
        detail.append(node('p', limitation, 'hint'));
      if (processing) {
        const cancel = node('button', 'Cancel processing', 'text-button');
        cancel.addEventListener('click', safely(async () => { await api(path(`/jobs/${last.id}/cancel`), {}); await refresh(); })); detail.append(cancel);
      }
      const log = node('button', 'Show processing log', 'text-button');
      log.addEventListener('click', safely(async () => { const value = await api(path(`/jobs/${last.id}/log`)); detail.append(node('pre', value.text)); log.remove(); })); detail.append(log);
    }
  }
  async function upload(file) {
    uploading = true; $('chat-file').disabled = true; $('chat-attach').disabled = true; $('chat-send').disabled = true;
    try {
      if (!selected) await refresh();
      if (!file.size) throw new Error('This file is empty');
      const base = '/api/chat/' + selected, name = file.name ?? 'Pasted text.txt';
      const document = await api(base + '/documents', { name });
      let index = 0, bytes = 0;
      $('chat-attachment-status').hidden = false;
      for await (const body of chunks(file)) {
        const response = await fetch(`${base}/documents/${document.id}/chunks/${index}`, { method: 'POST', headers: { 'Content-Type': binary(name) ? 'application/octet-stream' : 'text/plain; charset=utf-8' }, body });
        const value = decodeSOP(await response.text()); if (!response.ok) throw new Error(value.error);
        index++; bytes += body.length; $('chat-attachment-status').textContent = `${name} · Uploading ${Math.round(bytes / file.size * 100)}%`;
      }
      await api(`${base}/documents/${document.id}/finish`, {});
      $('chat-file').value = '';
    } finally { uploading = false; $('chat-file').value = ''; await refresh(); }
  }
  $('chat-attach').addEventListener('click', () => $('chat-file').click());
  $('chat-file').addEventListener('change', safely(async () => { const file = $('chat-file').files[0]; if (file) await upload(file); }));
  $('chat-new').addEventListener('click', safely(async () => { selected = (await api('/api/chat', {})).id; await refresh(); }));
  $('chat-select').addEventListener('change', safely(async () => { selected = $('chat-select').value; await refresh(); }));
  async function send() {
    $('chat-send').disabled = true;
    try {
      if (!selected) await refresh();
      const text = $('chat-message').value, conversation = selected;
      if (!text.trim()) return;
      if (text.length > 16000) await upload(new File([text], 'Pasted text.txt', { type: 'text/plain' }));
      else await api(path('/message'), { text });
      if (selected === conversation && $('chat-message').value === text) $('chat-message').value = '';
      await refresh();
    } finally { $('chat-send').disabled = uploading || !!data?.jobs.some(active); }
  }
  $('chat-send').addEventListener('click', safely(send));
  $('chat-message').addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey && !$('chat-send').disabled) { event.preventDefault(); safely(send)(); }
  });
  return { refresh };
}
