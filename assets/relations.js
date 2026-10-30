// The relations page: every shown project (rows) against every keyword (columns), a dot where they meet.
// Reads the same wiki.json as the site. Click a project or a keyword to see only what relates to it.
// ROOT is where the site lives: "/" here, "/FernandoBrizio/" on GitHub Pages (<base> in the page)
const ROOT = new URL(document.baseURI).pathname;
const D = await (await fetch(ROOT + 'wiki.json')).json();
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'})[c]);

const INK = Object.fromEntries(D.types.map(t => [t.id, t.ink]));
const TYPE_ORDER = D.types.map(t => t.id);
const PROJECTS = D.projects.map(p => ({...p, kws: new Set(p.keywords)}));
const BY_ID = Object.fromEntries(PROJECTS.map(p => [p.id, p]));
// years are already in the rows (next to each title), so they are not columns
const KEYWORDS = Object.entries(D.keywords).filter(([, k]) => k.type !== 'year' && INK[k.type])
  .map(([id, k]) => ({id, label: k.label, type: k.type, n: k.projects.length}));
const KW = Object.fromEntries(KEYWORDS.map(k => [k.id, k]));
const TYPES = D.types.filter(t => KEYWORDS.some(k => k.type === t.id));

const state = {rows: 'similar', cols: 'type', once: false, off: new Set(), q: '', focus: null};   // focus: {kind: 'p'|'k', id}
const shared = (a, b) => { let n = 0; for (const k of a.kws) if (b.kws.has(k) && KW[k]) n++; return n; };

// "Similar together": start with the project with most keywords, then always take the most similar one left
const SIMILAR = (() => {
  const jac = (a, b) => { const i = shared(a, b); return i / (a.kws.size + b.kws.size - i || 1); };
  const left = [...PROJECTS].sort((a, b) => b.kws.size - a.kws.size);
  const out = [left.shift()];
  while (left.length) {
    const last = out[out.length - 1];
    let best = 0, bv = -1;
    left.forEach((p, i) => { const v = jac(last, p); if (v > bv) { bv = v; best = i; } });
    out.push(left.splice(best, 1)[0]);
  }
  return out;
})();

function rows(){
  let ps;
  if (state.focus?.kind === 'p') {
    const me = BY_ID[state.focus.id];
    ps = PROJECTS.map(p => [p, p === me ? Infinity : shared(me, p)]).filter(([, n]) => n > 0)
      .sort((a, b) => b[1] - a[1] || a[0].title.localeCompare(b[0].title)).map(([p]) => p);
    return ps;
  }
  ps = state.rows === 'similar' ? SIMILAR
    : [...PROJECTS].sort(state.rows === 'year' ? (a, b) => (a.year || 9999) - (b.year || 9999) || a.title.localeCompare(b.title)
      : state.rows === 'count' ? (a, b) => b.kws.size - a.kws.size || a.title.localeCompare(b.title)
      : (a, b) => a.title.localeCompare(b.title));
  if (state.focus?.kind === 'k') ps = ps.filter(p => p.kws.has(state.focus.id));
  if (state.q) ps = ps.filter(p => norm(p.title).includes(state.q));
  return ps;
}
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

function cols(ps){
  let ks = KEYWORDS.filter(k => !state.off.has(k.type) && (state.once || k.n > 1 || state.focus?.id === k.id) && ps.some(p => p.kws.has(k.id)));
  if (state.focus?.kind === 'p') ks = ks.filter(k => BY_ID[state.focus.id].kws.has(k.id));
  const byCount = (a, b) => b.n - a.n || a.label.localeCompare(b.label);
  if (state.cols === 'type' || state.focus?.kind === 'p') return ks.sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || byCount(a, b));
  if (state.cols === 'count') return ks.sort(byCount);
  // follow the projects: each keyword sits where its projects are, on average, so clusters make a diagonal
  const at = new Map(ps.map((p, i) => [p.id, i]));
  const mean = k => { let s = 0, n = 0; for (const p of ps) if (p.kws.has(k.id)) { s += at.get(p.id); n++; } return s / n; };
  const m = new Map(ks.map(k => [k.id, mean(k)]));
  return ks.sort((a, b) => m.get(a.id) - m.get(b.id) || byCount(a, b));
}

