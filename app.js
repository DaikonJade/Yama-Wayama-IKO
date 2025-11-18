// Configuration
const DATA_FILE = 'data.csv';
const IMAGES_FOLDER = 'images/';
const PAGE_SIZE = 24;

let items = [];
let filtered = [];
let page = 1;
let wishlist = new Set(JSON.parse(localStorage.getItem('wanted') || '[]'));

// Helpers
function q(id){ return document.getElementById(id); }
function unique(values){ return [...new Set(values.filter(v => v && v.toString().trim()))].sort(); }
function isBlank(s){ return s === undefined || s === null || String(s).trim() === ''; }
// Split a comma/semicolon/slash-separated tag string into normalized tokens
function splitTags(s){
if(!s) return [];
return String(s)
.split(/[,，;；/\|]+/)     // split on common separators (comma, fullwidth comma, semicolon, slash, pipe)
.map(t => t.trim())        // trim whitespace
.filter(Boolean);          // remove empty tokens
}

// Placeholder image (svg data URI) — single-line to avoid parser issues
const PLACEHOLDER = 'data:image/svg+xml;utf8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400"><rect width="100%" height="100%" fill="#eee"/><text x="50%" y="50%" font-size="20" text-anchor="middle" fill="#999" dy=".3em">No image</text></svg>');

// Load CSV and initialize UI (uses your header names, Chinese title prioritized)
fetch(DATA_FILE).then(r => r.text()).then(txt => {
// Parse CSV (safe if Papa is available)
const parsedRows = (typeof Papa !== 'undefined')
? Papa.parse(txt.trim(), { header: true, skipEmptyLines: true }).data
: [];
  // Normalize rows and set a reliable id for each item
const normalized = parsedRows.map((row, i) => ({
  id: ((row['image_filename'] || row.image_filename || ('i' + i)) + '').toString().trim().replace(/^\$/, ''),
  title: (row['中文名字 Chinese Name'] || row['中文名字'] || row['日文名字 Japanese Name'] || row['日文名字'] || '').toString().trim(),
  jp_title: (row['日文名字 Japanese Name'] || row['日文名字'] || '').toString().trim(),
  type: (row['类型 Type'] || row['类型'] || row['Type'] || '').toString().trim(),
  relevant_work: splitTags(row['相关作品 Relevant Work'] || row['相关作品'] || row.relevant_work),
  relevant_character: splitTags(row['相关人物 Relevant Character'] || row['相关人物'] || row.relevant_character),
  relevant_image: splitTags(row['相关柄图 Relevant Image'] || row['相关柄图'] || row.relevant_image),
  releaser: splitTags (row['Releaser/Event 发行商'] || row['发行商'] || row.relevant_event),
  release_date: (row['发行日期 Release Year/Date'] || row['发行日期'] || '').toString().trim(),
  release_price: (row['发行价格 Release Price (JPY)'] || row['发行价格'] || '').toString().trim(),
  release_area: splitTags (row['发行地区 Release Area'] || row['发行地区'] || row.relevant_area),
  resource: (row['信息来源 Resource'] || row['信息来源'] || '').toString().trim(),
  detailed: (row['详细信息 Detailed Information'] || row['详细信息'] || '').toString().trim(),
  description: (row['详细信息 Detailed Information'] || row['description'] || '').toString().trim(),
  image_filename: (row['image_filename'] || row.image_filename || '').toString().trim()
}));

// Expose items globally and locally
items = normalized;
window.items = normalized;

// Update UI if the handlers exist
if (typeof window.populateFilters === 'function') window.populateFilters();
if (typeof window.applyFilters === 'function') window.applyFilters();
})
.catch(err => {
console.error('Failed to load data.csv', err);
const listEl = document.getElementById('list');
if (listEl) listEl.innerHTML = '<p style="color:#b00">Could not load data.csv — upload it to the repo root.</p>';
});

