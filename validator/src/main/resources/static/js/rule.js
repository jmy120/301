/* =========================================================
   规则配置页逻辑：对接 /api/rules 全套 CRUD
   ========================================================= */
(() => {
    "use strict";

    const $ = sel => document.querySelector(sel);

    const state = {
        page: 0,
        size: 20,
        totalPages: 1,
        totalElements: 0,
        keyword: "",
        targetType: "",
        severity: "",
        selected: null,
        rules: []
    };

    function kv(k, v) {
        return "<div class='kv'><span class='k'>" + esc(k) + "</span><span class='v'>" + esc(v) + "</span></div>";
    }

    async function loadTargetTypes() {
        try {
            const res = await Api.get("/api/rules/target-types");
            const list = (res && res.data) || [];
            const ul = $("#category-list");
            ul.innerHTML = '<li data-target="" class="active">全部</li>' +
                list.map(t => "<li data-target='" + esc(t) + "'>" + esc(t) + "</li>").join("");
            ul.querySelectorAll("li").forEach(li => {
                li.addEventListener("click", () => {
                    ul.querySelectorAll("li").forEach(x => x.classList.remove("active"));
                    li.classList.add("active");
                    state.targetType = li.dataset.target || "";
                    state.page = 0;
                    loadRules();
                });
            });
            // 表单“检测对象”下拉建议
            $("#target-options").innerHTML = list
                .map(t => "<option value='" + esc(t) + "'>")
                .join("");
        } catch (e) {
            $("#category-list").innerHTML = '<li class="muted" style="padding-left:8px;">加载失败：' + esc(e.message) + "</li>";
        }
    }

    async function loadSeverities() {
        try {
            const res = await Api.get("/api/rules/severities");
            const list = (res && res.data) || [];
            $("#f-severity").innerHTML = list
                .map(s => "<option value='" + esc(s.code) + "'>" + esc(s.label) + "</option>")
                .join("");
            $("#filt-severity").innerHTML = "<option value=''>全部等级</option>" +
                list.map(s => "<option value='" + esc(s.code) + "'>" + esc(s.label) + "</option>").join("");
        } catch (e) {
            $("#f-severity").innerHTML = "<option value='ERROR'>错误</option><option value='WARNING'>警告</option><option value='INFO'>提示</option><option value='BLOCKER'>阻断</option>";
            $("#filt-severity").innerHTML = "<option value=''>全部等级</option><option value='ERROR'>错误</option><option value='WARNING'>警告</option><option value='INFO'>提示</option><option value='BLOCKER'>阻断</option>";
        }
    }

    async function loadRules() {
        const params = new URLSearchParams();
        if (state.keyword) params.set("keyword", state.keyword);
        if (state.targetType) params.set("targetType", state.targetType);
        if (state.severity) params.set("severity", state.severity);
        params.set("page", state.page);
        params.set("size", state.size);

        const body = $("#rule-body");
        body.innerHTML = "<tr class='empty-row'><td colspan='5'>加载中…</td></tr>";
        try {
            const res = await Api.get("/api/rules?" + params.toString());
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "查询失败");
            }
            const page = res.data || {};
            state.rules = page.content || [];
            state.totalPages = page.totalPages || 1;
            state.totalElements = page.totalElements || 0;

            $("#rule-count").textContent = "共 " + state.totalElements + " 条";
            $("#page-info").textContent = (state.page + 1) + " / " + state.totalPages;
            $("#page-prev").disabled = state.page <= 0;
            $("#page-next").disabled = state.page >= state.totalPages - 1;

            if (!state.rules.length) {
                body.innerHTML = "<tr class='empty-row'><td colspan='5'>未找到规则，可点击「初始化示例规则」</td></tr>";
                return;
            }
            body.innerHTML = state.rules.map(ruleRow).join("");
            body.querySelectorAll(".rule-item-row").forEach(tr => {
                tr.addEventListener("click", () => selectRule(parseInt(tr.dataset.id, 10)));
            });
            if (state.selected) {
                const still = state.rules.find(r => r.id === state.selected.id);
                if (still) {
                    state.selected = still;
                    renderDetail(still);
                }
                body.querySelectorAll(".rule-item-row").forEach(tr => {
                    tr.classList.toggle("selected", parseInt(tr.dataset.id, 10) === state.selected.id);
                });
            }
        } catch (e) {
            body.innerHTML = "<tr class='empty-row'><td colspan='5'>加载失败：" + esc(e.message) + "</td></tr>";
            showToast(e.message, "error");
        }
    }

    function ruleRow(r) {
        const s = sevInfo(r.severity);
        return "<tr class='rule-item-row' data-id='" + r.id + "'>" +
            "<td>" + esc(r.ruleCode || "-") + "</td>" +
            "<td class='left'>" + esc(r.ruleName || "-") + "</td>" +
            "<td>" + esc(r.targetType || "-") + "</td>" +
            "<td><span class='badge-sev " + s.cls + "'>" + esc(s.label) + "</span></td>" +
            "<td>" + (r.enabled
                ? "<span class='enabled-tag'>已启用</span>"
                : "<span class='disabled-tag'>已停用</span>") + "</td>" +
            "</tr>";
    }

    function selectRule(id) {
        const rule = state.rules.find(r => r.id === id);
        if (!rule) return;
        state.selected = rule;
        renderDetail(rule);
        document.querySelectorAll(".rule-item-row").forEach(tr => {
            tr.classList.toggle("selected", parseInt(tr.dataset.id, 10) === id);
        });
    }

    function renderDetail(rule) {
        const s = sevInfo(rule.severity);
        $("#rule-detail-body").innerHTML =
            kv("规则编号", rule.ruleCode || "-") +
            kv("规则名称", rule.ruleName || "-") +
            kv("检测对象", rule.targetType || "-") +
            kv("适用范围", rule.scope || "-") +
            kv("严重程度", s.label) +
            kv("状态", rule.enabled ? "已启用" : "已停用") +
            kv("规则版本", rule.ruleVersion || "-") +
            "<div style='margin-top:8px;'><b>触发条件</b></div>" +
            "<div class='script-box'>" + esc(rule.condition || "-") + "</div>" +
            "<div style='margin-top:8px;'><b>结果信息</b></div>" +
            "<div class='script-box'>" + esc(rule.message || "-") + "</div>" +
            "<div style='margin-top:8px;'><b>修复建议</b></div>" +
            "<div class='script-box'>" + esc(rule.fixSuggestion || "-") + "</div>" +
            "<div style='margin-top:8px;'><b>求解脚本</b></div>" +
            "<div class='script-box'>" + esc(rule.script || "-") + "</div>";
    }

    /* ---------- 弹窗 ---------- */
    function openModal(rule) {
        $("#rule-modal-title").textContent = rule ? "修改规则 " + (rule.ruleCode || "") : "新增规则";
        $("#f-code").value = rule ? (rule.ruleCode || "") : "";
        $("#f-name").value = rule ? (rule.ruleName || "") : "";
        $("#f-target").value = rule ? (rule.targetType || "") : "";
        $("#f-scope").value = rule ? (rule.scope || "") : "";
        $("#f-condition").value = rule ? (rule.condition || "") : "";
        $("#f-message").value = rule ? (rule.message || "") : "";
        $("#f-fix").value = rule ? (rule.fixSuggestion || "") : "";
        $("#f-version").value = rule ? (rule.ruleVersion || "") : "";
        $("#f-script").value = rule ? (rule.script || "") : "";
        $("#f-enabled").checked = rule ? rule.enabled : true;
        if (rule && rule.severity) $("#f-severity").value = rule.severity;
        $("#rule-modal").classList.add("show");
    }

    function closeModal() {
        $("#rule-modal").classList.remove("show");
    }

    async function saveRule() {
        const id = state.selected ? state.selected.id : null;
        const payload = {
            ruleCode: $("#f-code").value.trim(),
            ruleName: $("#f-name").value.trim(),
            targetType: $("#f-target").value.trim(),
            scope: $("#f-scope").value.trim(),
            severity: $("#f-severity").value,
            condition: $("#f-condition").value.trim(),
            message: $("#f-message").value.trim(),
            fixSuggestion: $("#f-fix").value.trim(),
            ruleVersion: $("#f-version").value.trim(),
            script: $("#f-script").value,
            enabled: $("#f-enabled").checked
        };
        if (!payload.ruleName) { showToast("规则名称不能为空", "error"); return; }
        if (!payload.targetType) { showToast("检测对象不能为空", "error"); return; }
        if (!payload.script || !payload.script.trim()) { showToast("求解脚本不能为空", "error"); return; }
        try {
            const res = id
                ? await Api.putJson("/api/rules/" + id, payload)
                : await Api.postJson("/api/rules", payload);
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "保存失败");
            }
            showToast(res.message || "保存成功", "success");
            closeModal();
            state.selected = res.data;
            state.page = 0;
            await loadRules();
            loadTargetTypes();
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    async function deleteSelected() {
        if (!state.selected) { showToast("请先选择一条规则", "error"); return; }
        if (!confirm("确定删除规则 " + state.selected.ruleCode + " ？")) return;
        try {
            const res = await Api.del("/api/rules/" + state.selected.id);
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "删除失败");
            }
            showToast(res.message || "删除成功", "success");
            state.selected = null;
            $("#rule-detail-body").innerHTML = "<p class='muted'>点击左侧列表中的规则查看详情</p>";
            await loadRules();
            loadTargetTypes();
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    async function toggleSelected() {
        if (!state.selected) { showToast("请先选择一条规则", "error"); return; }
        try {
            const res = await Api.putJson("/api/rules/" + state.selected.id + "/status", {
                enabled: !state.selected.enabled
            });
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "更新失败");
            }
            const tip = state.selected.enabled ? "已启用，下次校验会执行该规则" : "已停用，下次校验不再执行该规则";
            showToast((res.message || "状态已更新") + "；" + tip, "success");
            state.selected = res.data;
            await loadRules();
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    async function initRules() {
        try {
            const res = await Api.postJson("/api/rules/init", {});
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "初始化失败");
            }
            showToast("初始化完成，新增 " + (res.data || 0) + " 条示例规则", "success");
            state.page = 0;
            await loadRules();
            loadTargetTypes();
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    /* ---------- 初始化 ---------- */
    function init() {
        $("#btn-add").addEventListener("click", () => openModal(null));
        $("#btn-edit").addEventListener("click", () => {
            if (!state.selected) { showToast("请先选择一条规则", "error"); return; }
            openModal(state.selected);
        });
        $("#btn-delete").addEventListener("click", deleteSelected);
        $("#btn-toggle").addEventListener("click", toggleSelected);
        $("#btn-init").addEventListener("click", initRules);
        $("#btn-back").addEventListener("click", () => { location.href = "index.html"; });
        $("#btn-modal-cancel").addEventListener("click", closeModal);
        $("#btn-modal-save").addEventListener("click", saveRule);
        $("#rule-modal").addEventListener("click", e => {
            if (e.target === $("#rule-modal")) closeModal();
        });
        $("#page-prev").addEventListener("click", () => {
            if (state.page > 0) { state.page--; loadRules(); }
        });
        $("#page-next").addEventListener("click", () => {
            if (state.page < state.totalPages - 1) { state.page++; loadRules(); }
        });
        let searchTimer = null;
        $("#filt-severity").addEventListener("change", e => {
            state.severity = e.target.value || "";
            state.page = 0;
            loadRules();
        });
        $("#rule-search").addEventListener("input", e => {
            clearTimeout(searchTimer);
            searchTimer = setTimeout(() => {
                state.keyword = e.target.value.trim();
                state.page = 0;
                loadRules();
            }, 300);
        });

        loadSeverities();
        loadTargetTypes();
        loadRules();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();