let R = [], C = [];
function render(){
  R = rows(); C = cols(R);
  const t = $('#m');
  if (!R.length || !C.length) { t.innerHTML = '<tr><td class="empty">Nothing to show with these settings.</td></tr>'; info(); return; }
  const grouped = state.cols === 'type' || state.focus?.kind === 'p';
  const starts = new Set(C.map((k, i) => i && C[i - 1].type !== k.type ? i : -1));
  let head = '';
  if (grouped) {
    head += '<tr class="groups"><th class="corner"></th>';
    for (let i = 0; i < C.length;) {
      let j = i; while (j < C.length && C[j].type === C[i].type) j++;
      const ty = TYPES.find(x => x.id === C[i].type);
      head += `<th colspan="${j - i}" style="max-width:${(j - i) * 15}px" title="${esc(ty.label)}"><span style="color:${ty.ink}">●</span> ${j - i > 2 ? esc(ty.label) : ''}</th>`;
      i = j;
    }
    head += '</tr>';
  }
  head += `<tr><th class="corner">${R.length} projects × ${C.length} keywords</th>`
    + C.map((k, i) => `<th data-c="${i}" class="${grouped && starts.has(i) ? 'grp' : ''}" title="${esc(k.label)} (${k.n})"><span>${esc(k.label)} (${k.n})</span></th>`).join('') + '</tr>';
  const me = state.focus?.kind === 'p' ? state.focus.id : null;
  const body = R.map((p, r) => {
    const n = C.reduce((s, k) => s + p.kws.has(k.id), 0);
    const tag = me ? (p.id === me ? '' : ` · ${shared(BY_ID[me], p)} shared`) : ` · ${n}`;
    return `<tr data-r="${r}"${p.id === me ? ' class="me"' : ''}><th title="${esc(p.title)}">${esc(p.title)} <small>${p.year || 'n.d.'}${tag}</small></th>`
      + C.map((k, i) => `<td${grouped && starts.has(i) ? ' class="grp"' : ''}>${p.kws.has(k.id) ? `<i style="background:${INK[k.type]}"></i>` : ''}</td>`).join('') + '</tr>';
  }).join('');
  t.innerHTML = `<thead>${head}</thead><tbody>${body}</tbody>`;
  const g = t.querySelector('tr.groups');
  if (g) t.style.setProperty('--gh', g.offsetHeight + 'px');
  info();
}

// the line above the table: what the pointer is on, or what is in focus
function info(html){
  const f = state.focus;
  let out = html;
  if (!out && f?.kind === 'p') {
    const p = BY_ID[f.id];
    out = `Projects related to <b>${esc(p.title)}</b>, by keywords in common (${R.length - 1}). <a href="${ROOT}${p.id}" target="_blank">Open the page ↗</a>`;
  } else if (!out && f?.kind === 'k') {
    out = `Projects with <b>${esc(KW[f.id].label)}</b> (${R.length}), and the keywords they also have. <a href="${ROOT}${f.id}" target="_blank">Open the keyword page ↗</a>`;
  }
  out = out || 'Hover a dot. Click a project or a keyword to see only its relations.';
  $('#info').innerHTML = out + (f && !html ? '<button class="x" data-clear>Show everything</button>' : '');
}

