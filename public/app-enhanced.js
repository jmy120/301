const state = { model: null, selected: null, selectedElement: null, scale: 1 };
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
const items = () => state.model ? [...state.model.elements, ...state.model.relations, ...state.model.diagrams] : [];

document.head.insertAdjacentHTML('beforeend', `<style>
.status.busy{background:#e9efff;color:#294eaa}.status.error{background:#fff0f1;color:#bc3444}.toolbar{display:flex;align-items:center;gap:5px}.tool{border:1px solid #e5eaf1;background:#fff;border-radius:5px;padding:3px 8px;cursor:pointer}.tool:hover{background:#eef4ff}.issues{max-height:230px;overflow:auto;margin:0;padding:0;list-style:none}.issue{width:100%;border:0;border-bottom:1px solid #eef1f5;background:#fff;padding:8px 0;text-align:left;cursor:pointer}.issue:hover{background:#f7f9fd}.badge{font-size:10px;border-radius:99px;padding:2px 6px;margin-right:5px;background:#fff0f1;color:#bc3444}.badge.warning{background:#fff7e8;color:#a86800}.empty{padding:25px}.shape.edge:hover:after,.shape.edge.selected:after{border-color:#3169df;border-width:3px}
</style>`);
function status(text, type = '') { const n = $('status'); n.textContent = text; n.className = `status ${type}`; }
function selectElement(id) { state.selectedElement = id; renderDetails(); document.querySelectorAll('[data-element]').forEach(n => n.classList.toggle('active', n.dataset.element === id)); document.querySelectorAll('[data-view-element]').forEach(n => n.classList.toggle('selected', n.dataset.viewElement === id)); }

$('file').addEventListener('change', async event => {
  const file = event.target.files?.[0]; if (!file) return;
  if (file.size > 100 * 1024 * 1024) { status('文件过大', 'error'); $('workspace').innerHTML = '<strong>文件超过 100 MB 限制</strong><span>请导出较小的模型文件后重试。</span>'; return; }
  status('正在解析…', 'busy'); $('workspace').className = 'empty card'; $('workspace').innerHTML = '<strong>正在导入模型</strong><span>大文件可能需要一些时间。</span>';
  try {
    const response = await fetch('/api/models/import', { method: 'POST', headers: { 'content-type': 'application/xml', 'x-file-name': file.name }, body: await file.text() });
    const data = await response.json(); if (!response.ok) throw new Error(data.message ?? '导入失败');
    state.model = data; state.selected = data.diagrams[0]?.id ?? null; state.selectedElement = null; state.scale = 1;
    status(`解析完成 · ${data.issues.length} 个问题`); $('title').textContent = file.name; $('subtitle').textContent = `${data.statistics.elements} 个元素 · ${data.statistics.relations} 条关系 · ${data.statistics.diagrams} 张图`;
    render();
  } catch (error) { status('导入失败', 'error'); $('workspace').innerHTML = `<strong>无法解析文件</strong><span>${esc(error.message)}</span>`; }
  finally { event.target.value = ''; }
});