window.populateFilters = function(){
// collect tokens (arrays) from items
const types = unique(items.map(i=>i.type)); // keep as single-select if you want
const works = unique((items||[]).flatMap(i=>i.relevant_work || []));
const chars = unique((items||[]).flatMap(i=>i.relevant_character || []));
const imgs = unique((items||[]).flatMap(i=>i.relevant_image || []));

// fill the simple Type select if present
const selType = q('filter-type');
if(selType){
selType.innerHTML = '<option value="">All Types</option>';
types.forEach(v=>{ const o=document.createElement('option'); o.value=v; o.textContent=v; selType.appendChild(o); });
}

// helper to render checkbox lists into a container
function renderCheckboxes(containerId, tokens, label){
const c = q(containerId);
if(!c) return;
c.innerHTML = '';
// tools
const tools = document.createElement('div');
tools.className = 'controls';
const allBtn = document.createElement('button'); allBtn.type='button'; allBtn.textContent='Select all';
const clearBtn = document.createElement('button'); clearBtn.type='button'; clearBtn.textContent='Clear';
allBtn.onclick = ()=>{ c.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=true); applyFilters(); };
clearBtn.onclick = ()=>{ c.querySelectorAll('input[type=checkbox]').forEach(ch=>ch.checked=false); applyFilters(); };
tools.appendChild(allBtn); tools.appendChild(clearBtn);
c.appendChild(tools);const list = document.createElement('div');
list.style.maxHeight='220px'; list.style.overflow='auto';
tokens.forEach(tok=>{
  const id = containerId + '_opt_' + tok.replace(/\s+/g,'_').replace(/[^\w-]/g,'');
  const labelEl = document.createElement('label');
  labelEl.style.display = 'block';
  labelEl.style.fontSize = '13px';
  labelEl.style.cursor = 'pointer';
  labelEl.innerHTML = `<input type="checkbox" id="${id}" value="${tok}"> ${tok}`;
  list.appendChild(labelEl);
  labelEl.querySelector('input').addEventListener('change', ()=>applyFilters());
});
c.appendChild(list);}

renderCheckboxes('filter-work-container', works, 'Works');
renderCheckboxes('filter-character-container', chars, 'Characters');
renderCheckboxes('filter-image-container', imgs, 'Images');
};

window.removeFromWishlist = function(id){
  wishlist.delete(id); localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist))); window.applyFilters(); window.closeModal && window.closeModal();
};

window.applyFilters = function(){
  const type = q('filter-type') ? q('filter-type').value : '';

function checkedTokens(containerId){
const c = q(containerId);
if(!c) return [];
return Array.from(c.querySelectorAll('input[type=checkbox]:checked')).map(ch=>ch.value);
}
const workSelected = checkedTokens('filter-work-container');
const charSelected = checkedTokens('filter-character-container');
const imgSelected = checkedTokens('filter-image-container');

const search = q('search') ? q('search').value.trim().toLowerCase() : '';

filtered = (items||[]).filter(it=>{
if(type && it.type !== type) return false;// within-field: require all selected tags (AND). Change to .some for OR behavior.
if(workSelected.length){
  const have = (it.relevant_work||[]).map(v=>v.toLowerCase());
  if(!workSelected.every(tok=>have.includes(tok.toLowerCase()))) return false;
}
if(charSelected.length){
  const have = (it.relevant_character||[]).map(v=>v.toLowerCase());
  if(!charSelected.every(tok=>have.includes(tok.toLowerCase()))) return false;
}
if(imgSelected.length){
  const have = (it.relevant_image||[]).map(v=>v.toLowerCase());
  if(!imgSelected.every(tok=>have.includes(tok.toLowerCase()))) return false;
}

if(search){
  const hay = ((it.title||'')+' '+(it.jp_title||'')+' '+(it.description||'')+' '+(it.relevant_work||'')+' '+(it.relevant_character||'')+' '+(it.detailed||'')).toLowerCase();
  if(!hay.includes(search)) return false;
}
return true;});

// same sorting logic
const sort = q('sort') ? q('sort').value : 'title';
filtered.sort((a,b)=>{
const va = (a[sort]||'').toString(); const vb = (b[sort]||'').toString();
if(sort==='release_date'){ const da = Date.parse(va)||0; const db = Date.parse(vb)||0; return db - da; }
return va.localeCompare(vb);
});

page = 1;
window.renderPage && window.renderPage();
};