function hoverCol(i){
  document.querySelectorAll('.hc').forEach(e => e.classList.remove('hc'));
  if (i == null) return;
  const t = $('#m');
  const head = t.tHead.rows[t.tHead.rows.length - 1].cells[i + 1];
  if (head) head.classList.add('hc');
  for (const row of t.tBodies[0]?.rows || []) row.cells[i + 1]?.classList.add('hc');
}
$('#m').addEventListener('mouseover', e => {
  const cell = e.target.closest('td, th');
  if (!cell || !cell.closest('table')) return;
  const tr = cell.parentElement;
  const ci = cell.dataset.c != null ? +cell.dataset.c : cell.tagName === 'TD' ? cell.cellIndex - 1 : null;
  hoverCol(ci);
  const p = tr.dataset.r != null ? R[+tr.dataset.r] : null, k = ci != null ? C[ci] : null;
  if (p && k) {
    const others = PROJECTS.filter(q => q !== p && q.kws.has(k.id)).map(q => q.title);
    info(`<b>${esc(p.title)}</b> ${p.kws.has(k.id) ? 'has' : 'does not have'} <b>${esc(k.label)}</b>`
      + (others.length ? ` · also: ${esc(others.slice(0, 6).join(', '))}${others.length > 6 ? ` and ${others.length - 6} more` : ''}` : ''));
  } else if (p) {
    const top = PROJECTS.filter(q => q !== p).map(q => [q, shared(p, q)]).filter(([, n]) => n).sort((a, b) => b[1] - a[1]).slice(0, 5);
    info(`<b>${esc(p.title)}</b> (${p.year || 'n.d.'}), ${p.kws.size} keywords · closest: ${top.map(([q, n]) => `${esc(q.title)} (${n})`).join(', ') || 'none'} · click to focus`);
  } else if (k) {
    info(`<b>${esc(k.label)}</b>, ${esc(TYPES.find(t => t.id === k.type).label.toLowerCase())}, in ${k.n} project${k.n === 1 ? '' : 's'} · click to focus`);
  }
});
$('#m').addEventListener('mouseleave', () => { hoverCol(null); info(); });
$('#m').addEventListener('click', e => {
  const cell = e.target.closest('th, td');
  if (!cell) return;
  const tr = cell.parentElement;
  if (cell.tagName === 'TH' && tr.dataset.r != null) setFocus({kind: 'p', id: R[+tr.dataset.r].id});
  else if (cell.dataset.c != null) setFocus({kind: 'k', id: C[+cell.dataset.c].id});
});
function setFocus(f){
  state.focus = f && state.focus && state.focus.kind === f.kind && state.focus.id === f.id ? null : f;
  history.replaceState(null, '', state.focus ? `#${state.focus.kind}/${state.focus.id}` : location.pathname);
  render();
  $('#wrap').scrollTo(0, 0);
}
$('#info').addEventListener('click', e => { if (e.target.closest('[data-clear]')) setFocus(null); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && state.focus) setFocus(null); });

// controls
$('#types').innerHTML = TYPES.map(t => `<button type="button" data-t="${t.id}" title="Show or hide ${esc(t.label.toLowerCase())}"><i style="background:${t.ink}"></i>${esc(t.label)}</button>`).join('');
$('#types').addEventListener('click', e => {
  const b = e.target.closest('[data-t]');
  if (!b) return;
  state.off.has(b.dataset.t) ? state.off.delete(b.dataset.t) : state.off.add(b.dataset.t);
  b.classList.toggle('off', state.off.has(b.dataset.t));
  render();
});
$('#rows').addEventListener('change', e => { state.rows = e.target.value; render(); });
$('#cols').addEventListener('change', e => { state.cols = e.target.value; render(); });
$('#once').addEventListener('change', e => { state.once = e.target.checked; render(); });
$('#q').addEventListener('input', e => { state.q = norm(e.target.value.trim()); render(); });

// a shared link (#p/float or #k/water) opens in focus
function fromHash(){
  const [kind, id] = decodeURIComponent(location.hash.slice(1)).split('/');
  state.focus = (kind === 'p' && BY_ID[id]) || (kind === 'k' && KW[id]) ? {kind, id} : null;
  render();
}
window.addEventListener('hashchange', fromHash);
fromHash();
