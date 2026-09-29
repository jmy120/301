const state = { model: null, selected: null, selectedElement: null };
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);

$('file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  $('status').textContent = '正在解析…';
  try {
    const response = await fetch('/api/models/import', { method: 'POST', headers: { 'content-type': 'application/xml', 'x-file-name': file.name }, body: await file.text() });
    const data = await response.json(); if (!response.ok) throw new Error(data.message ?? '导入失败');
    state.model = data; state.selected = data.diagrams[0]?.id; state.selectedElement = null;
    $('status').textContent = '解析完成'; $('title').textContent = file.name; $('subtitle').textContent = `${data.statistics.elements} 个元素 · ${data.statistics.relations} 条关系 · ${data.statistics.diagrams} 张图`;
    render();
  } catch (error) { $('status').textContent = '导入失败'; $('workspace').innerHTML = `<strong>无法解析文件</strong><span>${esc(error.message)}</span>`; }
});

function renderTree() {
  const model = state.model; const byParent = new Map();
  const ids = new Set(model.elements.map(element => element.id));
  for (const element of model.elements) {
    // XML/XMI wrapper nodes are deliberately not exposed as model elements;
    // their children therefore belong at the visible tree root.
    const parent = element.ownerId && ids.has(element.ownerId) ? element.ownerId : '';
    (byParent.get(parent) ?? byParent.set(parent, []).get(parent)).push(element);
  }
  const draw = (parent, depth = 0) => (byParent.get(parent) ?? []).map(item => `<button class="indent" style="padding-left:${8 + depth * 16}px" data-element="${esc(item.id)}">${item.childrenIds.length ? '▾' : '·'} ${esc(item.name ?? item.metaClass.replace('uml:', ''))}</button>${draw(item.id, depth + 1)}`).join('');
  $('tree').innerHTML = draw('') || '<p>没有可显示的顶层元素</p>';
  document.querySelectorAll('[data-element]').forEach(button => button.addEventListener('click', () => { state.selectedElement = button.dataset.element; renderDetails(); document.querySelectorAll('[data-element]').forEach(x => x.classList.toggle('active', x.dataset.element === state.selectedElement)); }));
}
function bounds(value) { const n = String(value ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number); return n?.length >= 4 ? n : null; }
function renderCanvas(diagram) {
  const elements = new Map([...state.model.elements, ...state.model.relations, ...state.model.diagrams].map(x => [x.id, x]));
  const views = diagram.views ?? []; const parsed = views.map(view => ({ view, box: bounds(view.bounds) })).filter(x => x.box);
  const maxX = Math.max(820, ...parsed.map(x => x.box[0] + x.box[2] + 40)); const maxY = Math.max(480, ...parsed.map(x => x.box[1] + x.box[3] + 40));
  const nodes = parsed.map(({view, box}) => { const [x,y,w,h] = box; const item = elements.get(view.modelElementId); const kind = view.kind ?? ''; const edge = /edge|path|connector|flow|transition/i.test(kind); const frame = /frame/i.test(kind); const text = item?.name ?? kind; return `<button class="shape ${edge ? 'edge' : ''} ${frame ? 'frame' : ''} ${state.selectedElement === view.modelElementId ? 'selected' : ''}" data-view-element="${esc(view.modelElementId ?? '')}" title="${esc(item?.qualifiedName ?? text)}" style="left:${x}px;top:${y}px;width:${Math.max(w, edge ? 30 : 20)}px;height:${Math.max(h, edge ? 8 : 18)}px">${edge ? '' : esc(text)}</button>`; }).join('');
  return `<div class="canvas-wrap"><div class="canvas" style="width:${maxX}px;height:${maxY}px">${nodes || '<div class="empty"><strong>该图没有可用的几何视图</strong></div>'}</div></div>`;
}
function renderDetails() {
  const item = state.selectedElement && [...state.model.elements, ...state.model.relations, ...state.model.diagrams].find(x => x.id === state.selectedElement);
  const host = $('detail-content'); if (!host) return;
  if (!item) { host.innerHTML = '<p>选择模型树或图中的元素查看详细属性。</p>'; return; }
  host.innerHTML = `<h3>${esc(item.name ?? item.metaClass)}</h3><ul class="detail-list"><li><span class="label">元类</span>${esc(item.metaClass)}</li><li><span class="label">限定名</span>${esc(item.qualifiedName ?? '—')}</li><li><span class="label">构造型</span>${esc(item.stereotypes?.join(', ') || '—')}</li><li><span class="label">ID</span>${esc(item.id)}</li><li><span class="label">来源 XPath</span>${esc(item.sourceXPath)}</li></ul>`;
}
async function render() {
  renderTree(); const diagram = state.model.diagrams.find(x => x.id === state.selected) ?? state.model.diagrams[0];
  const response = await fetch(`/api/diagrams/${encodeURIComponent(diagram.id)}`); const full = await response.json();
  $('workspace').className = ''; $('workspace').innerHTML = `<div class="grid"><section class="card canvas-card"><div class="card-head"><span>${esc(full.name ?? '未命名图')}</span><span class="label">${esc(full.type)}</span></div>${renderCanvas(full)}</section><aside class="card details"><div class="stats"><div class="stat">模型元素<b>${state.model.statistics.elements}</b></div><div class="stat">关系<b>${state.model.statistics.relations}</b></div><div class="stat">图形视图<b>${state.model.statistics.views}</b></div><div class="stat">解析问题<b>${state.model.issues.length}</b></div></div><div id="detail-content"><p>选择模型树或图中的元素查看详细属性。</p></div></aside></div><section class="card diagrams"><div class="card-head">图列表 <span class="label">${state.model.diagrams.length} 张图</span></div><div id="diagram-list" class="diagram-list">${state.model.diagrams.map(x => `<button class="${x.id === diagram.id ? 'active' : ''}" data-diagram="${esc(x.id)}">${esc(x.name ?? x.type)}</button>`).join('')}</div></section>`;
  document.querySelectorAll('[data-diagram]').forEach(button => button.addEventListener('click', () => { state.selected = button.dataset.diagram; state.selectedElement = null; render(); }));
  document.querySelectorAll('[data-view-element]').forEach(button => button.addEventListener('click', () => { if (button.dataset.viewElement) { state.selectedElement = button.dataset.viewElement; renderDetails(); document.querySelectorAll('[data-view-element]').forEach(x => x.classList.toggle('selected', x.dataset.viewElement === state.selectedElement)); } }));
}
