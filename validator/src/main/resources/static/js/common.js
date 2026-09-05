/* =========================================================
   通用工具：严重级别/来源映射、HTML转义、Toast、模型树构建
   ========================================================= */

const SEVERITY = {
    BLOCKER: { label: "阻断", cls: "sev-blocker" },
    ERROR:   { label: "错误", cls: "sev-error" },
    WARNING: { label: "警告", cls: "sev-warning" },
    INFO:    { label: "提示", cls: "sev-info" }
};

function sevInfo(code) {
    if (!code) return { label: "未知", cls: "sev-info" };
    const upper = String(code).toUpperCase();
    return SEVERITY[upper] || { label: code, cls: "sev-info" };
}

function severityLabel(code) {
    return sevInfo(code).label;
}

function sourceLabel(source) {
    const map = { parser: "解析器", builtin: "内置结构", rule: "规则" };
    return map[String(source || "").toLowerCase()] || source || "-";
}

function esc(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function showToast(msg, type) {
    type = type || "info";
    let box = document.getElementById("toast-box");
    if (!box) {
        box = document.createElement("div");
        box.id = "toast-box";
        document.body.appendChild(box);
    }
    const el = document.createElement("div");
    el.className = "toast " + type;
    el.textContent = msg;
    box.appendChild(el);
    setTimeout(() => el.remove(), 3500);
}

function parseJsonSafe(text) {
    try {
        return JSON.parse(text);
    } catch (e) {
        throw new Error("JSON 解析失败：" + e.message);
    }
}

function fmtDate(ts) {
    const d = new Date(ts);
    const p = n => String(n).padStart(2, "0");
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
        " " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
}

/* ---------- localStorage 存取 ---------- */
const Store = {
    KEY_MODEL: "sysml.currentModel",
    KEY_RESULT: "sysml.lastResult",
    KEY_RESULT_TIME: "sysml.lastResultTime",
    KEY_SELECTION: "sysml.lastSelection",
    KEY_LAYOUT: "sysml.layout",
    KEY_RULES: "sysml.rulesCache",
    save(key, value) {
        try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) { /* 忽略 */ }
    },
    load(key) {
        try {
            const raw = localStorage.getItem(key);
            return raw ? JSON.parse(raw) : null;
        } catch (e) { return null; }
    }
};