function renderTree() {
  const byParent = new Map(), ids = new Set(state.model.elements.map(x => x.id));
  for (const item of state.model.elements) { const p = item.ownerId && ids.has(item.ownerId) ? item.ownerId : ''; (byParent.get(p) ?? byParent.set(p, []).get(p)).push(item); }
  const draw = (p, d = 0) => (byParent.get(p) ?? []).map(x => `<button class="indent" style="padding-left:${8 + d * 16}px" data-element="${esc(x.id)}">${x.childrenIds.length ? '▾' : '·'} ${esc(x.name ?? x.metaClass.replace('uml:', ''))}</button>${draw(x.id, d + 1)}`).join('');
  $('tree').innerHTML = draw('') || '<p>没有可显示的顶层元素</p>';
  document.querySelectorAll('[data-element]').forEach(n => n.addEventListener('click', () => selectElement(n.dataset.element)));
}
function bounds(value) { const n = String(value ?? '').match(/-?\d+(?:\.\d+)?/g)?.map(Number); return n?.length >= 4 ? n : null; }
function canvas(diagram) {
  const byId = new Map(items().map(x => [x.id, x])); const parsed = (diagram.views ?? []).map(v => ({ v, b: bounds(v.bounds) })).filter(x => x.b);
  const width = Math.max(820, ...parsed.map(x => x.b[0] + x.b[2] + 40)), height = Math.max(480, ...parsed.map(x => x.b[1] + x.b[3] + 40));
  const shapes = parsed.map(({v,b}) => { const [x,y,w,h] = b, object = byId.get(v.modelElementId), kind = v.kind ?? '', edge = /edge|path|connector|flow|transition/i.test(kind), frame = /frame/i.test(kind), label = v.label || object?.name || kind; return `<button class="shape ${edge ? 'edge' : ''} ${frame ? 'frame' : ''} ${state.selectedElement === v.modelElementId ? 'selected' : ''}" data-view-element="${esc(v.modelElementId ?? '')}" title="${esc(object?.qualifiedName ?? label)}" style="left:${x}px;top:${y}px;width:${Math.max(w,edge ? 30 : 20)}px;height:${Math.max(h,edge ? 8 : 18)}px">${edge ? '' : esc(label)}</button>`; }).join('');
  return `<div class="canvas-wrap"><div class="canvas" style="width:${width}px;height:${height}px;transform:scale(${state.scale});margin-bottom:${Math.round((state.scale-1)*height)}px">${shapes || '<div class="empty"><strong>该图没有可用的几何视图</strong><span>可通过左侧模型树查看解析结果。</span></div>'}</div></div>`;
}
function renderDetails() { const h = $('detail-content'); if (!h) return; const x = state.selectedElement && items().find(y => y.id === state.selectedElement); h.innerHTML = x ? `<h3>${esc(x.name ?? x.metaClass)}</h3><ul class="detail-list"><li><span class="label">元类</span>${esc(x.metaClass)}</li><li><span class="label">限定名</span>${esc(x.qualifiedName ?? '—')}</li><li><span class="label">构造型</span>${esc(x.stereotypes?.join(', ') || '—')}</li><li><span class="label">ID</span>${esc(x.id)}</li><li><span class="label">来源 XPath</span>${esc(x.sourceXPath)}</li></ul>` : '<p>选择模型树、图元或校验问题以查看详情。</p>'; }
function issues() { return state.model.issues.length ? `<ul class="issues">${state.model.issues.map(x => `<li><button class="issue" data-issue="${esc(x.elementId ?? '')}"><span class="badge ${x.severity === 'warning' ? 'warning' : ''}">${x.severity === 'warning' ? '警告' : '错误'}</span>${esc(x.message)}<span class="label">${esc(x.xpath)}</span></button></li>`).join('')}</ul>` : '<p>未发现解析和引用问题。</p>'; }
function bindIssues() { document.querySelectorAll('[data-issue]').forEach(n => n.addEventListener('click', () => n.dataset.issue && selectElement(n.dataset.issue))); }
async function render() {
  renderTree();
  if (!state.selected) { $('workspace').className = 'card'; $('workspace').innerHTML = `<div class="empty"><strong>模型中没有可展示的图</strong><span>已解析 ${state.model.statistics.elements} 个模型元素；可通过左侧模型树浏览。</span></div><section class="details" id="detail-content"></section><section class="details"><h3>校验问题（${state.model.issues.length}）</h3>${issues()}</section>`; bindIssues(); return; }
  try {
    const response = await fetch(`/api/diagrams/${encodeURIComponent(state.selected)}`), diagram = await response.json(); if (!response.ok) throw new Error(diagram.message ?? '图加载失败');
    $('workspace').className = ''; $('workspace').innerHTML = `<div class="grid"><section class="card canvas-card"><div class="card-head"><span>${esc(diagram.name ?? '未命名图')}</span><div class="toolbar"><button class="tool" data-zoom="out">－</button><span class="label">${Math.round(state.scale*100)}%</span><button class="tool" data-zoom="in">＋</button><button class="tool" data-zoom="reset">重置</button></div></div>${canvas(diagram)}</section><aside class="card details"><div class="stats"><div class="stat">模型元素<b>${state.model.statistics.elements}</b></div><div class="stat">关系<b>${state.model.statistics.relations}</b></div><div class="stat">图形视图<b>${state.model.statistics.views}</b></div><div class="stat">解析问题<b>${state.model.issues.length}</b></div></div><div id="detail-content"></div><h3>校验问题（${state.model.issues.length}）</h3>${issues()}</aside></div><section class="card diagrams"><div class="card-head">图列表 <span class="label">${state.model.diagrams.length} 张图</span></div><div class="diagram-list">${state.model.diagrams.map(x => `<button class="${x.id===diagram.id?'active':''}" data-diagram="${esc(x.id)}">${esc(x.name ?? x.type)}</button>`).join('')}</div></section>`;
    renderDetails(); document.querySelectorAll('[data-diagram]').forEach(n => n.addEventListener('click', () => { state.selected=n.dataset.diagram; state.selectedElement=null; state.scale=1; render(); })); document.querySelectorAll('[data-view-element]').forEach(n => n.addEventListener('click', () => n.dataset.viewElement && selectElement(n.dataset.viewElement))); document.querySelectorAll('[data-zoom]').forEach(n => n.addEventListener('click', () => { state.scale=n.dataset.zoom==='in'?Math.min(2,state.scale+.2):n.dataset.zoom==='out'?Math.max(.4,state.scale-.2):1; render(); })); bindIssues();
  } catch (error) { status('图加载失败','error'); $('workspace').className='empty card'; $('workspace').innerHTML=`<strong>图加载失败</strong><span>${esc(error.message)}</span>`; }
}
