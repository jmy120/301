/* =========================================================
   主工作台逻辑（m-design 风格布局）：
   - 左侧模型树 / 中间图查看器 / 右侧校验结果，均可折叠与拖动
   - 统计信息收敛到底部状态栏，提高画布利用率
   ========================================================= */
(() => {
    "use strict";

    const $ = sel => document.querySelector(sel);

    /* ---------- 示例数据（与 sample/sample-parsed-model.json 一致） ---------- */
    const SAMPLE_MODEL = JSON.parse(`{
  "id": "sample-1",
  "source": {
    "fileName": "test1.xml",
    "encoding": "UTF-8",
    "xmiVersion": "2.5",
    "productVersion": "2026x v2"
  },
  "elements": [
    { "id": "e1", "metaClass": "uml:Class", "name": "BlockA", "qualifiedName": "系统::BlockA", "ownerId": null, "childrenIds": ["e2"], "stereotypes": ["Block"], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/BlockA" },
    { "id": "e1", "metaClass": "uml:Class", "name": "BlockB", "qualifiedName": "系统::BlockB", "ownerId": null, "childrenIds": [], "stereotypes": ["Block"], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/BlockB" },
    { "id": "e4", "metaClass": "uml:Class", "name": "BlockC", "qualifiedName": "系统::BlockC", "ownerId": null, "childrenIds": [], "stereotypes": ["Block"], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/BlockC" },
    { "id": "e2", "metaClass": "uml:Property", "name": "Port1", "qualifiedName": "系统::BlockA::Port1", "ownerId": "e1", "childrenIds": [], "stereotypes": ["Port"], "attributes": { "type": "Signal", "direction": "in" }, "sourceXPath": "/xmi:XMI/uml:Model/BlockA/Port1" },
    { "id": "e5", "metaClass": "uml:Property", "name": "itsFrame", "qualifiedName": "系统::BlockA::itsFrame", "ownerId": "e1", "childrenIds": [], "stereotypes": ["Part"], "attributes": { "type": "Frame" }, "sourceXPath": "/xmi:XMI/uml:Model/BlockA/itsFrame" },
    { "id": "e6", "metaClass": "uml:Property", "name": "badPart", "qualifiedName": "系统::BlockA::badPart", "ownerId": "e1", "childrenIds": [], "stereotypes": ["Part"], "attributes": { "type": "Gear" }, "sourceXPath": "/xmi:XMI/uml:Model/BlockA/badPart" },
    { "id": "e7", "metaClass": "uml:Port", "name": "pFrame", "qualifiedName": "系统::BlockA::pFrame", "ownerId": "e5", "childrenIds": [], "stereotypes": [], "attributes": { "type": "Signal", "direction": "in" }, "sourceXPath": "/xmi:XMI/uml:Model/BlockA/itsFrame/pFrame" },
    { "id": "e8", "metaClass": "uml:Port", "name": "PortX", "qualifiedName": "系统::BlockA::PortX", "ownerId": "e5", "childrenIds": [], "stereotypes": [], "attributes": { "type": "Signal", "direction": "out" }, "sourceXPath": "/xmi:XMI/uml:Model/BlockA/itsFrame/PortX" },
    { "id": "e9", "metaClass": "uml:Class", "name": "SubBlock", "qualifiedName": "系统::BlockA::SubBlock", "ownerId": "e1", "childrenIds": [], "stereotypes": ["Block"], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/BlockA/SubBlock" },
    { "id": "e10", "metaClass": "uml:UseCase", "name": "ucMissionPrepare", "qualifiedName": "系统用例::ucMissionPrepare", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/ucMissionPrepare" },
    { "id": "e11", "metaClass": "uml:Actor", "name": "acCommandCenter", "qualifiedName": "系统用例::acCommandCenter", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/acCommandCenter" },
    { "id": "e12", "metaClass": "uml:UseCase", "name": "ucOrphan", "qualifiedName": "系统用例::ucOrphan", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/ucOrphan" },
    { "id": "e13", "metaClass": "uml:Actor", "name": "acOrphan", "qualifiedName": "系统用例::acOrphan", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/acOrphan" },
    { "id": "e14", "metaClass": "uml:OpaqueAction", "name": "loadLayoutRoute", "qualifiedName": "活动::loadLayoutRoute", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/loadLayoutRoute" },
    { "id": "e15", "metaClass": "uml:OpaqueAction", "name": "BadAction", "qualifiedName": "活动::BadAction", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/BadAction" },
    { "id": "e16", "metaClass": "uml:InitialNode", "name": "", "qualifiedName": "活动::init", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/init" },
    { "id": "e17", "metaClass": "uml:ActivityFinalNode", "name": "", "qualifiedName": "活动::final", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/final" },
    { "id": "e18", "metaClass": "uml:Lifeline", "name": "llBlockA", "qualifiedName": "顺序::llBlockA", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/llBlockA" },
    { "id": "e19", "metaClass": "uml:State", "name": "stReady", "qualifiedName": "状态机::stReady", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/stReady" },
    { "id": "e20", "metaClass": "uml:State", "name": "stGo", "qualifiedName": "状态机::stGo", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/stGo" },
    { "id": "e21", "metaClass": "uml:State", "name": "stLonely", "qualifiedName": "状态机::stLonely", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/stLonely" },
    { "id": "e22", "metaClass": "uml:Class", "name": "BlockD", "qualifiedName": "系统::BlockD", "ownerId": null, "childrenIds": [], "stereotypes": ["Block"], "attributes": { "documentation": "飞机平台模型（示例）" }, "sourceXPath": "/xmi:XMI/uml:Model/BlockD" },
    { "id": "e23", "metaClass": "uml:Interface", "name": "itsA_itsB", "qualifiedName": "系统::itsA_itsB", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/itsA_itsB" },
    { "id": "e24", "metaClass": "uml:Interface", "name": "iface", "qualifiedName": "系统::iface", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/iface" }
  ],
  "relations": [
    { "id": "r1", "metaClass": "uml:Dependency", "kind": "uml:Dependency", "name": "依赖关系", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/Dependency_1", "sourceId": "e1", "targetId": "ghost", "endIds": [], "direction": null },
    { "id": "r2", "metaClass": "uml:Association", "kind": "uml:Association", "name": "关联关系", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/Association_1", "sourceId": null, "targetId": null, "endIds": [], "direction": null },
    { "id": "r3", "metaClass": "uml:Association", "kind": "uml:Association", "name": "用例关联", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/Association_2", "sourceId": "e10", "targetId": "e11", "endIds": [], "direction": null },
    { "id": "r4", "metaClass": "uml:ControlFlow", "kind": "uml:ControlFlow", "name": "", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/ControlFlow_1", "sourceId": "e14", "targetId": "e17", "endIds": [], "direction": null },
    { "id": "r5", "metaClass": "uml:Message", "kind": "uml:Message", "name": "evStateChanged", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/Message_1", "sourceId": "e18", "targetId": "e18", "endIds": [], "direction": null },
    { "id": "r6", "metaClass": "uml:Message", "kind": "uml:Message", "name": "CheckStatus", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/Message_2", "sourceId": "e18", "targetId": "e18", "endIds": [], "direction": null },
    { "id": "r7", "metaClass": "uml:Transition", "kind": "uml:Transition", "name": "", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": { "trigger": "启动" }, "sourceXPath": "/xmi:XMI/uml:Model/Transition_1", "sourceId": "e19", "targetId": "e20", "endIds": [], "direction": null },
    { "id": "r8", "metaClass": "uml:Transition", "kind": "uml:Transition", "name": "", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": { "trigger": "完成" }, "sourceXPath": "/xmi:XMI/uml:Model/Transition_2", "sourceId": "e20", "targetId": "e19", "endIds": [], "direction": null },
    { "id": "r9", "metaClass": "uml:Connector", "kind": "uml:Connector", "name": "信号连接", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/Connector_1", "sourceId": "e7", "targetId": "e8", "endIds": [], "direction": null },
    { "id": "r10", "metaClass": "uml:Connector", "kind": "uml:Connector", "name": "直连部件", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/uml:Model/Connector_2", "sourceId": "e5", "targetId": "e9", "endIds": [], "direction": null },
    { "id": "r11", "metaClass": "uml:ControlFlow", "kind": "uml:ControlFlow", "name": "", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": { "trigger": "x > 0" }, "sourceXPath": "/xmi:XMI/uml:Model/ControlFlow_2", "sourceId": "e15", "targetId": "e17", "endIds": [], "direction": null }
  ],  "diagrams": [
    { "id": "d1", "metaClass": "uml:Diagram", "type": "Block Definition Diagram", "name": "架构模型", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/diagrams/d1", "imageRef": null, "viewIds": ["v1", "v2", "v3", "v4"] },
    { "id": "d2", "metaClass": "uml:Diagram", "type": "Internal Block Diagram", "name": "IBD_ucMissionPrepare", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/diagrams/d2", "imageRef": null, "viewIds": ["v5", "v6", "v7", "v8", "v9", "v10"] },
    { "id": "d3", "metaClass": "uml:Diagram", "type": "Use Case Diagram", "name": "系统用例图", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/diagrams/d3", "imageRef": null, "viewIds": ["v11", "v12", "v13", "v14", "v15"] },
    { "id": "d4", "metaClass": "uml:Diagram", "type": "Activity Diagram", "name": "任务准备活动", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/diagrams/d4", "imageRef": null, "viewIds": ["v16", "v17", "v18", "v19", "v20", "v21"] },
    { "id": "d5", "metaClass": "uml:Diagram", "type": "Sequence Diagram", "name": "任务准备顺序图", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/diagrams/d5", "imageRef": null, "viewIds": ["v22", "v23", "v24"] },
    { "id": "d6", "metaClass": "uml:Diagram", "type": "State Machine", "name": "飞行状态机", "ownerId": null, "childrenIds": [], "stereotypes": [], "attributes": {}, "sourceXPath": "/xmi:XMI/diagrams/d6", "imageRef": null, "viewIds": ["v25", "v26", "v27", "v28", "v29"] }
  ],
  "views": [
    { "id": "v1", "diagramId": "d1", "modelElementId": "e1", "kind": "mdElement", "bounds": "10,10,120,60", "waypoints": null, "label": "BlockA", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d1/views/v1" },
    { "id": "v2", "diagramId": "d1", "modelElementId": "e4", "kind": "mdElement", "bounds": "10,140,200,60", "waypoints": null, "label": "BlockC", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d1/views/v2" },
    { "id": "v3", "diagramId": "d1", "modelElementId": "e9", "kind": "mdElement", "bounds": "10,240,120,60", "waypoints": null, "label": "SubBlock", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d1/views/v3" },
    { "id": "v4", "diagramId": "d1", "modelElementId": "e22", "kind": "mdElement", "bounds": "10,340,120,60", "waypoints": null, "label": "BlockD", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d1/views/v4" },
    { "id": "v5", "diagramId": "d2", "modelElementId": "e5", "kind": "mdElement", "bounds": "20,20,140,80", "waypoints": null, "label": "itsFrame", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d2/views/v5" },
    { "id": "v6", "diagramId": "d2", "modelElementId": "e6", "kind": "mdElement", "bounds": "20,140,140,80", "waypoints": null, "label": "badPart", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d2/views/v6" },
    { "id": "v7", "diagramId": "d2", "modelElementId": "e7", "kind": "mdElement", "bounds": "20,260,140,80", "waypoints": null, "label": "pFrame", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d2/views/v7" },
    { "id": "v8", "diagramId": "d2", "modelElementId": "e8", "kind": "mdElement", "bounds": "20,380,140,80", "waypoints": null, "label": "PortX", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d2/views/v8" },
    { "id": "v9", "diagramId": "d2", "modelElementId": "r9", "kind": "mdEdge", "bounds": null, "waypoints": "20,80,20,260", "label": "信号连接", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d2/views/v9" },
    { "id": "v10", "diagramId": "d2", "modelElementId": "r10", "kind": "mdEdge", "bounds": null, "waypoints": "20,200,20,80", "label": "直连部件", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d2/views/v10" },
    { "id": "v11", "diagramId": "d3", "modelElementId": "e10", "kind": "mdElement", "bounds": "30,40,120,50", "waypoints": null, "label": "ucMissionPrepare", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d3/views/v11" },
    { "id": "v12", "diagramId": "d3", "modelElementId": "e11", "kind": "mdElement", "bounds": "30,120,120,50", "waypoints": null, "label": "acCommandCenter", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d3/views/v12" },
    { "id": "v13", "diagramId": "d3", "modelElementId": "e12", "kind": "mdElement", "bounds": "30,200,120,50", "waypoints": null, "label": "ucOrphan", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d3/views/v13" },
    { "id": "v14", "diagramId": "d3", "modelElementId": "e13", "kind": "mdElement", "bounds": "30,280,120,50", "waypoints": null, "label": "acOrphan", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d3/views/v14" },
    { "id": "v15", "diagramId": "d3", "modelElementId": "r3", "kind": "mdEdge", "bounds": null, "waypoints": "60,60,60,130", "label": "用例关联", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d3/views/v15" },
    { "id": "v16", "diagramId": "d4", "modelElementId": "e14", "kind": "mdElement", "bounds": "40,40,150,60", "waypoints": null, "label": "loadLayoutRoute", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d4/views/v16" },
    { "id": "v17", "diagramId": "d4", "modelElementId": "e15", "kind": "mdElement", "bounds": "40,140,150,60", "waypoints": null, "label": "BadAction", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d4/views/v17" },
    { "id": "v18", "diagramId": "d4", "modelElementId": "e16", "kind": "mdElement", "bounds": "80,20,30,30", "waypoints": null, "label": "", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d4/views/v18" },
    { "id": "v19", "diagramId": "d4", "modelElementId": "e17", "kind": "mdElement", "bounds": "80,300,30,30", "waypoints": null, "label": "", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d4/views/v19" },
    { "id": "v20", "diagramId": "d4", "modelElementId": "r4", "kind": "mdEdge", "bounds": null, "waypoints": "80,100,80,300", "label": "", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d4/views/v20" },
    { "id": "v21", "diagramId": "d4", "modelElementId": "r11", "kind": "mdEdge", "bounds": null, "waypoints": "80,200,80,300", "label": "", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d4/views/v21" },
    { "id": "v22", "diagramId": "d5", "modelElementId": "e18", "kind": "mdElement", "bounds": "60,30,100,400", "waypoints": null, "label": "llBlockA", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d5/views/v22" },
    { "id": "v23", "diagramId": "d5", "modelElementId": "r5", "kind": "mdEdge", "bounds": null, "waypoints": "60,120,60,120", "label": "evStateChanged", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d5/views/v23" },
    { "id": "v24", "diagramId": "d5", "modelElementId": "r6", "kind": "mdEdge", "bounds": null, "waypoints": "60,160,60,160", "label": "CheckStatus", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d5/views/v24" },
    { "id": "v25", "diagramId": "d6", "modelElementId": "e19", "kind": "mdElement", "bounds": "40,40,120,60", "waypoints": null, "label": "stReady", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d6/views/v25" },
    { "id": "v26", "diagramId": "d6", "modelElementId": "e20", "kind": "mdElement", "bounds": "40,140,120,60", "waypoints": null, "label": "stGo", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d6/views/v26" },
    { "id": "v27", "diagramId": "d6", "modelElementId": "e21", "kind": "mdElement", "bounds": "40,240,120,60", "waypoints": null, "label": "stLonely", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d6/views/v27" },
    { "id": "v28", "diagramId": "d6", "modelElementId": "r7", "kind": "mdEdge", "bounds": null, "waypoints": "80,100,80,140", "label": "启动", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d6/views/v28" },
    { "id": "v29", "diagramId": "d6", "modelElementId": "r8", "kind": "mdEdge", "bounds": null, "waypoints": "80,200,80,140", "label": "完成", "style": {}, "sourceXPath": "/xmi:XMI/diagrams/d6/views/v29" }
  ],
  "issues": [
    { "code": "DANGLING_REFERENCE", "severity": "error", "message": "Unresolved reference: ghost", "xpath": null, "elementId": "r1", "referenceId": "ghost" },
    { "code": "PARSE_WARNING", "severity": "warning", "message": "解析器自定义警告", "xpath": null, "elementId": "x", "referenceId": null }
  ],
  "statistics": { "elements": 24, "relations": 11, "diagrams": 6, "views": 29, "danglingReferences": 1, "duplicateIds": 1 }
}`);

    /* ---------- 状态 ---------- */
    let currentModel = null;
    const logs = [];
    const viewer = { zoom: 1, tx: 0, ty: 0, dragging: false, lastX: 0, lastY: 0 };
    const LEFT_COLLAPSED_W = 36;
    const RIGHT_COLLAPSED_W = 36;
    const LEFT_MIN = 170, LEFT_MAX = 480;
    const RIGHT_MIN = 240, RIGHT_MAX = 560;

    /* ---------- 小工具 ---------- */
    function kv(k, v) {
        return "<div class='kv'><span class='k'>" + esc(k) + "</span><span class='v'>" + esc(v) + "</span></div>";
    }

    function log(action, detail, ok) {
        logs.unshift({ time: fmtDate(Date.now()), action: action, detail: detail, ok: ok !== false });
        renderLog();
    }

    /* ---------- 左侧页签切换 ---------- */
    function switchLeftTab(tab) {
        document.querySelectorAll("#left-body .tabs span").forEach(s => s.classList.remove("active"));
        document.querySelector("#left-body .tabs span[data-ltab='" + tab + "']").classList.add("active");
        ["tree", "stats", "info"].forEach(t => {
            const el = $("#ltab-" + t);
            const tree = $("#tree-wrap");
            if (t === "tree") {
                tree.style.display = tab === "tree" ? "" : "none";
            } else if (el) {
                el.style.display = tab === t ? "" : "none";
            }
        });
        if (tab === "stats") renderModelStats();
        if (tab === "info") renderModelInfo();
    }

    /* ---------- 右侧页签切换 ---------- */
    function switchRightTab(tab) {
        document.querySelectorAll("#right-body .tabs span").forEach(s => s.classList.remove("active"));
        document.querySelector("#right-body .tabs span[data-rtab='" + tab + "']").classList.add("active");
        ["issues", "rules", "log"].forEach(t => {
            const el = $("#rtab-" + t);
            if (el) el.classList.toggle("active", tab === t);
        });
    }

    /* ---------- 渲染：模型树 / 信息 / 统计 ---------- */
    function renderTree() {
        const wrap = $("#tree-wrap");
        wrap.innerHTML = buildTree(currentModel);
        bindTreeToggle(wrap);
        bindTreeSelect(wrap, sel => selectTreeItem(sel.kind, sel.id));
    }

    function renderModelInfo() {
        const m = currentModel;
        const el = $("#ltab-info");
        if (!m) { el.innerHTML = "<p class='muted' style='padding:8px 10px;'>暂无数据</p>"; return; }
        const s = m.source || {};
        el.innerHTML = kv("模型ID", m.id || "-") +
            kv("文件", s.fileName || "-") +
            kv("编码", s.encoding || "-") +
            kv("XMI版本", s.xmiVersion || "-") +
            kv("产品版本", s.productVersion || "-") +
            kv("解析器问题", (m.issues || []).length + " 条");
    }

    function renderModelStats() {
        const m = currentModel;
        const el = $("#ltab-stats");
        if (!m) { el.innerHTML = "<p class='muted' style='padding:8px 10px;'>暂无数据</p>"; return; }
        const st = m.statistics || {};
        const num = (k, fallback) => (st[k] != null ? st[k] : fallback);
        el.innerHTML = kv("元素", num("elements", (m.elements || []).length)) +
            kv("关系", num("relations", (m.relations || []).length)) +
            kv("图", num("diagrams", (m.diagrams || []).length)) +
            kv("视图", num("views", (m.views || []).length)) +
            kv("悬空引用", num("danglingReferences", 0)) +
            kv("重复ID", num("duplicateIds", 0));
    }

    function renderStatusbar() {
        const m = currentModel;
        if (!m) {
            $("#sb-model").innerHTML = "模型：<b>-</b>";
            $("#sb-counts").innerHTML = "元素 <b>0</b> · 关系 <b>0</b> · 图 <b>0</b> · 视图 <b>0</b>";
            return;
        }
        $("#sb-model").innerHTML = "模型：<b>" + esc(m.id || "-") + "</b>";
        const st = m.statistics || {};
        $("#sb-counts").innerHTML = "元素 <b>" + (st.elements || (m.elements || []).length) + "</b>" +
            " · 关系 <b>" + (st.relations || (m.relations || []).length) + "</b>" +
            " · 图 <b>" + (st.diagrams || (m.diagrams || []).length) + "</b>" +
            " · 视图 <b>" + (st.views || (m.views || []).length) + "</b>";
    }

    /* ---------- 图查看器 ---------- */
    function showDiagram(diagram) {
        const title = $("#viewer-title");
        const empty = $("#viewer-empty");
        const stage = $("#viewer-stage");
        if (!diagram) {
            if (title) title.innerHTML = "图查看器 <span class='muted'>未找到关联的图</span>";
            if (empty) empty.style.display = "flex";
            if (stage) stage.style.display = "none";
            return;
        }
        const img = $("#viewer-img");
        const src = (diagram.imageRef && String(diagram.imageRef) !== "null" && String(diagram.imageRef).trim() !== "")
            ? diagram.imageRef
            : "img/diagram.png";
        img.src = src;
        img.onerror = () => { img.src = "img/diagram.png"; };
        if (title) {
            title.innerHTML = esc(diagram.name || diagram.id) +
                " <span class='muted'>" + esc(diagram.type || "Diagram") + " · " +
                (diagram.viewIds || []).length + " 个视图</span>";
        }
        if (empty) empty.style.display = "none";
        if (stage) stage.style.display = "flex";
        resetViewer();
    }

    function selectTreeItem(kind, id) {
        const model = currentModel;
        if (!model) return;
        const diagrams = model.diagrams || [];
        const views = model.views || [];
        let diagram = null;
        const findById = (list, key) => list.find(x => String(x[key]) === String(id));

        if (kind === "diagram") {
            diagram = findById(diagrams, "id");
        } else if (kind === "element") {
            const view = views.find(v => String(v.modelElementId) === String(id));
            if (view) diagram = diagrams.find(d => String(d.id) === String(view.diagramId));
        } else if (kind === "relation") {
            const rel = (model.relations || []).find(r => String(r.id) === String(id));
            const view = rel && (views.find(v => String(v.modelElementId) === String(rel.sourceId)) ||
                views.find(v => String(v.modelElementId) === String(rel.targetId)));
            if (view) diagram = diagrams.find(d => String(d.id) === String(view.diagramId));
        }
        showDiagram(diagram);
        Store.save(Store.KEY_SELECTION, { kind: kind, id: id });
        if (diagram) {
            log("查看图", "选中 " + kind + " " + id + " → 图 " + (diagram.name || diagram.id));
        }
    }

    /* 恢复上次选中的树节点并高亮、展开 */
    function restoreSelection() {
        const model = currentModel;
        const sel = Store.load(Store.KEY_SELECTION);
        if (!model || !sel || !sel.kind) return;
        const wrap = $("#tree-wrap");
        wrap.querySelectorAll("ul").forEach(ul => { ul.style.display = ""; });
        wrap.querySelectorAll(".toggle").forEach(t => { t.textContent = "▾"; });
        let found = false;
        wrap.querySelectorAll("li[data-kind]").forEach(li => {
            if (li.dataset.kind === sel.kind && li.dataset.id === String(sel.id)) {
                li.classList.add("select");
                found = true;
            }
        });
        selectTreeItem(sel.kind, sel.id);
        if (found) {
            const el = wrap.querySelector("li[data-kind].select");
            if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
        }
    }

    function applyViewer() {
        const stage = $("#viewer-stage");
        const img = $("#viewer-img");
        if (!stage || stage.style.display === "none") return;
        img.style.transform = "translate(" + viewer.tx + "px," + viewer.ty + "px) scale(" + viewer.zoom + ")";
        img.style.transformOrigin = "center center";
        $("#zoom-info").textContent = Math.round(viewer.zoom * 100) + "%";
    }

    function resetViewer() {
        viewer.zoom = 1; viewer.tx = 0; viewer.ty = 0;
        applyViewer();
    }

    function initViewer() {
        $("#btn-zoom-in").addEventListener("click", () => {
            viewer.zoom = Math.min(viewer.zoom * 1.25, 8);
            applyViewer();
        });
        $("#btn-zoom-out").addEventListener("click", () => {
            viewer.zoom = Math.max(viewer.zoom / 1.25, 0.1);
            applyViewer();
        });
        $("#btn-zoom-fit").addEventListener("click", () => { resetViewer(); });
        $("#btn-zoom-100").addEventListener("click", () => { resetViewer(); });

        const viewerEl = $("#viewer");
        const stage = $("#viewer-stage");
        viewerEl.addEventListener("wheel", e => {
            if (stage.style.display === "none") return;
            e.preventDefault();
            const factor = e.deltaY < 0 ? 1.1 : 0.9;
            viewer.zoom = Math.min(Math.max(viewer.zoom * factor, 0.1), 8);
            applyViewer();
        }, { passive: false });

        stage.addEventListener("mousedown", e => {
            if (e.button !== 0) return;
            viewer.dragging = true;
            viewer.lastX = e.clientX;
            viewer.lastY = e.clientY;
            stage.classList.add("dragging");
        });
        window.addEventListener("mousemove", e => {
            if (!viewer.dragging) return;
            viewer.tx += e.clientX - viewer.lastX;
            viewer.ty += e.clientY - viewer.lastY;
            viewer.lastX = e.clientX;
            viewer.lastY = e.clientY;
            applyViewer();
        });
        window.addEventListener("mouseup", () => {
            viewer.dragging = false;
            stage.classList.remove("dragging");
        });
        stage.addEventListener("dblclick", () => { resetViewer(); });
    }

    /* ---------- 布局：折叠 + 拖动分割条 ---------- */
    let leftCollapsed = false;
    let rightCollapsed = false;

    function applyLayout() {
        const l = Store.load(Store.KEY_LAYOUT) || {};
        const left = $("#left-panel");
        const right = $("#right-panel");
        if (l.leftWidth && left) left.style.width = l.leftWidth + "px";
        if (l.rightWidth && right) right.style.width = l.rightWidth + "px";
        if (l.leftCollapsed) setCollapsed("left", true, false);
        if (l.rightCollapsed) setCollapsed("right", true, false);
    }

    function saveLayout() {
        const l = Store.load(Store.KEY_LAYOUT) || {};
        const left = $("#left-panel");
        const right = $("#right-panel");
        if (left && !leftCollapsed) l.leftWidth = Math.round(left.getBoundingClientRect().width);
        if (right && !rightCollapsed) l.rightWidth = Math.round(right.getBoundingClientRect().width);
        l.leftCollapsed = leftCollapsed;
        l.rightCollapsed = rightCollapsed;
        Store.save(Store.KEY_LAYOUT, l);
    }

    function setCollapsed(side, collapsed, persist) {
        const panel = $("#" + (side === "left" ? "left" : "right") + "-panel");
        const body = $("#" + (side === "left" ? "left" : "right") + "-body");
        const btn = $("#btn-" + (side === "left" ? "left" : "right") + "-collapse");
        if (!panel) return;
        if (side === "left") leftCollapsed = collapsed;
        else rightCollapsed = collapsed;
        if (collapsed) {
            panel.style.width = (side === "left" ? LEFT_COLLAPSED_W : RIGHT_COLLAPSED_W) + "px";
            body.style.display = "none";
            btn.textContent = side === "left" ? "▶" : "◀";
        } else {
            panel.style.width = "";
            body.style.display = "";
            btn.textContent = side === "left" ? "◀" : "▶";
        }
        if (persist !== false) saveLayout();
    }

    function initSplitters() {
        const bindVertical = (splitter, target, min, max, isRight) => {
            splitter.addEventListener("mousedown", e => {
                if (e.button !== 0) return;
                e.preventDefault();
                const startX = e.clientX;
                const startW = target.getBoundingClientRect().width;
                splitter.classList.add("active");
                document.body.classList.add("resizing", "col");
                const move = ev => {
                    let w = isRight ? startW - (ev.clientX - startX) : startW + (ev.clientX - startX);
                    w = Math.min(Math.max(w, min), max);
                    target.style.width = w + "px";
                };
                const up = () => {
                    window.removeEventListener("mousemove", move);
                    window.removeEventListener("mouseup", up);
                    splitter.classList.remove("active");
                    document.body.classList.remove("resizing", "col");
                    saveLayout();
                };
                window.addEventListener("mousemove", move);
                window.addEventListener("mouseup", up);
            });
        };

        bindVertical($("#split-left"), $("#left-panel"), LEFT_MIN, LEFT_MAX, false);
        bindVertical($("#split-right"), $("#right-panel"), RIGHT_MIN, RIGHT_MAX, true);

        $("#btn-left-collapse").addEventListener("click", () => {
            setCollapsed("left", !leftCollapsed);
        });
        $("#btn-right-collapse").addEventListener("click", () => {
            setCollapsed("right", !rightCollapsed);
        });
    }

    /* ---------- 校验结果渲染 ---------- */
    function renderResult(result) {
        const sum = calcSummary(result);

        const issues = result.issues || [];
        $("#issues-body").innerHTML = issues.length
            ? issues.map(issueRow).join("")
            : "<tr class='empty-row'><td colspan='2'>✔ 未发现校验问题</td></tr>";

        // 底部状态栏汇总
        $("#sb-sev").innerHTML =
            "<span class='chip sev-blocker'>阻断 <b>" + sum.counts.BLOCKER + "</b></span>" +
            "<span class='chip sev-error'>错误 <b>" + sum.counts.ERROR + "</b></span>" +
            "<span class='chip sev-warning'>警告 <b>" + sum.counts.WARNING + "</b></span>" +
            "<span class='chip sev-info'>提示 <b>" + sum.counts.INFO + "</b></span>";
        $("#sb-time").textContent = "校验时间 " + fmtDate(Date.now());

        const ruleCodes = Array.from(new Set(issues
            .filter(i => i.source === "rule" && i.ruleCode)
            .map(i => i.ruleCode)));
        $("#rtab-rules").innerHTML =
            "<p class='muted' style='padding:8px 10px;'>规则执行 " + (result.rulesExecuted != null ? result.rulesExecuted : 0) + " 次，命中规则 " +
            (result.rulesMatched != null ? result.rulesMatched : 0) + " 条（按当前规则库 enabled 状态实时计算）</p>" +
            (ruleCodes.length
                ? "<table class='fixed'><thead><tr><th style='width:100px'>编号</th><th class='left'>规则名称</th></tr></thead><tbody>" +
                  ruleCodes.map(code => {
                      const it = issues.find(i => i.ruleCode === code);
                      return "<tr><td>" + esc(code) + "</td><td class='left'>" + esc((it && it.ruleName) || "-") + "</td></tr>";
                  }).join("") + "</tbody></table>"
                : "<p class='muted' style='padding:8px 10px;'>本次未命中规则库规则</p>");
        switchRightTab("issues");
    }

    function issueRow(issue) {
        const s = sevInfo(issue.severity);
        const code = issue.ruleCode || issue.code;
        const head = (code || issue.elementId)
            ? "<div class='issue-head'>" +
              (code ? "<code>" + esc(code) + "</code>" : "") +
              (issue.elementId ? "<span class='issue-el'>元素 " + esc(issue.elementId) + "</span>" : "") +
              "</div>"
            : "";
        const title = issue.xpath ? " title='" + esc(issue.xpath) + "'" : "";
        return "<tr" + title + ">" +
            "<td><span class='badge-sev " + s.cls + "'>" + esc(s.label) + "</span></td>" +
            "<td class='left'>" + head + "<div class='issue-msg'>" + esc(issue.message || "-") + "</div></td>" +
            "</tr>";
    }

    function renderLog() {
        $("#rtab-log").innerHTML = logs.length
            ? logs.map(l => "<div style='padding:4px 10px;border-bottom:1px solid #f0f2f5;'>" +
                "<span class='muted'>" + esc(l.time) + "</span> " +
                "<span style='color:" + (l.ok ? "#0a9d5c" : "#d93025") + ";'>" + (l.ok ? "✔" : "✘") + "</span> " +
                "<b>" + esc(l.action) + "</b> <span class='muted'>" + esc(l.detail || "") + "</span></div>")
                .join("")
            : "<p class='muted' style='padding:8px 10px;'>暂无日志</p>";
    }

    /* ---------- 动作：模型加载 / 校验 ---------- */
    function loadModelFromText(text) {
        const model = parseJsonSafe(text);
        currentModel = model;
        Store.save(Store.KEY_MODEL, model);
        renderModelInfo();
        renderModelStats();
        renderTree();
        renderStatusbar();
        log("解析模型", "id=" + (model.id || "") + "，元素 " + (model.elements || []).length +
            "，关系 " + (model.relations || []).length + "，图 " + (model.diagrams || []).length);
        showToast("模型已解析，可以开始校验", "success");
        return model;
    }

    async function runValidate(builtinOnly) {
        const raw = $("#json-input").value.trim();
        if (!raw) {
            showToast("请先粘贴解析 JSON 或点击「载入示例JSON」", "error");
            return;
        }
        let model = currentModel;
        const loadedText = model ? JSON.stringify(model, null, 2).trim() : null;
        if (!model || raw !== loadedText) {
            try { model = loadModelFromText(raw); } catch (e) { showToast(e.message, "error"); return; }
        }

        const url = builtinOnly ? "/api/models/validate/builtin" : "/api/models/validate";
        const btn = builtinOnly ? $("#modal-validate-builtin") : $("#modal-validate");
        btn.disabled = true;
        btn.textContent = "校验中…";
        try {
            const res = await Api.postJson(url, model);
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "校验失败");
            }
            Store.save(Store.KEY_RESULT, res.data);
            Store.save(Store.KEY_RESULT_TIME, fmtDate(Date.now()));
            renderResult(res.data);
            log("执行校验", url + "，发现 " + (res.data.issues || []).length + " 个问题，耗时 " + res.data.durationMs + " ms");
            showToast(res.message || "校验完成（按当前规则库实时计算，停用规则不会再执行）", "success");
            closeJsonModal();
        } catch (e) {
            log("执行校验", url + " 失败：" + e.message, false);
            showToast(e.message, "error");
        } finally {
            btn.disabled = false;
            btn.textContent = builtinOnly ? "🔧 仅结构校验" : "▶ 开始校验";
        }
    }

    /** 保存当前模型为校验任务（同步执行并落库） */
    async function saveAsTask() {
        if (!currentModel) {
            showToast("请先粘贴解析 JSON 再保存为任务", "error");
            return;
        }
        const name = (window.prompt("任务名称（留空自动生成）：", "") || "").trim();
        try {
            const res = await Api.postJson("/api/tasks", {
                taskName: name,
                modelName: (currentModel.source && currentModel.source.fileName) || null,
                modelJson: JSON.stringify(currentModel),
                builtinOnly: false
            });
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "保存失败");
            }
            log("保存任务", "任务 #" + res.data.id + "，问题 " + (res.data.issueCount || 0) + " 个");
            showToast("任务 #" + res.data.id + " 已创建并执行完成（" + (res.data.issueCount || 0) + " 个问题），可在「任务」页查看/导出报告", "success");
        } catch (e) {
            log("保存任务", "失败：" + e.message, false);
            showToast(e.message, "error");
        }
    }
    async function uploadModel(file) {
        if (!file) return;
        const btn = $("#btn-upload");
        const oldLabel = btn ? btn.textContent : "";
        if (btn) { btn.disabled = true; btn.textContent = "解析校验中…"; }
        try {
            // 走解析桥接：后端把 XML 转发给解析模块(3000)，返回 ParsedModel JSON
            const res = await Api.upload("/api/models/parse", file);
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "解析失败");
            }
            const model = res.data;
            const input = $("#json-input");
            if (input) input.value = JSON.stringify(model, null, 2);
            await runValidate(false); // 复用现有校验流程（内部会渲染模型树/结果）
            const last = Store.load(Store.KEY_RESULT);
            const count = (last && last.issues ? last.issues.length : 0);
            log("导入解析并校验", file.name + " → id=" + (model.id || "") + "，发现 " + count + " 个问题");
            showToast("解析并校验完成：发现 " + count + " 个问题（规则按当前启用状态实时计算）", "success");
        } catch (e) {
            log("导入解析并校验", file.name + " 失败：" + e.message, false);
            showToast(e.message, "error");
        } finally {
            if (btn) { btn.disabled = false; btn.textContent = oldLabel; }
        }
    }
    /* ---------- JSON 弹窗 ---------- */
    function openJsonModal() { $("#json-modal").classList.add("show"); }
    function closeJsonModal() { $("#json-modal").classList.remove("show"); }

    /* ---------- 初始化 ---------- */
    function init() {
        // 左侧页签
        document.querySelectorAll("#left-body .tabs span").forEach(s => {
            s.addEventListener("click", () => switchLeftTab(s.dataset.ltab));
        });
        // 右侧页签
        document.querySelectorAll("#right-body .tabs span").forEach(s => {
            s.addEventListener("click", () => switchRightTab(s.dataset.rtab));
        });

        // JSON 弹窗
        $("#btn-json").addEventListener("click", openJsonModal);
        $("#btn-save-task").addEventListener("click", saveAsTask);
        $("#btn-validate").addEventListener("click", () => {
            if (currentModel) {
                runValidate(false);
            } else {
                openJsonModal();
                $("#json-modal-hint").textContent = "请先粘贴解析 JSON";
            }
        });
        $("#modal-close").addEventListener("click", closeJsonModal);
        $("#json-modal").addEventListener("click", e => {
            if (e.target === $("#json-modal")) closeJsonModal();
        });
        $("#modal-sample").addEventListener("click", () => {
            const text = JSON.stringify(SAMPLE_MODEL, null, 2);
            $("#json-input").value = text;
            try { loadModelFromText(text); } catch (e) { showToast(e.message, "error"); }
        });
        $("#modal-validate").addEventListener("click", () => runValidate(false));
        $("#modal-validate-builtin").addEventListener("click", () => runValidate(true));

        // 工具栏
        $("#btn-upload").addEventListener("click", () => $("#file-input").click());
        $("#file-input").addEventListener("change", e => {
            uploadModel(e.target.files[0]);
            e.target.value = "";
        });

        // 模型树搜索
        $("#tree-search").addEventListener("input", e => {
            const q = e.target.value.trim().toLowerCase();
            const wrap = $("#tree-wrap");
            const lis = wrap.querySelectorAll("li");
            if (!q) {
                renderTree();
                return;
            }
            lis.forEach(li => {
                li.style.display = li.textContent.toLowerCase().includes(q) ? "" : "none";
            });
            wrap.querySelectorAll("ul").forEach(ul => { ul.style.display = ""; });
            wrap.querySelectorAll(".toggle").forEach(t => { t.textContent = "▾"; });
        });

        initViewer();
        applyLayout();
        initSplitters();

        // 恢复上次会话
        const cachedModel = Store.load(Store.KEY_MODEL);
        if (cachedModel) {
            currentModel = cachedModel;
            $("#json-input").value = JSON.stringify(cachedModel, null, 2);
            renderModelInfo();
            renderModelStats();
            renderTree();
            renderStatusbar();
            log("恢复会话", "载入上次解析的模型 " + (cachedModel.id || ""));
        }
        const cachedResult = Store.load(Store.KEY_RESULT);
        if (cachedResult) {
            renderResult(cachedResult);
            log("恢复会话", "载入上次校验结果，问题 " + (cachedResult.issues || []).length + " 个");
        }

        // 恢复上次查看的图
        restoreSelection();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