window.renderPage = function(){
const start = (page - 1) * PAGE_SIZE;
const slice = filtered.slice(start, start + PAGE_SIZE);
const list = q('list');
if (!list) return;
list.innerHTML = '';
slice.forEach(it => {
const card = document.createElement('div'); card.className = 'card';
card.dataset.id = it.id;
const imgSrc = window.imgUrl ? window.imgUrl(it) : '';
card.innerHTML =        `<img class="thumb" src="${window.escapeAttr ? window.escapeAttr(imgSrc) : imgSrc}" alt="">       <div class="card-body">         <strong>${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</strong>         <div class="meta">${window.escapeHtml ? window.escapeHtml(it.type) : it.type} • ${window.escapeHtml ? window.escapeHtml(it.relevant_work) : it.relevant_work} • ${window.escapeHtml ? window.escapeHtml(it.relevant_character) : it.relevant_character}</div>         <div class="buttons">           <button class="detail-btn">Details</button>           <button class="${wishlist.has(it.id)?'wishlist-btn':''}" data-id="${it.id}">${wishlist.has(it.id)?'Wanted':'Add'}</button>         </div>       </div>`;
list.appendChild(card);
const wlBtn = card.querySelector('button[data-id]');
if (wlBtn) wlBtn.addEventListener('click', () => window.toggleWishlist && window.toggleWishlist(it.id, wlBtn));
});
const max = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
const pageInfo = q('page-info');
if (pageInfo) pageInfo.textContent = `Page ${page} / ${max} — ${filtered.length} results`;
};
// Global openDetail (tolerant, lazy-loads CSV if items missing)
window.openDetail = async function(id){
try{
if(!id) return console.warn('openDetail called without id');
id = String(id).trim().replace(/^$/,'');
// ensure items available
if(!window.items || !window.items.length){
if(typeof Papa === 'undefined'){
console.warn('PapaParse not loaded; cannot lazy-load CSV');
return;
}
const txt = await fetch('data.csv?_=' + Date.now()).then(r=>r.text());
const parsed = Papa.parse(txt.trim(), {header:true, skipEmptyLines:true}).data;
// normalize ids
window.items = parsed.map((row,i)=>({
...row,
id: (row['image_filename'] || row.image_filename || ('i'+i) || '').toString().trim().replace(/^$/,'')
}));
// optionally refresh UI
if(typeof window.populateFilters === 'function') window.populateFilters();
if(typeof window.applyFilters === 'function') window.applyFilters();
}
// tolerant lookup (match normalized ids)
const cleaned = id.replace(/^$/,'');
let it = window.items.find(x => (x.id||'').toString().trim().replace(/^$/,'') === cleaned);
if(!it){
// fallback: substring match
it = window.items.find(x => (x.id||'').toString().includes(cleaned) || cleaned.includes((x.id||'').toString()));
}
if(!it){ console.warn('item not found', id); return; }
const img = (window.imgUrl ? window.imgUrl(it) : '') || '';
const html =`<div style="display:flex;gap:12px;flex-wrap:wrap">         <img src="${window.escapeAttr ? window.escapeAttr(img) : img}" style="max-width:320px;width:100%;border-radius:6px" alt="">         <div style="flex:1;min-width:220px">           <h2 style="margin:0">${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</h2>           <div class="small">${window.escapeHtml ? window.escapeHtml(it.type) : it.type} • ${window.escapeHtml ? window.escapeHtml(it.relevant_work) : it.relevant_work}</div>           <p style="margin-top:12px">${window.escapeHtml ? window.escapeHtml(it.detailed||it.description||'') : (it.detailed||it.description||'')}</p>           <div style="margin-top:10px">             ${ it.resource                ?`来源: <a href="$${window.escapeAttr ? window.escapeAttr(it.resource) : it.resource}" target="_blank">$${window.escapeHtml ? window.escapeHtml(it.resource) : it.resource}</a>`: '' }           </div>           <div style="margin-top:12px"><button onclick="window.toggleWishlist && window.toggleWishlist('${it.id}', this)">${wishlist.has(it.id)?'Wanted':'Add to Wanted'}</button></div>         </div>       </div>`;
if(window.openModal) window.openModal(html); else alert(it.title||it.id);
}catch(e){
console.error('openDetail error', e);
}
};
window.openDetail = function(id){
if(!window.items) return;
const it = window.items.find(x => x.id === id);
if(!it) return;
const img = window.imgUrl ? window.imgUrl(it) : '';
const html =     `<div style="display:flex;gap:12px;flex-wrap:wrap">       <img src="${window.escapeAttr ? window.escapeAttr(img) : img}" style="max-width:320px;width:100%;border-radius:6px" alt="">       <div style="flex:1;min-width:220px">         <h2 style="margin:0">${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</h2>         <div class="small">${window.escapeHtml ? window.escapeHtml(it.type) : it.type} • ${window.escapeHtml ? window.escapeHtml(it.relevant_work) : it.relevant_work}</div>         <p style="margin-top:12px">${window.escapeHtml ? window.escapeHtml(it.detailed||it.description||'') : (it.detailed||it.description||'')}</p>         <div style="margin-top:10px">${it.resource ?`来源: <a href="${window.escapeAttr ? window.escapeAttr(it.resource) : it.resource}" target="_blank">${window.escapeHtml ? window.escapeHtml(it.resource) : it.resource}</a>` : ''}</div>         <div style="margin-top:12px"><button onclick="window.toggleWishlist && window.toggleWishlist('${it.id}', this)">${wishlist.has(it.id)?'Wanted':'Add to Wanted'}</button></div>       </div>     </div>`;
if(window.openModal) window.openModal(html); else alert(it.title||it.id);
};

