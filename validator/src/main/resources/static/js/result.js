/* =========================================================
   校验结果页逻辑：展示上次校验结果（localStorage 缓存）
   ========================================================= */
(() => {
    "use strict";

    const $ = sel => document.querySelector(sel);

    function kv(k, v) {
        return "<div class='kv'><span class='k'>" + esc(k) + "</span><span class='v'>" + esc(v) + "</span></div>";
    }

    function renderEmpty() {
        $("#summary-cards").innerHTML =
            "<div class='card-stat' style='flex:2;'><div class='label'>暂无校验结果</div>" +
            "<div class='num info' style='font-size:16px;line-height:1.6;'>请先在「工作台」粘贴解析 JSON 并执行校验</div></div>";
        $("#issues-body").innerHTML = "";
        $("#issue-count").textContent = "";
    }

    function renderResult(result) {
        const sum = calcSummary(result);
        const card = (label, value, cls) =>
            "<div class='card-stat'><div class='label'>" + esc(label) + "</div><div class='num " + (cls || "") + "'>" + esc(value) + "</div></div>";

        $("#summary-cards").innerHTML =
            card("阻断", sum.counts.BLOCKER, "blocker") +
            card("错误", sum.counts.ERROR, "error") +
            card("警告", sum.counts.WARNING, "warning") +
            card("提示", sum.counts.INFO, "info") +
            (sum.passRate != null ? card("通过率", sum.passRate + "%", "ok") : card("通过率", "-", "")) +
            card("耗时", (result.durationMs != null ? result.durationMs : "-") + " ms", "");

        const issues = result.issues || [];
        $("#issue-count").textContent = "共 " + issues.length + " 条";
        $("#issues-body").innerHTML = issues.length
            ? issues.map(issueRow).join("")
            : "<tr class='empty-row'><td colspan='6'>✔ 未发现校验问题</td></tr>";

        const tbody = $("#issues-body");
        tbody.querySelectorAll("tr:not(.empty-row)").forEach(tr => {
            tr.addEventListener("click", () => {
                tbody.querySelectorAll("tr.selected").forEach(r => r.classList.remove("selected"));
                tr.classList.add("selected");
            });
        });

        const st = result.statistics || {};
        const time = Store.load(Store.KEY_RESULT_TIME);
        $("#task-info").innerHTML =
            kv("模型ID", result.modelId || "-") +
            kv("执行状态", "<span class='ok'>✔ 已完成</span>") +
            kv("发现问题", issues.length + " 个") +
            kv("规则执行", (result.rulesExecuted != null ? result.rulesExecuted : 0) + " 次") +
            kv("命中规则", (result.rulesMatched != null ? result.rulesMatched : 0) + " 条") +
            kv("耗时", (result.durationMs != null ? result.durationMs : "-") + " ms") +
            kv("结果生成", time || "-") +
            kv("悬空引用", st.danglingReferences != null ? st.danglingReferences : "-") +
            kv("重复ID", st.duplicateIds != null ? st.duplicateIds : "-");
        const hint = document.getElementById("result-hint");
        if (hint) {
            hint.textContent = "提示：本页展示的是最近一次校验结果；修改/停用规则后，请回到工作台重新点「开始校验」";
        }

        const m = Store.load(Store.KEY_MODEL) || {};
        const ms = m.statistics || {};
        const modelStatsEl = $("#model-stats");
        if (m.elements || m.relations || m.diagrams || m.views || st.elements) {
            modelStatsEl.innerHTML =
                kv("元素", ms.elements != null ? ms.elements : (m.elements || []).length) +
                kv("关系", ms.relations != null ? ms.relations : (m.relations || []).length) +
                kv("图", ms.diagrams != null ? ms.diagrams : (m.diagrams || []).length) +
                kv("视图", ms.views != null ? ms.views : (m.views || []).length);
        } else {
            modelStatsEl.innerHTML = "<p class='muted'>暂无模型统计</p>";
        }

        // 模型结构树
        const wrap = $("#tree-wrap");
        if (m.elements) {
            wrap.innerHTML = buildTree(m);
            bindTreeToggle(wrap);
        }
    }

    function issueRow(issue) {
        const s = sevInfo(issue.severity);
        const elId = issue.elementId ? "<code>" + esc(issue.elementId) + "</code>" : "-";
        const xp = issue.xpath ? "<code>" + esc(issue.xpath) + "</code>" : "-";
        return "<tr>" +
            "<td><span class='badge-sev " + s.cls + "'>" + esc(s.label) + "</span></td>" +
            "<td>" + esc(issue.ruleCode || issue.code || "-") + "</td>" +
            "<td class='left'>" + esc(issue.ruleName || "-") + "</td>" +
            "<td>" + elId + "</td>" +
            "<td class='left wrap'>" + esc(issue.message || "-") + "</td>" +
            "<td class='left wrap'>" + xp + "</td>" +
            "</tr>";
    }

    function exportJson() {
        const result = Store.load(Store.KEY_RESULT);
        if (!result) { showToast("没有可导出的校验结果", "error"); return; }
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "validation-result-" + (result.modelId || "model") + ".json";
        a.click();
        URL.revokeObjectURL(a.href);
        showToast("已导出校验结果 JSON", "success");
    }

    /** 把当前模型保存为任务并打开 HTML 报告 */
    async function saveTaskAndReport() {
        const model = Store.load(Store.KEY_MODEL);
        if (!model || !model.elements) {
            showToast("没有可用的模型数据，请先回工作台粘贴解析 JSON", "error");
            return;
        }
        const name = (window.prompt("任务名称（留空自动生成）：", "") || "").trim();
        try {
            const res = await Api.postJson("/api/tasks", {
                taskName: name,
                modelName: (model.source && model.source.fileName) || null,
                modelJson: JSON.stringify(model),
                builtinOnly: false
            });
            if (!res || res.success === false) {
                throw new Error((res && res.message) || "保存失败");
            }
            showToast("任务 #" + res.data.id + " 已创建，正在打开报告…", "success");
            window.open("/api/tasks/" + res.data.id + "/report?format=html", "_blank");
        } catch (e) {
            showToast(e.message, "error");
        }
    }
    function init() {
        $("#btn-back").addEventListener("click", () => { location.href = "index.html"; });
        $("#btn-revalidate").addEventListener("click", () => { location.href = "index.html"; });
        $("#btn-export").addEventListener("click", exportJson);
        $("#btn-task-report").addEventListener("click", saveTaskAndReport);

        // 模型树搜索
        $("#tree-search").addEventListener("input", e => {
            const q = e.target.value.trim().toLowerCase();
            const wrap = $("#tree-wrap");
            const lis = wrap.querySelectorAll("li");
            if (!q) {
                const m = Store.load(Store.KEY_MODEL);
                wrap.innerHTML = buildTree(m);
                bindTreeToggle(wrap);
                return;
            }
            lis.forEach(li => {
                li.style.display = li.textContent.toLowerCase().includes(q) ? "" : "none";
            });
            wrap.querySelectorAll("ul").forEach(ul => { ul.style.display = ""; });
            wrap.querySelectorAll(".toggle").forEach(t => { t.textContent = "▾"; });
        });

        const result = Store.load(Store.KEY_RESULT);
        if (result) {
            renderResult(result);
        } else {
            renderEmpty();
            $("#task-info").innerHTML = "<p class='muted'>暂无任务信息</p>";
            $("#model-stats").innerHTML = "<p class='muted'>暂无模型统计</p>";
            const m = Store.load(Store.KEY_MODEL);
            const wrap = $("#tree-wrap");
            wrap.innerHTML = buildTree(m);
            bindTreeToggle(wrap);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