/* ---------- 由解析结果构建模型结构树 ---------- */
function buildTree(model) {
    if (!model) return "<div class='empty-hint'><div class='big'>📭</div><div>暂无模型，请先粘贴解析 JSON</div></div>";
    const elements = model.elements || [];
    const relations = model.relations || [];
    const diagrams = model.diagrams || [];
    const views = model.views || [];

    // 以 id 分组（允许重复 id，用下标区分）
    const byId = new Map();
    elements.forEach((el, idx) => {
        const key = el.id || ("#e" + idx);
        if (!byId.has(key)) byId.set(key, []);
        byId.get(key).push(el);
    });

    // 找出顶层元素（无 ownerId 或 owner 不存在）
    const ids = new Set();
    elements.forEach(el => { if (el.id) ids.add(el.id); });
    const topLevel = elements.filter(el => !el.ownerId || !ids.has(el.ownerId));
    const used = new Set();
    const visited = new Set();

    const itemHtml = el => {
        const meta = el.metaClass || "";
        const st = (el.stereotypes || []).join(",");
        const name = el.name || el.id || "(未命名)";
        return "<span class='item-meta'>" + esc(name) + (st ? " <span class='badge'>«" + esc(st) + "»</span>" : "") +
            "<br><small>" + esc(meta) + "</small></span>";
    };

    const renderElement = el => {
        if (visited.has(el)) return "";
        visited.add(el);
        const kids = (el.childrenIds || [])
            .map(id => (byId.get(id) || []).shift())
            .filter(Boolean);
        const attr = " data-kind='element' data-id='" + esc(el.id || "") + "'";
        if (!kids.length) {
            return "<li" + attr + ">" + itemHtml(el) + "</li>";
        }
        return "<li class='folder'" + attr + "><span class='toggle'>▾</span>" + itemHtml(el) + "<ul class='tree'>" +
            kids.map(renderElement).join("") + "</ul></li>";
    };

    let html = "<ul class='tree'>";
    const source = model.source || {};
    html += "<li class='folder'><span class='toggle'>▾</span>📁 " + esc(source.fileName || model.id || "模型") +
        "<ul class='tree'>";
    html += "<li class='folder'><span class='toggle'>▾</span>📁 元素（" + elements.length + "）<ul class='tree'>";
    topLevel.forEach(el => { html += renderElement(el); });
    html += "</ul></li>";
    html += "<li class='folder'><span class='toggle'>▾</span>🔗 关系（" + relations.length + "）<ul class='tree'>";
    relations.forEach(r => {
        const name = r.name || r.id || "(未命名)";
        html += "<li data-kind='relation' data-id='" + esc(r.id || "") + "'><span class='item-meta'>" + esc(name) + " <span class='badge'>" + esc(r.kind || r.metaClass || "") + "</span><br><small>" +
            esc(r.sourceId || "?") + " → " + esc(r.targetId || "?") + "</small></span></li>";
    });
    html += "</ul></li>";
    html += "<li class='folder'><span class='toggle'>▾</span>📊 图（" + diagrams.length + "）<ul class='tree'>";
    diagrams.forEach(d => {
        html += "<li data-kind='diagram' data-id='" + esc(d.id || "") + "'><span class='item-meta'>" + esc(d.name || d.id) + " <span class='badge'>" + esc(d.type || "Diagram") + "</span><br><small>" +
            (d.viewIds || []).length + " 个视图</small></span></li>";
    });
    html += "</ul></li>";
    html += "</ul></li>";
    html += "</ul>";
    return html;
}

/* 树折叠/展开（委托，防止重复渲染叠加多个监听器） */
function bindTreeToggle(root) {
    if (root.__treeBound) return;
    root.__treeBound = true;
    root.addEventListener("click", e => {
        const toggle = e.target.closest(".toggle");
        if (!toggle) return;
        const ul = toggle.parentElement.querySelector("ul");
        if (ul) ul.style.display = ul.style.display === "none" ? "" : "none";
        toggle.textContent = ul.style.display === "none" ? "▸" : "▾";
    });
}

/* 树节点选中（委托，防重复绑定）；onSelect({kind,id}) kind 为 element/relation/diagram */
function bindTreeSelect(root, onSelect) {
    if (root.__treeSelectBound) return;
    root.__treeSelectBound = true;
    root.addEventListener("click", e => {
        if (e.target.closest(".toggle")) return; // 折叠按钮不触发选中
        const li = e.target.closest("li[data-kind]");
        if (!li) return;
        root.querySelectorAll("li[data-kind]").forEach(x => x.classList.remove("select"));
        li.classList.add("select");
        onSelect({ kind: li.dataset.kind, id: li.dataset.id });
    });
}

/* 校验统计：计算通过率等展示数据 */
function calcSummary(result) {
    const counts = { BLOCKER: 0, ERROR: 0, WARNING: 0, INFO: 0 };
    const issues = (result && result.issues) || [];
    issues.forEach(it => {
        const key = String(it.severity || "INFO").toUpperCase();
        counts[key] = (counts[key] || 0) + 1;
    });
    const st = (result && result.statistics) || {};
    const total = (st.elements || 0) + (st.relations || 0) + (st.diagrams || 0) + (st.views || 0);
    let passRate = null;
    if (total > 0) {
        passRate = Math.max(0, Math.round((total - issues.length) / total * 100));
    } else if (issues.length === 0) {
        passRate = 100;
    }
    return { counts, passRate };
}