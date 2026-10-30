// The public site: every page is drawn here from wiki.json (made by build_wiki.py).
// Loaded as a module, so it can wait for the data before drawing.
// R is where the site lives: "/" here and on its own domain, "/FernandoBrizio/" on GitHub Pages (<base> in the page)
const R = new URL(document.baseURI).pathname;
const D = await (await fetch(R + 'wiki.json')).json();
const P = Object.fromEntries(D.projects.map(p => [p.id, p]));
const K = D.keywords;
const PG = Object.fromEntries(D.pages.map(pg => [pg.id, pg]));
// whose media a lightbox shows: a project, or a page ("page:about")
const mediaOwner = id => id.startsWith('page:') ? {id, images: (PG[id.slice(5)] || {}).media || []} : P[id];
const DOMAINS = D.domains;
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const sortKey = s => norm(s).replace(/^["'(*\s]+/, '');
const byTitle = (a, b) => sortKey(a.title).localeCompare(sortKey(b.title));
// relations of keyword k seen from project `from`: the other projects in its list
const relCount = (k, from) => K[k].projects.length - (from && K[k].projects.includes(from) ? 1 : 0);
const pLink = id => `<a href="${R}${id}">${esc(P[id].title)}</a>`;
const kLink = (k, from) => { const n = relCount(k, from); return `<a href="${R}${k}">${esc(K[k].label)}</a>${n ? ` <span class="n">(${n})</span>` : ''}`; };
const WMARK = /^\{w:(\d+)\}\s*/;
// The page sequence (set in the backoffice): besides paragraphs, a block can be a media item {img:id},
// a footnote box {fn:1} or the technical sheet {sheet}.
const MARK = /^\{(img|fn|sheet|space|br|card|quote|infobox|chronology|imglist|refs)(?::([\w-]+))?\}$/;
const unmark = t => (t || '').replace(/^\{w:\d+\}\s*/gm, '').replace(/^\{(?:img|fn|space|card):[\w-]+\}$|^\{(?:sheet|br|quote|infobox|chronology|imglist|refs)\}$/gm, '');
// a block: optional {w:N} width, then a marker or a paragraph
const parseBlock = raw => { const wm = WMARK.exec(raw), body = raw.replace(WMARK, ''); return {w: wm ? +wm[1] : 0, body, m: MARK.exec(body.trim())}; };
// spacing blocks: an empty box N columns wide, or a break so the next box starts a new line
const spaceBox = n => `<div class="gap w${Math.min(12, Math.max(1, +n || 1))}" aria-hidden="true"></div>`;
// the title box can be made wider or narrower; the page starts below the menu and title
const titleW = x => Math.min(10, Math.max(2, +x.title_w || 6));
const isAudio = im => im.kind === 'audio' || /\.(mp3|wav|m4a|aac|ogg)$/i.test(im.file);
const isVideoFile = im => /\.(mp4|webm|mov|m4v)$/i.test(im.file);
const isStill = im => !isAudio(im) && !isVideoFile(im);
const plain = t => unmark(t).replace(/\{\/?[bi]\}/g, '').replace(/\[\[#?[^|\]]+\|([^\]]+)\]\]/g, '$1').replace(/\[\^\d+\]/g, '').replace(/^## /gm, '');

// inline markup -> html: [[id|words]] project, [[#kw|words]] keyword + (N), [^n] footnote marker
function inline(t, from){
  return esc(t).replace(/\n/g, '<br>')
    .replace(/\[\^(\d+)\]/g, '<a class="fnref" href="#" data-fn="$1">[$1]</a>')
    .replace(/\[\[(#?)([^|\]]+)\|([^\]]+)\]\]/g, (m, h, id, txt) => {
      if (!h) return P[id] ? `<a href="${R}${id}">${txt}</a>` : txt;
      const n = K[id] ? relCount(id, from) : 0;
      return n ? `<a href="${R}${id}">${txt}</a> <span class="n">(${n})</span>` : txt;
    })
    // a footnote marker sits on the word, before the count: "open objects[1] (1)"
    .replace(/( <span class="n">\(\d+\)<\/span>)(<a class="fnref"[^>]*>\[\d+\]<\/a>)/g, '$2$1')
    // bold and italic, set in the backoffice as {b}…{/b} and {i}…{/i}
    .replace(/\{b\}([\s\S]*?)\{\/b\}/g, '<b>$1</b>').replace(/\{i\}([\s\S]*?)\{\/i\}/g, '<i>$1</i>');
}

/* ---------- shared pieces ---------- */
function nav(here){
  const item = (id, label, href) => here === id ? `<div class="box" aria-current="page">${label}</div>` : `<div class="box"><a href="${href}">${label}</a></div>`;
  return `<div class="nav stack w2">
    <div class="box"><a class="home${here === 'search' || here === 'about' ? ' b' : ''}" href="${R}">Fernando Brízio</a></div>
    ${item('list', 'Project List', R + 'list')}
    ${item('about', 'About', R + 'about')}
    ${here === 'search' ? '' : `<div class="box search"><a href="${R}search">Search</a><img src="ui/search.svg" width="13.9041" height="13.9041" alt=""></div>`}
  </div>`;
}
function header(here, title, w = 'w6'){
  document.getElementById('head').innerHTML = `<div class="row">${nav(here)}${title ? `<div class="box ${w}"><h1>${esc(title)}</h1></div>` : ''}</div>`;
}
const pageHref = id => R + id;
const footer = () => `<footer>
  <div class="l"><span>This website was last updated on ${esc(D.updated)}. This page was last edited on ${esc(D.updated)}.</span>
  ${D.pages.filter(pg => pg.footer).map(pg => `<a href="${pageHref(pg.id)}">${esc(pg.title)}</a>`).join('')}</div>
  <div>This website collects works by/with Fernando Brízio. © 2026 Fernando Brízio. Designed by Macedo Cannatà. Developed by Loba.</div>
</footer>`;

// short caption under an image; the full one goes to the image list and the lightbox
function shortCap(c){
  let s = c.includes(': ') ? c.slice(c.indexOf(': ') + 2) : c;
  s = s.split(/(?<=[.;])\s/)[0].replace(/[.;]$/, '');
  return s.charAt(0).toUpperCase() + s.slice(1);
}
const fname = im => im.src || '';   // the original's file name (the build publishes no folders)
const aspect = im => { const m = /^(\d+)x(\d+)$/.exec(im.info || ''); return m ? m[1] / m[2] : 1.33; };
// the lead image (chosen in the backoffice) is what hovers and cards show; it does not change the page's image order
// how wide an image shows, for the browser to pick the right file: grid columns on wide screens, full width on phones
const colsVw = w => `(max-width:760px) 100vw, ${Math.round((+String(w).replace('w', '') || 12) / 12 * 100)}vw`;
function pic(im, sizes, alt = '', lazy = true){
  const dims = im.wh ? ` width="${im.wh[0]}" height="${im.wh[1]}"` : '';
  const img = `<img${lazy ? ' loading="lazy"' : ''} src="${im.file}"${dims} alt="${esc(alt)}">`;
  if (!im.v) return img;
  const base = im.file.replace(/\.\w+$/, '');
  return `<picture><source type="image/webp" srcset="${im.v.map(x => `${base}-${x}.webp ${x}w`).join(', ')}" sizes="${sizes}">${img}</picture>`;
}
const leadImg = p => p.images.find(i => i.id === p.lead && isStill(i)) || p.images.find(i => i.kind === 'image') || p.images.find(isStill);

function figure(p, i, w){
  const im = p.images[i];
  if (im.w) w = 'w' + im.w;  // width set in the backoffice wins over the automatic one
  // sound and video files play in place; stills (and video stills) open in the lightbox
  const media = isAudio(im) ? `<div class="box img"><audio controls preload="none" src="${im.file}"></audio></div>`
    : isVideoFile(im) ? `<div class="box img"><video controls preload="metadata" src="${im.file}"></video></div>`
    : `<div class="box img" data-lb="${p.id}" data-i="${i}" role="button" tabindex="0" aria-label="Open image ${i + 1} large">${pic(im, colsVw(w), plain(shortCap(im.caption)))}${im.kind === 'video' ? '<span class="play">▶ video</span>' : ''}</div>`;
  return `<div class="fig stack ${w}">
    ${media}
    <div class="box cap"><span class="n">[img ${i + 1}]</span> ${inline(shortCap(im.caption), p.id)}</div>
  </div>`;
}

function card(p, w, big){
  const im = leadImg(p);
  if (!im) return `<div class="card ${big ? 'big ' : ''}${w}"><div class="txt">Text</div><div class="t"><a href="${R}${p.id}">${esc(p.title)}</a></div></div>`;
  return `<div class="card ${big ? 'big ' : ''}${w}"><div class="img"><a href="${R}${p.id}" tabindex="-1" aria-hidden="true">${pic(im, colsVw(w))}</a></div><div class="t"><a href="${R}${p.id}">${esc(p.title)}</a></div></div>`;
}
const cardW = p => { const im = leadImg(p); return im && aspect(im) > 1.4 ? 'w3' : 'w2'; };

// Reading / Seeing / Listening / Thinking: bold where this project belongs; [+] opens the four lists
function domainBlock(cur, open, w = 'w7'){
  const names = Object.keys(DOMAINS);
  const bar = `<div class="domainbar"><span>${names.map(n => cur && DOMAINS[n].includes(cur) ? `<b>${n}</b>` : n).join(' / ')}</span><a href="#" data-domains>${open ? '[–]' : '[+]'}</a></div>`;
  const cols = open ? `<div class="domains">${names.map(n => `<div class="box w3">${DOMAINS[n].map(id => `<a href="${R}${id}"${id === cur ? ' class="cur"' : ''}>${esc(P[id].title)}</a>`).join('')}</div>`).join('')}</div>` : '';
  return `<div class="dom ${open ? 'w12' : w}" data-cur="${cur || ''}"><div class="box dbox${open ? ' open' : ''}">${bar}</div>${cols}</div>`;
}

/* ---------- project page ---------- */
function sheetText(p){
  // the technical sheet as one run: "Title X; Year 2008 (4); Material Fabric (14) and felt-tip pens (6); ..."
  const kws = p.keywords.filter(k => K[k].type !== 'year').sort((a, b) => K[b].label.length - K[a].label.length);
  return p.sheet.map(([label, value]) => {
    let v = esc(value);
    if (label === 'Title') v = pLink(p.id);
    else if (label === 'Year' && p.year && K[`year-${p.year}`] && relCount(`year-${p.year}`, p.id)) v = v.replace(String(p.year), `<a href="${R}year-${p.year}">${p.year}</a> <span class="n">(${relCount(`year-${p.year}`, p.id)})</span>`);
    else for (const k of kws) {
      const lab = K[k].label.split(' / ')[0];
      const i = norm(v).indexOf(norm(lab));
      if (lab.length < 3 || i < 0 || v.slice(0, i).includes('<a') || /\w/.test(v[i - 1] || '')) continue;
      const n = relCount(k, p.id);
      if (!n) continue;   // a keyword no other shown project has stays plain text, as in the texts
      v = v.slice(0, i) + `<a href="${R}${k}">${v.slice(i, i + lab.length)}</a> <span class="n">(${n})</span>` + v.slice(i + lab.length);
    }
    return `${esc(label)} ${v}`;
  }).join('; ');
}

function projectPage(p){
  header('project', p.title, 'w' + titleW(p));
  const imgs = p.images;
  const sheet = sheetText(p);
  const paraW = imgs.length ? 'w5' : 'w8';
  const fnW = imgs.length ? 'w2' : 'w4';
  const sheetBox = `<div class="box cap ${p.sheet_w ? 'w' + p.sheet_w : sheet.replace(/<[^>]+>/g, '').length > 260 || imgs.length < 2 ? 'w4' : 'w2'}">${sheet}</div>`;
  const out = [`<div class="spacer w${Math.min(12, 2 + titleW(p))}"></div>`];
  const fnBox = n => {
    const fn = p.footnotes[n - 1];
    if (!fn) return '';
    const fm = WMARK.exec(fn);
    return `<div class="box cap ${fm ? 'w' + fm[1] : fnW}" id="fn${n}"><span class="n">[${n}]</span> ${inline(fn.replace(WMARK, ''), p.id)}</div>`;
  };
  const para = (raw, w) => {
    const wm = WMARK.exec(raw), par = raw.replace(WMARK, '');
    return par.startsWith('## ') ? `<div class="br"></div><div class="box text h">${esc(par.slice(3))}</div><div class="br"></div>`
      : `<div class="box text ${wm ? 'w' + wm[1] : w}">${inline(par, p.id)}</div>`;
  };
  const refs = raw => [...raw.matchAll(/\[\^(\d+)\]/g)].map(m => +m[1]);
  // the image captions and the bibliography: numbered lists that look and work the same
  const imgList = w => `<div class="imglist stack w${w || 8}">${imgs.map((im, i) =>
    `<div class="box cap"${isStill(im) ? ` data-lb="${p.id}" data-i="${i}"` : ''}><span class="lbl">[img ${i + 1}]</span> ${inline(im.caption, p.id)}${im.credit ? ` Credit: ${inline(im.credit, p.id)}.` : ''} [${esc(fname(im))}]</div>`).join('')}</div>`;
  const refList = w => (p.refs || []).length ? `<div class="reflist stack w${w || 8}">${p.refs.map((r, i) =>
    `<div class="box cap" id="ref${i + 1}"><span class="lbl">[ref ${i + 1}]</span> ${inline(r, p.id)}</div>`).join('')}</div>` : '';
  const blocks = (p.text || '').split(/\n\n+/).filter(Boolean);
  const imgIndex = Object.fromEntries(imgs.map((im, i) => [im.id, i]));
  const marks = blocks.map(b => MARK.exec(b.replace(WMARK, '').trim()));
  if (p.laid_out || marks.some(Boolean)) {
    // the page as laid out in the backoffice: exactly its blocks, in their order and width
    // (media, footnote boxes or the sheet taken off the page are not shown)
    blocks.forEach((raw, b) => {
      const m = marks[b];
      if (m && m[1] === 'img') { if (m[2] in imgIndex) out.push(figure(p, imgIndex[m[2]], 'w3')); return; }
      if (m && m[1] === 'fn') { out.push(fnBox(+m[2])); return; }
      if (m && m[1] === 'sheet') { out.push(sheetBox); return; }
      if (m && m[1] === 'space') { out.push(spaceBox(m[2])); return; }
      if (m && m[1] === 'br') { out.push('<div class="br"></div>'); return; }
      if (m && m[1] === 'imglist') { if (imgs.length) out.push(imgList(WMARK.exec(raw) && +WMARK.exec(raw)[1])); return; }
      if (m && m[1] === 'refs') { out.push(refList(WMARK.exec(raw) && +WMARK.exec(raw)[1])); return; }
      if (m) return;
      out.push(para(raw, paraW));
    });
  } else {
    // automatic layout: the sheet, a lead image, then each paragraph with its footnotes and the next image
    out.push(sheetBox);
    let next = 0, alt = 0;
    if (imgs.length >= 2) out.push(figure(p, next++, 'w2'));
    else if (imgs.length === 1) out.push(figure(p, next++, 'w12'));
    for (const raw of blocks) {
      out.push(para(raw, paraW));
      if (raw.replace(WMARK, '').startsWith('## ')) continue;
      for (const n of refs(raw)) out.push(fnBox(n));
      if (next < imgs.length) out.push(figure(p, next++, (alt++ % 2) ? 'w2' : 'w3'));
    }
    while (next < imgs.length) out.push(figure(p, next++, (alt++ % 3 === 2) ? 'w3' : 'w2'));
  }
  if (!(p.laid_out || marks.some(Boolean))) {
    if (imgs.length > 1) out.push(imgList());
    out.push(refList());
  }
  // meta: related projects, keywords, domains
  const related = [...new Set([...[...unmark(p.text).matchAll(/\[\[([^#|\]][^|\]]*)\|/g)].map(m => m[1]), ...p.linked_from])].filter(id => P[id] && id !== p.id);
  const tags = p.keywords.filter(k => K[k].type !== 'year');
  out.push(`<div class="br"></div><div class="w7 stack pt">
    ${related.length ? `<div class="box cap">${related.map(id => pLink(id)).join(', ')}</div>` : ''}
    ${tags.length ? `<div class="box cap">${tags.map(k => kLink(k, p.id)).join(', ')}</div>` : ''}
  </div><div class="br"></div>`);
  out.push(domainBlock(p.id, false));
  return `<div class="grid">${out.join('')}</div>`;
}

/* ---------- keyword page ---------- */
function keywordPage(k){
  header('keyword', k.label, 'w' + titleW(k));
  // a passage that uses the keyword, from the first project whose text links it
  let quote = '';
  for (const id of k.projects) {
    const par = (P[id].text || '').split(/\n\n+/).find(x => x.includes(`[[#${k.id}|`));
    if (par) { quote = inline(par.replace(WMARK, ''), id).replace(/<a class="fnref"[^>]*>\[\d+\]<\/a>/g, ''); break; }
  }
  if (!quote) quote = k.description ? esc(k.description) : `${k.projects.length} project${k.projects.length === 1 ? '' : 's'}.`;
  const ps = k.projects.map(id => P[id]);
  const cardW = p => leadImg(p) && aspect(leadImg(p)) > 1.2 ? 'w4' : 'w3';
  const out = [`<div class="spacer w${Math.min(12, 2 + titleW(k))}"></div>`];
  const blocks = (k.page || '').split(/\n\n+/).filter(Boolean).map(parseBlock);
  if (k.laid_out || blocks.some(b => b.m)) {
    // laid out in the backoffice; projects tagged later than the layout follow at the end
    const placed = new Set();
    for (const {w, body, m} of blocks) {
      if (!m) { out.push(body.startsWith('## ') ? `<div class="br"></div><div class="box text h">${esc(body.slice(3))}</div><div class="br"></div>` : `<div class="box text w${w || 8}">${inline(body, null)}</div>`); continue; }
      if (m[1] === 'quote') out.push(`<div class="box text w${w || 4}">${quote}</div>`);
      else if (m[1] === 'card' && P[m[2]] && k.projects.includes(m[2])) { placed.add(m[2]); out.push(card(P[m[2]], w ? 'w' + w : cardW(P[m[2]]), true)); }
      else if (m[1] === 'space') out.push(spaceBox(m[2]));
      else if (m[1] === 'br') out.push('<div class="br"></div>');
    }
    // projects tagged later follow at the end; cards taken off this page stay hidden
    for (const p of ps) if (!placed.has(p.id) && !(k.hide_cards || []).includes(p.id)) out.push(card(p, cardW(p), true));
  } else {
    out.push(`<div class="box text w4">${quote}</div>`, '<div class="br"></div>', spaceBox(2), ...ps.map(p => card(p, cardW(p), true)));
  }
  return `<div class="grid">${out.join('')}
    <div class="br mt"></div>
    <div class="w7 stack"><div class="box cap">Related Projects: ${ps.map(p => pLink(p.id)).join(', ')}</div></div>
    <div class="br"></div>
    ${domainBlock(null, false)}
  </div>`;
}

/* ---------- project list ---------- */
function listPage(){
  header('list', 'Project List', 'w' + titleW(D.list_meta || {}));
  // featured projects as cards, laid out in the backoffice (or automatically); every shown project is in the domain lists
  const blocks = (D.list_page || '').split(/\n\n+/).filter(Boolean).map(parseBlock);
  const out = [`<div class="spacer w${Math.min(12, 2 + titleW(D.list_meta || {}))}"></div>`];
  if (blocks.some(b => b.m)) {
    const placed = new Set();
    for (const {w, body, m} of blocks) {
      if (!m) { out.push(textBlock(body, w)); continue; }
      if (m[1] === 'card' && D.featured.includes(m[2]) && P[m[2]]) { placed.add(m[2]); out.push(card(P[m[2]], w ? 'w' + w : cardW(P[m[2]]))); }
      else if (m[1] === 'space') out.push(spaceBox(m[2]));
      else if (m[1] === 'br') out.push('<div class="br"></div>');
    }
    for (const id of D.featured) if (!placed.has(id)) out.push(card(P[id], cardW(P[id])));
  } else out.push(...D.featured.map(id => card(P[id], cardW(P[id]))));
  return `<div class="grid">${out.join('')}
    <div class="br mt"></div>
    ${domainBlock(null, true)}
  </div>`;
}
// a text block on an editable page: a paragraph N columns wide, or a heading on its own line
const textBlock = (body, w, def = 8) => body.startsWith('## ')
  ? `<div class="br"></div><div class="box text h">${esc(body.slice(3))}</div><div class="br"></div>`
  : `<div class="box text w${w || def}">${inline(body, null)}</div>`;

/* ---------- editable pages (About, Contact, …) ---------- */
function pagePage(pg){
  header(pg.id === 'about' ? 'about' : 'page', pg.title, 'w' + titleW(pg));
  const owner = {id: 'page:' + pg.id, images: pg.media || []};
  const idx = Object.fromEntries(owner.images.map((im, i) => [im.id, i]));
  const out = [`<div class="spacer w${Math.min(12, 2 + titleW(pg))}"></div>`];
  for (const {w, body, m} of (pg.page || '').split(/\n\n+/).filter(Boolean).map(parseBlock)) {
    if (!m) { out.push(textBlock(body, w)); continue; }
    if (m[1] === 'img' && m[2] in idx) out.push(figure(owner, idx[m[2]], 'w3'));
    else if (m[1] === 'space') out.push(spaceBox(m[2]));
    else if (m[1] === 'br') out.push('<div class="br"></div>');
    else if (m[1] === 'infobox' && pg.infobox) out.push(`<div class="box cap w${w || 2}">${pg.infobox.map(([k, v]) => `${esc(k)} ${inline(v)}`).join('; ')}</div>`);
    else if (m[1] === 'chronology' && pg.chronology) out.push(`<div class="w${w || 12} trows">${pg.chronology.map(([y, t]) => `<div class="trow"><div class="box cap w1">${esc(y)}</div><div class="box cap f1">${inline(t)}</div></div>`).join('')}</div>`);
  }
  return `<div class="grid">${out.join('')}</div>`;
}

/* ---------- search ---------- */
// years first, then the keyword types in the order set in the backoffice
const SEARCH_ORDER = ['year', ...D.types.map(x => x.id)];
const SEARCH_W = {year: 'sw-year', material: 'sw-material', place: 'sw-place'};   // widths in site.css
let searchQ = '';
function searchPage(){
  document.getElementById('head').innerHTML = '';
  return `<div class="grid">
    <div class="w12 stack">${nav('search')}
      <div class="searchbar nm"><div class="box"><input id="q" type="search" autocomplete="off" aria-label="Search" value="${esc(searchQ)}"><img src="ui/enter.svg" width="12.999" height="14.9668" alt=""></div><a class="close" href="#" data-back>×</a></div>
    </div>
    <div id="results" class="w12 grid"></div>
  </div>`;
}
function renderResults(){
  const q = norm(searchQ.trim());
  const match = s => !q || sortKey(s).startsWith(q);
  const ps = D.projects.filter(p => match(p.title)).sort(byTitle);
  const years = new Set(ps.map(p => `year-${p.year}`));
  const groups = SEARCH_ORDER.map(t => [t, Object.values(K)
    .filter(k => k.type === t && k.projects.length && (t === 'year' ? (!q || years.has(k.id)) : match(k.label)))
    .sort((a, b) => sortKey(a.label).localeCompare(sortKey(b.label)))]).filter(([, ks]) => ks.length);
  document.getElementById('results').innerHTML = groups.map(([t, ks]) =>
      `<div class="box entries ${SEARCH_W[t] || ''}">${ks.map(k => `<span class="pe"><a href="${R}${k.id}">${esc(k.label)}</a> (${k.projects.length})</span>`).join('')}</div>`).join('')
    + (ps.length ? `<div class="box entries w10 sw-proj">${ps.map(p => { const im = leadImg(p);
        return `<span class="pe"><a href="${R}${p.id}" data-pv="${p.id}">${esc(p.title)}</a>${im ? pic({...im, file: im.file}, '64px').replace('<img', '<img class="thumb"') : ''}</span>`; }).join('')}</div>
      <div class="w2" id="pv"></div>` : '');
  preview(ps.find(p => leadImg(p)));
}
function preview(p){
  const el = document.getElementById('pv');
  if (!el || !p || !leadImg(p)) return;
  el.innerHTML = `<div class="img">${pic(leadImg(p), '17vw', '', false)}</div><div class="t"><a href="${R}${p.id}">${esc(p.title)}</a></div>`;
}
document.addEventListener('mouseover', e => { const a = e.target.closest('#results a[data-pv]'); if (a) preview(P[a.dataset.pv]); });

/* ---------- hover preview of links: projects with their image, keywords without ---------- */
const peek = document.getElementById('peek');
let peekT;
function peekHtml(href){
  const id = decodeURIComponent(href.slice(R.length)), kind = P[id] ? 'p' : K[id] ? 'k' : '';
  if (kind === 'p' && P[id]) {
    const p = P[id], im = leadImg(p);
    const body = esc(plain(p.text).slice(0, 420) || p.sheet.map(x => x.join(' ')).join('; '));
    // one grid column wide, like the narrowest box on the page
    const col = (document.getElementById('page').clientWidth - 11 * 8) / 12;
    return `<div class="tx">${im ? `<img class="ph" src="${im.file}" alt="" data-w="${col}">` : ''}<a href="${R}${p.id}">${esc(p.title)}</a><p>${body}</p></div>`;
  }
  if (kind === 'k' && K[id]) {
    const k = K[id];
    const list = k.projects.map(x => esc(P[x].title)).join(', ');
    return `<div class="tx"><a href="${R}${k.id}">${esc(k.label)}</a> <span class="n">(${k.projects.length})</span><p>${k.description ? esc(k.description) + ' ' : ''}${list}</p></div>`;
  }
  return '';
}
document.addEventListener('mouseover', e => {
  const a = e.target.closest('#page a[href^="/"]');
  if (!a || a.closest('.card, .domains, .entries, #pv, footer')) return;
  const html = peekHtml(a.getAttribute('href'));
  if (!html) return;
  clearTimeout(peekT);
  peekT = setTimeout(() => {
    peek.innerHTML = html;
    const ph = peek.querySelector('.ph');
    if (ph) ph.style.width = ph.dataset.w + 'px';   // set from the script, which the policy allows
    peek.style.display = 'block';
    const r = a.getBoundingClientRect();
    peek.style.left = Math.max(8, Math.min(window.scrollX + r.left, window.scrollX + document.documentElement.clientWidth - peek.offsetWidth - 8)) + 'px';
    peek.style.top = (window.scrollY + r.bottom + 2) + 'px';
  }, 250);
});
document.addEventListener('mouseout', e => {
  if (e.target.closest && e.target.closest('a[href^="/"]')) { clearTimeout(peekT); peek.style.display = 'none'; }
});

/* ---------- lightbox ---------- */
const lb = document.getElementById('lb');
let lbList = [], lbI = 0, lbFrom = null;
function openLb(list, i){
  lbList = list; lbI = i; lbFrom = document.activeElement; drawLb();
  lb.hidden = false; lb.classList.add('on'); document.body.style.overflow = 'hidden';
  lb.querySelector('.x').focus();
}
function closeLb(){
  if (!lb.classList.contains('on')) return;
  lb.classList.remove('on'); lb.hidden = true; document.body.style.overflow = '';
  if (lbFrom && document.contains(lbFrom)) lbFrom.focus();
}
function stepLb(d){ lbI = (lbI + d + lbList.length) % lbList.length; const k = document.activeElement?.dataset?.lbstep; drawLb(); (lb.querySelector(k ? `[data-lbstep="${k}"]` : '.x') || lb).focus(); }
function drawLb(){
  const im = lbList[lbI];
  const alt = (im.html === false ? im.short : im.short.replace(/ <span class="n">\(\d+\)<\/span>/g, '').replace(/<[^>]+>/g, '')).replace(/&amp;/g, '&');
  lb.innerHTML = `<div class="stage">${im.im ? pic(im.im, '100vw', alt, false) : `<img src="${im.file}" alt="${esc(alt)}">`}</div>
    <button type="button" class="x" data-lbclose aria-label="Close">×</button>${lbList.length > 1 ? '<button type="button" class="arr prev" data-lbstep="-1" aria-label="Previous image">←</button><button type="button" class="arr next" data-lbstep="1" aria-label="Next image">→</button>' : ''}
    <div class="bar"><div class="cap"><span class="lbl">[img ${im.n}]</span> ${im.html === false ? esc(im.short) : im.short}</div><div class="full">${im.html === false ? esc(im.caption) : im.caption}${im.src ? ` [${esc(im.src)}]` : ''}</div></div>`;
}
lb.addEventListener('click', e => {
  const s = e.target.closest('[data-lbstep]');
  if (s) stepLb(+s.dataset.lbstep);
  else if (e.target.closest('[data-lbclose]') || e.target.classList.contains('stage')) closeLb();
});
document.addEventListener('keydown', e => {
  if (!lb.classList.contains('on')) return;
  if (e.key === 'Escape') closeLb();
  if (e.key === 'ArrowLeft') stepLb(-1);
  if (e.key === 'ArrowRight') stepLb(1);
  if (e.key === 'Tab') {   // keep the keyboard inside the viewer while it is open
    const f = [...lb.querySelectorAll('button')], i = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(i + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
});
// images open with Enter or Space too
document.addEventListener('keydown', e => {
  const el = (e.key === 'Enter' || e.key === ' ') && e.target.closest && e.target.closest('.fig [data-lb]');
  if (el) { e.preventDefault(); el.click(); }
});

/* ---------- page clicks ---------- */
document.addEventListener('click', e => {
  const t = e.target;
  const lbEl = !t.closest('a') && t.closest('[data-lb]');
  if (lbEl) {
    const p = mediaOwner(lbEl.dataset.lb);
    const list = p.images.map((im, i) => ({im, file: im.file, n: i + 1, short: inline(shortCap(im.caption), p.id), caption: inline(im.caption, p.id) + (im.credit ? ` Credit: ${inline(im.credit, p.id)}.` : ''), src: fname(im)})).filter(x => isStill(x.im));
    openLb(list, Math.max(0, list.findIndex(x => x.n === +lbEl.dataset.i + 1)));
    return;
  }
  const one = t.closest('[data-lbsrc]');
  if (one) { openLb([{file: one.dataset.lbsrc, n: 1, short: one.dataset.lbcap, caption: one.dataset.lbcap, html: false}], 0); return; }
  const dom = t.closest('[data-domains]');
  if (dom) {
    e.preventDefault();
    const wrap = dom.closest('.dom');
    wrap.outerHTML = domainBlock(wrap.dataset.cur || null, !wrap.querySelector('.domains'));
    return;
  }
  const fn = t.closest('[data-fn]');
  if (fn) { e.preventDefault(); const el = document.getElementById('fn' + fn.dataset.fn); if (el) el.scrollIntoView({block: 'center', behavior: 'smooth'}); return; }
  if (t.closest('[data-back]')) { e.preventDefault(); searchQ = ''; history.back(); }
  if (t.closest('#top')) { e.preventDefault(); window.scrollTo({top: 0, behavior: 'smooth'}); }
  if (t.closest('.skip')) { e.preventDefault(); const h = document.querySelector('#head h1, #page h1, #q'); if (h) { h.tabIndex = -1; h.focus(); } }
});
window.addEventListener('scroll', () => document.getElementById('top').classList.toggle('on', window.scrollY > 300), {passive: true});

/* ---------- routing ---------- */
// Entering the site (no hash), a reload or "Fernando Brízio" opens a random project ticked "Reload"
// (or a featured one if none is ticked)
const pool = ids => (ids || []).map(id => P[id]).filter(Boolean);
const READY = [pool(D.reload), pool(D.featured), D.projects].find(l => l.length);
const slugOf = () => decodeURIComponent((location.pathname.startsWith(R) ? location.pathname.slice(R.length) : location.pathname).replace(/^\/+|\/+$/g, ''));
// follow a link inside the site without reloading the page
function go(url, replace){ history[replace ? 'replaceState' : 'pushState'](null, '', url); route(); }
document.addEventListener('click', e => {
  const a = e.target.closest('a[href^="/"]');
  if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
  e.preventDefault();
  go(a.getAttribute('href'));
});
window.addEventListener('popstate', () => route());
function randomArticle(){
  let p;
  do p = READY[Math.floor(Math.random() * READY.length)]; while (READY.length > 1 && slugOf() === p.id);
  go(R + p.id, true);
}

let routed = false;
function route(){
  const id = slugOf();
  if (!id || id === 'wiki.html' || id === 'random') return randomArticle();
  const c = document.getElementById('page');
  let title = 'Project List';
  peek.style.display = 'none';
  closeLb();
  if (P[id]) { c.innerHTML = projectPage(P[id]); title = P[id].title; }
  else if (K[id]) { c.innerHTML = keywordPage(K[id]); title = K[id].label; }
  else if (PG[id]) { c.innerHTML = pagePage(PG[id]); title = PG[id].title; }
  else if (id === 'search') {
    c.innerHTML = searchPage(); title = 'Search';
    const q = document.getElementById('q');
    q.addEventListener('input', () => { searchQ = q.value; renderResults(); });
    q.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = document.querySelector('#results a[data-pv]') || document.querySelector('#results a'); if (a) go(a.getAttribute('href')); } });
    renderResults();
    q.focus();
  }
  else { if (id !== 'list') history.replaceState(null, '', R + 'list'); c.innerHTML = listPage(); }
  c.insertAdjacentHTML('beforeend', footer());
  document.title = title + ' — Fernando Brízio';
  const canon = document.querySelector('link[rel=canonical]');
  if (canon) canon.href = new URL(location.pathname.replace(/\/?$/, '/'), canon.href).href;
  window.scrollTo(0, 0);
  if (routed && id !== 'search') { const h = document.querySelector('#head h1'); if (h) { h.tabIndex = -1; h.focus({preventScroll: true}); } }
  routed = true;
}

// older addresses (wiki.html#p/float, #k/stain, #page/contact, #about…) move to the new ones
(() => {
  const h = decodeURIComponent(location.hash.slice(1));
  if (!h) return;
  const [kind, id] = h.split('/');
  // the backoffice used to live at / : its old bookmarks (/#projects/…) go to /backoffice
  if (['projects', 'keywords', 'pages', 'types'].includes(kind)) { location.replace('/backoffice#' + h); return; }
  const to = R + (id && ['p', 'k', 'page'].includes(kind) ? id : ['about', 'list', 'search'].includes(kind) ? kind : kind === 't' ? 'search' : '');
  history.replaceState(null, '', to);
})();
// A reload always starts on a fresh random "Reload" project; a shared link (e.g. /float) still opens that page.
const nav0 = performance.getEntriesByType('navigation')[0];
if (nav0 && nav0.type === 'reload') randomArticle(); else route();