window.toggleWishlist = function(id, btn){
  if (wishlist.has(id)){ wishlist.delete(id); if (btn){ btn.classList.remove('wishlist-btn'); btn.textContent = 'Add'; } }
  else { wishlist.add(id); if (btn){ btn.classList.add('wishlist-btn'); btn.textContent = 'Wanted'; } }
  localStorage.setItem('wanted', JSON.stringify(Array.from(wishlist)));
};
const listEl = document.getElementById('list');
if (listEl) {
listEl.addEventListener('click', function (e) {
const btn = e.target.closest('.detail-btn');
if (!btn) return;
const card = btn.closest('.card');
const idBtn = card && card.querySelector('button[data-id]');
const id = idBtn ? idBtn.getAttribute('data-id') : (card && card.dataset && card.dataset.id);
if (id) window.openDetail && window.openDetail(id);
});
}
window.showWishlist = function(){
const ids = Array.from(wishlist);
const listItems = items.filter(it => ids.includes(it.id));
if (listItems.length === 0) return window.openModal && window.openModal('<p>No items in your Wanted list yet.</p>');
const html = listItems.map(it =>     `<div style="display:flex;gap:10px;margin-bottom:10px">       <img src="${window.escapeAttr ? window.escapeAttr(window.imgUrl(it)) : window.imgUrl(it)}" alt="" style="width:90px;height:90px;object-fit:cover;border-radius:6px">       <div>         <strong>${window.escapeHtml ? window.escapeHtml(it.title||it.jp_title||it.id) : (it.title||it.jp_title||it.id)}</strong>         <div class="small">${window.escapeHtml ? window.escapeHtml(it.type) : it.type} • ${window.escapeHtml ? window.escapeHtml(it.relevant_work) : it.relevant_work}</div>         <div style="margin-top:6px"><button class="ghost" data-remove="${it.id}">Remove</button></div>       </div>     </div>`  ).join('');
window.openModal && window.openModal(html);
setTimeout(() => {
document.querySelectorAll('[data-remove]').forEach(btn => {
btn.addEventListener('click', () => {
const id = btn.getAttribute('data-remove');
window.removeFromWishlist && window.removeFromWishlist(id);
});
});
}, 10);
};
// Permanent event delegation for Details buttons (attach once)
(function(){
const listEl = document.getElementById('list');
if(!listEl) return;
if(listEl._detailDelegation) return; // already attached
listEl._detailDelegation = function(e){
const btn = e.target.closest('.detail-btn');
if(!btn) return;
const card = btn.closest('.card');
const idBtn = card && card.querySelector('button[data-id]');
const id = idBtn ? idBtn.getAttribute('data-id') : (card && card.dataset && card.dataset.id);
if(id) window.openDetail && window.openDetail(id);
};
listEl.addEventListener('click', listEl._detailDelegation);
})();
window.openModal = function(html){
  const modal = q('modal'); const content = q('modal-content');
  if (!modal || !content) return;
  content.innerHTML = html;
  modal.style.display = 'flex';
  modal.setAttribute('aria-hidden', 'false');
};

window.closeModal = function(){
  const modal = q('modal');
  if (!modal) return;
  modal.style.display = 'none';
  modal.setAttribute('aria-hidden', 'true');
};
// Ensure Close button hides the modal
const closeBtn = document.getElementById('close-modal');
if (closeBtn) {
closeBtn.addEventListener('click', function () {
if (typeof window.closeModal === 'function') {
window.closeModal();
} else {
const m = document.getElementById('modal');
if (m) { m.style.display = 'none'; m.setAttribute('aria-hidden', 'true'); }
}
});
}
window.escapeHtml = function(s){ if(!s) return ''; return String(s).replace(/[&<>"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c])); };
window.escapeAttr = function(s){ return s ? String(s).replace(/"/g,'&quot;') : ''; };
window.imgUrl = function(it){
  if (!it || !it.image_filename) return PLACEHOLDER;
  return IMAGES_FOLDER + it.image_filename;
};
