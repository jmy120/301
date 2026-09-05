/* =========================================================
   校验任务页逻辑：列表 / 筛选 / 分页 / 详情 / 重跑 / 删除 / 报告导出
   ========================================================= */
(() => {
    "use strict";

    const $ = sel => document.querySelector(sel);
    const state = { page: 0, size: 10, status: "", keyword: "", total: 0, pages: 0 };
    let currentDetail = null;

    const STATUS_META = {
        PENDING:   { label: "待执行", cls: "st-pending" },
        RUNNING:   { label: "执行中", cls: "st-running" },
        SUCCESS:   { label: "成功",   cls: "st-success" },
        FAILED:    { label: "失败",   cls: "st-failed" },
        CANCELLED: { label: "已取消", cls: "st-cancelled" }
    };

    function statusTag(s) {
        const m = STATUS_META[String(s || "").toUpperCase()] || { label: s || "-", cls: "st-pending" };
        return "<span class='status-tag " + m.cls + "'>" + esc(m.label) + "</span>";
    }

    function sevDots(sev) {
        if (!sev || typeof sev !== "object") return "-";
        const parts = ["BLOCKER", "ERROR", "WARNING", "INFO"];
        const html = parts.filter(k => (sev[k] || 0) > 0)
            .map(k => {
                const s = sevInfo(k);
                return "<span class='badge-sev " + s.cls + "' title='" + esc(s.label) + "'>" + esc(s.label) + " " + esc(sev[k]) + "</span>";
            });
        return html.length ? html.join(" ") : "<span class='muted'>0</span>";
    }

    function fmtMs(ms) {
        if (ms == null) return "-";
        return ms >= 1000 ? (ms / 1000).toFixed(1) + " s" : ms + " ms";
    }

    function rowHtml(t) {
        return "<tr data-id='" + esc(t.id) + "'>" +
            "<td>" + esc(t.id) + "</td>" +
            "<td class='left'><a href='javascript:void(0)' class='task-name' data-id='" + esc(t.id) + "'>" + esc(t.taskName || "-") + "</a>" +
            (t.builtinOnly ? " <span class='src-tag' title='仅内置结构校验'>结构</span>" : "") + "</td>" +
            "<td class='left'>" + esc(t.modelName || "-") + "</td>" +
            "<td>" + statusTag(t.status) + "</td>" +
            "<td><b>" + esc(t.issueCount != null ? t.issueCount : 0) + "</b></td>" +
            "<td class='left'>" + sevDots(t.severityCounts) + "</td>" +
            "<td>" + fmtMs(t.durationMs) + "</td>" +
            "<td class='left'>" + esc(t.createTime || "-") + "</td>" +
            "<td class='left'>" +
            "<button class='mini' data-act='detail' data-id='" + esc(t.id) + "' title='查看详情'>详情</button> " +
            "<button class='mini' data-act='rerun' data-id='" + esc(t.id) + "' title='用当前规则库重新校验'>重跑</button> " +
            "<button class='mini' data-act='report' data-id='" + esc(t.id) + "' title='打开HTML报告'>报告</button> " +
            "<button class='mini danger-text' data-act='delete' data-id='" + esc(t.id) + "' title='删除任务'>删除</button>" +
            "</td></tr>";
    }

    function renderRows(items) {
        const body = $("#task-body");
        body.innerHTML = items.length
            ? items.map(rowHtml).join("")
            : "<tr class='empty-row'><td colspan='9'>暂无任务，请先在工作台执行校验并「保存为任务」</td></tr>";
        body.querySelectorAll("button[data-act]").forEach(btn => {
            btn.addEventListener("click", e => {
                e.stopPropagation();
                const id = btn.dataset.id;
                if (btn.dataset.act === "detail") openDetail(id);
                else if (btn.dataset.act === "rerun") rerunTask(id);
                else if (btn.dataset.act === "report") openReport(id);
                else if (btn.dataset.act === "delete") deleteTask(id);
            });
        });
        body.querySelectorAll(".task-name").forEach(a => {
            a.addEventListener("click", () => openDetail(a.dataset.id));
        });
    }

    function updatePager() {
        state.pages = Math.max(1, Math.ceil(state.total / state.size));
        if (state.page >= state.pages) state.page = state.pages - 1;
        $("#page-info").textContent = "第 " + (state.page + 1) + " / " + state.pages + " 页 · 共 " + state.total + " 条";
        $("#page-prev").disabled = state.page <= 0;
        $("#page-next").disabled = state.page >= state.pages - 1;
        $("#task-count").textContent = "（" + state.total + "）";
    }

    async function loadTasks() {
        const params = new URLSearchParams();
        params.set("page", state.page);
        params.set("size", state.size);
        if (state.status) params.set("status", state.status);
        if (state.keyword) params.set("keyword", state.keyword);
        try {
            const res = await Api.get("/api/tasks?" + params.toString());
            if (!res || res.success === false) throw new Error((res && res.message) || "查询失败");
            const data = res.data || {};
            state.total = data.total || 0;
            renderRows(data.items || []);
            updatePager();
        } catch (e) {
            $("#task-body").innerHTML = "<tr class='empty-row'><td colspan='9'>" + esc(e.message) + "</td></tr>";
            showToast(e.message, "error");
        }
    }

    /* ---------- 详情 ---------- */
    function renderDetail(detail) {
        currentDetail = detail;
        $("#detail-title").textContent = detail.taskName ? "（" + detail.taskName + "）" : "";
        const result = detail.result || null;
        const issues = (result && result.issues) || [];
        const st = (result && result.statistics) || {};

        const card = (label, value, cls) =>
            "<div class='card-stat'><div class='label'>" + esc(label) + "</div><div class='num " + (cls || "") + "'>" + esc(value) + "</div></div>";

        let html = "";
        html += "<div class='cards' style='margin-bottom:10px;'>" +
            card("阻断", (detail.severityCounts && detail.severityCounts.BLOCKER) || 0, "blocker") +
            card("错误", (detail.severityCounts && detail.severityCounts.ERROR) || 0, "error") +
            card("警告", (detail.severityCounts && detail.severityCounts.WARNING) || 0, "warning") +
            card("提示", (detail.severityCounts && detail.severityCounts.INFO) || 0, "info") +
            card("问题总数", detail.issueCount || 0, "") +
            card("耗时", fmtMs(detail.durationMs), "") +
            "</div>";

        html += "<div class='kv-grid'>" +
            kvHtml("状态", statusTag(detail.status)) +
            kvHtml("任务名称", detail.taskName) +
            kvHtml("模型文件", detail.modelName || "-") +
            kvHtml("校验方式", detail.builtinOnly ? "仅内置结构" : "内置 + 规则库") +
            kvHtml("创建时间", detail.createTime || "-") +
            kvHtml("开始时间", detail.startTime || "-") +
            kvHtml("结束时间", detail.endTime || "-") +
            kvHtml("创建人", detail.creator || "admin") +
            (detail.errorMessage ? kvHtml("失败原因", "<span style='color:#d93025;'>" + esc(detail.errorMessage) + "</span>") : "") +
            "</div>";

        if (result) {
            html += "<h4 style='margin:14px 0 6px;'>问题列表（" + issues.length + "）</h4>";
            html += "<div class='table-wrap' style='max-height:300px;'>" +
                "<table class='fixed'><thead><tr>" +
                "<th style='width:64px'>级别</th><th style='width:90px'>编号</th>" +
                "<th style='width:80px'>元素</th><th class='left'>问题描述</th></tr></thead><tbody>";
            html += issues.length
                ? issues.map(issue => {
                    const s = sevInfo(issue.severity);
                    return "<tr><td><span class='badge-sev " + s.cls + "'>" + esc(s.label) + "</span></td>" +
                        "<td>" + esc(issue.ruleCode || issue.code || "-") + "</td>" +
                        "<td>" + esc(issue.elementId || "-") + "</td>" +
                        "<td class='left wrap'>" + esc(issue.message || "-") + "</td></tr>";
                  }).join("")
                : "<tr class='empty-row'><td colspan='4'>✔ 未发现校验问题</td></tr>";
            html += "</tbody></table></div>";

            html += "<h4 style='margin:14px 0 6px;'>模型统计</h4>";
            html += "<div class='kv-grid'>" +
                kvHtml("元素", st.elements != null ? st.elements : "-") +
                kvHtml("关系", st.relations != null ? st.relations : "-") +
                kvHtml("图", st.diagrams != null ? st.diagrams : "-") +
                kvHtml("视图", st.views != null ? st.views : "-") +
                kvHtml("悬空引用", st.danglingReferences != null ? st.danglingReferences : "-") +
                kvHtml("重复ID", st.duplicateIds != null ? st.duplicateIds : "-") +
                "</div>";
        } else {
            html += "<p class='muted' style='margin-top:10px;'>任务尚未产生校验结果（状态：" + esc(detail.status) + "）</p>";
        }
        $("#detail-body").innerHTML = html;
        $("#detail-hint").textContent = "重跑使用当前规则库，结论可能与原任务不同";
    }

    function kvHtml(k, v) {
        return "<div class='kv'><span class='k'>" + esc(k) + "</span><span class='v'>" + v + "</span></div>";
    }

    async function openDetail(id) {
        try {
            const res = await Api.get("/api/tasks/" + id);
            if (!res || res.success === false) throw new Error((res && res.message) || "查询失败");
            renderDetail(res.data);
            $("#detail-modal").classList.add("show");
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    async function rerunTask(id) {
        if (!confirm("确定重新执行任务 #" + id + " 吗？将复用模型快照并使用当前规则库。")) return;
        try {
            const res = await Api.postJson("/api/tasks/" + id + "/rerun", {});
            if (!res || res.success === false) throw new Error((res && res.message) || "重跑失败");
            showToast(res.message || "重跑完成", "success");
            if ($("#detail-modal").classList.contains("show") && currentDetail && String(currentDetail.id) === String(id)) {
                renderDetail(res.data);
            }
            loadTasks();
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    async function deleteTask(id) {
        if (!confirm("确定删除任务 #" + id + " 吗？删除后不可恢复。")) return;
        try {
            const res = await Api.del("/api/tasks/" + id);
            if (!res || res.success === false) throw new Error((res && res.message) || "删除失败");
            showToast(res.message || "已删除", "success");
            if ($("#detail-modal").classList.contains("show") && currentDetail && String(currentDetail.id) === String(id)) {
                $("#detail-modal").classList.remove("show");
            }
            loadTasks();
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    /* ---------- 报告 ---------- */
    function openReport(id) {
        window.open("/api/tasks/" + id + "/report?format=html", "_blank");
    }

    async function downloadReport(id, format) {
        try {
            const res = await fetch("/api/tasks/" + id + "/report?format=" + format);
            if (!res.ok) throw new Error("HTTP " + res.status);
            const blob = await res.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = "task-" + id + "-report." + (format === "docx" ? "docx" : "json");
            a.click();
            URL.revokeObjectURL(a.href);
            showToast("已导出 " + (format === "docx" ? "Word" : "JSON") + " 报告", "success");
        } catch (e) {
            showToast(e.message, "error");
        }
    }

    function init() {
        $("#btn-back").addEventListener("click", () => { location.href = "index.html"; });
        $("#btn-search").addEventListener("click", () => {
            state.page = 0;
            state.status = $("#filt-status").value;
            state.keyword = $("#keyword").value.trim();
            loadTasks();
        });
        $("#keyword").addEventListener("keydown", e => {
            if (e.key === "Enter") $("#btn-search").click();
        });
        $("#filt-status").addEventListener("change", () => $("#btn-search").click());
        $("#btn-reset").addEventListener("click", () => {
            $("#filt-status").value = "";
            $("#keyword").value = "";
            state.page = 0; state.status = ""; state.keyword = "";
            loadTasks();
        });
        $("#page-prev").addEventListener("click", () => {
            if (state.page > 0) { state.page--; loadTasks(); }
        });
        $("#page-next").addEventListener("click", () => {
            if (state.page < state.pages - 1) { state.page++; loadTasks(); }
        });

        // 详情弹窗
        $("#detail-close").addEventListener("click", () => $("#detail-modal").classList.remove("show"));
        $("#detail-modal").addEventListener("click", e => {
            if (e.target === $("#detail-modal")) $("#detail-modal").classList.remove("show");
        });
        $("#detail-rerun").addEventListener("click", () => {
            if (currentDetail) rerunTask(currentDetail.id);
        });
        $("#report-html").addEventListener("click", () => {
            if (currentDetail) openReport(currentDetail.id);
        });
        $("#report-word").addEventListener("click", () => {
            if (currentDetail) downloadReport(currentDetail.id, "docx");
        });
        $("#report-json").addEventListener("click", () => {
            if (currentDetail) downloadReport(currentDetail.id, "json");
        });

        loadTasks();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
