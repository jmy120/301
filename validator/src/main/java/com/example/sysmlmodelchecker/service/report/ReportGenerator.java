package com.example.sysmlmodelchecker.service.report;

import com.example.sysmlmodelchecker.model.ValidationTask;
import com.example.sysmlmodelchecker.model.dto.ModelIssue;
import com.example.sysmlmodelchecker.model.dto.ModelStatistics;
import com.example.sysmlmodelchecker.model.dto.ValidationResult;
import tools.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * 报告生成器：把校验任务渲染为 HTML / JSON / CSV / Word(.docx) 格式。
 * 一期零新增依赖：HTML 报告可直接在浏览器打印为 PDF；Word 报告用最小化 OOXML 打包。
 */
@Service
public class ReportGenerator {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String[] SEV_ORDER = {"BLOCKER", "ERROR", "WARNING", "INFO"};
    private static final String DOC_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";

    private final ObjectMapper objectMapper;

    public ReportGenerator(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    /** 报告 JSON：任务信息 + 校验结果 + 生成时间 */
    public Map<String, Object> renderJson(ValidationTask task) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("task", taskSummary(task));
        m.put("result", parseResult(task));
        m.put("ruleSnapshot", parseRuleSnapshot(task));
        m.put("generatedAt", LocalDateTime.now().format(FMT));
        return m;
    }

    /** 问题清单 CSV（开头带 UTF-8 BOM，Excel 可直接打开不乱码） */
    public String renderCsv(ValidationTask task) {
        StringBuilder sb = new StringBuilder();
        sb.append("\uFEFFseverity,code,ruleName,source,elementId,referenceId,xpath,message\r\n");
        ValidationResult result = parseResult(task);
        if (result != null) {
            for (ModelIssue issue : result.getIssues()) {
                sb.append(csv(issue.getSeverity())).append(',')
                        .append(csv(issue.getRuleCode() != null ? issue.getRuleCode() : issue.getCode())).append(',')
                        .append(csv(issue.getRuleName())).append(',')
                        .append(csv(issue.getSource())).append(',')
                        .append(csv(issue.getElementId())).append(',')
                        .append(csv(issue.getReferenceId())).append(',')
                        .append(csv(issue.getXpath())).append(',')
                        .append(csv(issue.getMessage())).append("\r\n");
            }
        }
        return sb.toString();
    }

    /** 自包含 HTML 报告（内联样式，浏览器可打印为 PDF） */
    public String renderHtml(ValidationTask task) {
        ValidationResult result = parseResult(task);
        Map<String, Long> counts = result != null ? result.getSeverityCounts() : Map.of();
        StringBuilder sb = new StringBuilder();
        sb.append("<!DOCTYPE html>\n<html lang=\"zh-CN\">\n<head>\n<meta charset=\"UTF-8\">\n");
        sb.append("<title>SysML模型解析与校验报告 - ").append(h(task.getTaskName())).append("</title>\n");
        sb.append("<style>\n");
        sb.append("body{font-family:'Microsoft YaHei',sans-serif;color:#222;margin:24px 36px;font-size:13px;}\n");
        sb.append("h1{font-size:20px;border-bottom:2px solid #1f5fbf;padding-bottom:8px;}\n");
        sb.append("h2{font-size:15px;color:#1f5fbf;margin-top:24px;border-left:4px solid #1f5fbf;padding-left:8px;}\n");
        sb.append("table{width:100%;border-collapse:collapse;margin-top:8px;font-size:12px;}\n");
        sb.append("th,td{border:1px solid #d9dce1;padding:5px 6px;text-align:left;word-break:break-all;}\n");
        sb.append("th{background:#f4f6f9;color:#444;}\n");
        sb.append(".meta{color:#666;font-size:12px;margin-top:6px;}\n");
        sb.append(".sev{display:inline-block;padding:1px 8px;border-radius:2px;margin-right:6px;}\n");
        sb.append(".sev-BLOCKER{background:#fdeaea;color:#c62828;}\n.sev-ERROR{background:#fef3f2;color:#d93025;}\n");
        sb.append(".sev-WARNING{background:#fff7e6;color:#b26a00;}\n.sev-INFO{background:#e8f0fe;color:#1f5fbf;}\n");
        sb.append(".cards{display:flex;gap:10px;flex-wrap:wrap;margin:8px 0;}\n");
        sb.append(".card{border:1px solid #e2e4e8;border-radius:4px;padding:8px 16px;min-width:110px;}\n");
        sb.append(".card .n{font-size:20px;font-weight:700;}\n.card .l{color:#666;font-size:11px;}\n");
        sb.append(".no-print{position:fixed;top:12px;right:16px;padding:6px 14px;background:#1f5fbf;color:#fff;border:none;border-radius:3px;cursor:pointer;}\n");
        sb.append("@media print{.no-print{display:none;}thead{display:table-header-group;}body{margin:10mm;}}\n");
        sb.append("</style>\n</head>\n<body>\n");
        sb.append("<button class=\"no-print\" onclick=\"window.print()\">🖨 打印 / 另存为PDF</button>\n");
        sb.append("<h1>SysML 模型解析与校验报告</h1>\n");
        sb.append("<div class=\"meta\">任务ID：").append(h(String.valueOf(task.getId()))).append("　任务名称：")
                .append(h(task.getTaskName())).append("　模型文件：").append(h(nullTo(task.getModelName(), "-")))
                .append("　校验时间：").append(h(nullTo(task.getEndTime() != null ? task.getEndTime().format(FMT) : null, "-")))
                .append("　校验方式：").append(task.isBuiltinOnly() ? "仅内置结构校验" : "内置结构校验 + 规则校验")
                .append("</div>\n");

        sb.append("<h2>一、结论摘要</h2>\n");
        sb.append("<div class=\"cards\">\n");
        for (String sev : SEV_ORDER) {
            long n = counts.getOrDefault(sev, 0L);
            sb.append("<div class=\"card\"><div class=\"n ").append(sevClass(sev)).append("\">").append(n)
                    .append("</div><div class=\"l\">").append(sevLabel(sev)).append("</div></div>\n");
        }
        sb.append("</div>\n");
        sb.append("<p>").append(h(conclusion(task, result))).append("</p>\n");

        sb.append("<h2>二、模型统计</h2>\n<table>\n<tr><th>元素</th><th>关系</th><th>图</th><th>视图</th><th>悬空引用</th><th>重复ID</th></tr>\n<tr>");
        ModelStatistics st = result != null ? result.getStatistics() : null;
        if (st != null) {
            sb.append("<td>").append(st.getElements()).append("</td><td>").append(st.getRelations())
                    .append("</td><td>").append(st.getDiagrams()).append("</td><td>").append(st.getViews())
                    .append("</td><td>").append(st.getDanglingReferences()).append("</td><td>").append(st.getDuplicateIds()).append("</td>");
        } else {
            sb.append("<td colspan=\"6\">-</td>");
        }
        sb.append("</tr>\n</table>\n");

        sb.append("<h2>三、问题清单</h2>\n");
        if (result == null || result.getIssues().isEmpty()) {
            sb.append("<p>未发现校验问题。</p>\n");
        } else {
            for (String sev : SEV_ORDER) {
                List<ModelIssue> group = new ArrayList<>();
                for (ModelIssue issue : result.getIssues()) {
                    if (sev.equalsIgnoreCase(String.valueOf(issue.getSeverity()))) {
                        group.add(issue);
                    }
                }
                if (group.isEmpty()) {
                    continue;
                }
                sb.append("<h3>").append(sevLabel(sev)).append("（").append(group.size()).append("）</h3>\n");
                sb.append("<table>\n<thead><tr><th>编号</th><th>规则名称</th><th>来源</th><th>元素</th><th>问题描述</th><th>定位(XPath)</th></tr></thead>\n<tbody>\n");
                for (ModelIssue issue : group) {
                    sb.append("<tr><td>").append(h(issue.getRuleCode() != null ? issue.getRuleCode() : issue.getCode()))
                            .append("</td><td>").append(h(issue.getRuleName()))
                            .append("</td><td>").append(h(sourceLabel(issue.getSource())))
                            .append("</td><td>").append(h(issue.getElementId()))
                            .append("</td><td>").append(h(issue.getMessage()))
                            .append("</td><td>").append(h(issue.getXpath()))
                            .append("</td></tr>\n");
                }
                sb.append("</tbody>\n</table>\n");
            }
        }

        sb.append("<h2>四、规则执行情况</h2>\n");
        if (result != null) {
            sb.append("<p>规则脚本执行 ").append(result.getRulesExecuted()).append(" 次，命中规则 ")
                    .append(result.getRulesMatched()).append(" 条；校验耗时 ")
                    .append(result.getDurationMs()).append(" ms。</p>\n");
        } else {
            sb.append("<p>-</p>\n");
        }
        List<Map<String, Object>> rules = parseRuleSnapshot(task);
        if (!rules.isEmpty()) {
            sb.append("<table>\n<thead><tr><th>规则编号</th><th>规则名称</th><th>严重度</th><th>执行时状态</th></tr></thead>\n<tbody>\n");
            for (Map<String, Object> r : rules) {
                sb.append("<tr><td>").append(h(String.valueOf(r.get("ruleCode"))))
                        .append("</td><td>").append(h(String.valueOf(r.get("ruleName"))))
                        .append("</td><td>").append(h(String.valueOf(r.get("severity"))))
                        .append("</td><td>").append(Boolean.TRUE.equals(r.get("enabled")) ? "启用" : "停用")
                        .append("</td></tr>\n");
            }
            sb.append("</tbody>\n</table>\n");
        }

        sb.append("<h2>五、附录</h2>\n<div class=\"meta\">模型ID：").append(h(result != null ? result.getModelId() : null))
                .append("　报告生成时间：").append(LocalDateTime.now().format(FMT))
                .append("　SysML模型解析与校验系统 v1.0</div>\n");
        sb.append("</body>\n</html>\n");
        return sb.toString();
    }

    // ================= helpers =================

    /** Word 报告（.docx）：最小化 OOXML，纯 JDK 打包，无第三方依赖 */
    public byte[] renderDocx(ValidationTask task) {
        ValidationResult result = parseResult(task);
        Map<String, Long> counts = result != null ? result.getSeverityCounts() : Map.of();

        StringBuilder b = new StringBuilder();
        b.append(para("SysML 模型解析与校验报告", 32, true, "center"));
        b.append(para("任务ID：" + nvl(task.getId()) + "　　任务名称：" + nvl(task.getTaskName()), 20, false, "center"));
        b.append(para("生成时间：" + LocalDateTime.now().format(FMT) + "　　SysML模型解析与校验系统", 18, false, "center"));

        // 一、校验结论
        b.append(heading("一、校验结论"));
        b.append(para("阻断 " + counts.getOrDefault("BLOCKER", 0L) + "，错误 " + counts.getOrDefault("ERROR", 0L)
                + "，警告 " + counts.getOrDefault("WARNING", 0L) + "，提示 " + counts.getOrDefault("INFO", 0L), 21, false, null));
        b.append(para("结论：" + conclusion(task, result), 21, true, null));

        // 二、基本信息
        b.append(heading("二、基本信息"));
        b.append(table(new String[]{"项目", "内容"}, List.of(
                new String[]{"任务名称", nvl(task.getTaskName())},
                new String[]{"模型文件", nvl(task.getModelName())},
                new String[]{"校验方式", task.isBuiltinOnly() ? "仅内置结构校验" : "内置结构校验 + 规则校验"},
                new String[]{"执行状态", statusLabel(task)},
                new String[]{"发现问题", String.valueOf(task.getIssueCount())},
                new String[]{"校验耗时", task.getDurationMs() + " ms"},
                new String[]{"创建时间", nvl(task.getCreateTime() != null ? task.getCreateTime().format(FMT) : null)},
                new String[]{"失败原因", nvl(task.getErrorMessage())})));

        // 三、模型统计
        b.append(heading("三、模型统计"));
        ModelStatistics st = result != null ? result.getStatistics() : null;
        if (st != null) {
            List<String[]> statRows = new ArrayList<>();
            statRows.add(new String[]{String.valueOf(st.getElements()), String.valueOf(st.getRelations()),
                    String.valueOf(st.getDiagrams()), String.valueOf(st.getViews()),
                    String.valueOf(st.getDanglingReferences()), String.valueOf(st.getDuplicateIds())});
            b.append(table(new String[]{"元素", "关系", "图", "视图", "悬空引用", "重复ID"}, statRows));
        } else {
            b.append(para("暂无模型统计数据。", 21, false, null));
        }

        // 四、问题清单
        b.append(heading("四、问题清单"));
        if (result == null || result.getIssues().isEmpty()) {
            b.append(para("未发现校验问题。", 21, false, null));
        } else {
            for (String sev : SEV_ORDER) {
                List<String[]> rows = new ArrayList<>();
                for (ModelIssue issue : result.getIssues()) {
                    if (sev.equalsIgnoreCase(String.valueOf(issue.getSeverity()))) {
                        rows.add(new String[]{
                                nvl(issue.getRuleCode() != null ? issue.getRuleCode() : issue.getCode()),
                                nvl(issue.getRuleName()), sourceLabel(issue.getSource()),
                                nvl(issue.getElementId()), nvl(issue.getMessage()), nvl(issue.getXpath())});
                    }
                }
                if (rows.isEmpty()) {
                    continue;
                }
                b.append(para(sevLabel(sev) + "（" + rows.size() + "）", 24, true, null));
                b.append(table(new String[]{"编号", "规则名称", "来源", "元素", "问题描述", "定位(XPath)"}, rows));
            }
        }

        // 五、规则执行情况
        b.append(heading("五、规则执行情况"));
        if (result != null) {
            b.append(para("规则脚本执行 " + result.getRulesExecuted() + " 次，命中规则 " + result.getRulesMatched()
                    + " 条；校验耗时 " + result.getDurationMs() + " ms。", 21, false, null));
        } else {
            b.append(para("-", 21, false, null));
        }
        List<Map<String, Object>> rules = parseRuleSnapshot(task);
        if (!rules.isEmpty()) {
            List<String[]> ruleRows = new ArrayList<>();
            for (Map<String, Object> r : rules) {
                ruleRows.add(new String[]{
                        nvl(String.valueOf(r.get("ruleCode"))),
                        nvl(String.valueOf(r.get("ruleName"))),
                        nvl(String.valueOf(r.get("severity"))),
                        Boolean.TRUE.equals(r.get("enabled")) ? "启用" : "停用"});
            }
            b.append(table(new String[]{"规则编号", "规则名称", "严重度", "执行时状态"}, ruleRows));
        }

        // 六、附录
        b.append(heading("六、附录"));
        b.append(para("模型ID：" + nvl(result != null ? result.getModelId() : null) + "　生成时间："
                + LocalDateTime.now().format(FMT) + "　SysML模型解析与校验系统 v1.0", 18, false, null));

        String documentXml = "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                + "<w:document xmlns:w=\"" + DOC_NS + "\"><w:body>"
                + b
                + "<w:sectPr><w:pgSz w:w=\"11906\" w:h=\"16838\"/>"
                + "<w:pgMar w:top=\"1134\" w:right=\"1134\" w:bottom=\"1134\" w:left=\"1134\" w:header=\"720\" w:footer=\"720\" w:gutter=\"0\"/>"
                + "</w:sectPr></w:body></w:document>";
        try {
            return packDocx(documentXml);
        } catch (IOException e) {
            throw new IllegalStateException("生成 Word 报告失败", e);
        }
    }

    /** 把 document.xml 打成最小可打开的 .docx（zip 包） */
    private byte[] packDocx(String documentXml) throws IOException {
        ByteArrayOutputStream bos = new ByteArrayOutputStream();
        try (ZipOutputStream zos = new ZipOutputStream(bos, StandardCharsets.UTF_8)) {
            addZipEntry(zos, "[Content_Types].xml",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                            + "<Types xmlns=\"http://schemas.openxmlformats.org/package/2006/content-types\">"
                            + "<Default Extension=\"rels\" ContentType=\"application/vnd.openxmlformats-package.relationships+xml\"/>"
                            + "<Default Extension=\"xml\" ContentType=\"application/xml\"/>"
                            + "<Override PartName=\"/word/document.xml\" ContentType=\"application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml\"/>"
                            + "</Types>");
            addZipEntry(zos, "_rels/.rels",
                    "<?xml version=\"1.0\" encoding=\"UTF-8\" standalone=\"yes\"?>"
                            + "<Relationships xmlns=\"http://schemas.openxmlformats.org/package/2006/relationships\">"
                            + "<Relationship Id=\"rId1\" Type=\"http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument\" Target=\"word/document.xml\"/>"
                            + "</Relationships>");
            addZipEntry(zos, "word/document.xml", documentXml);
        }
        return bos.toByteArray();
    }

    private void addZipEntry(ZipOutputStream zos, String name, String content) throws IOException {
        zos.putNextEntry(new ZipEntry(name));
        zos.write(content.getBytes(StandardCharsets.UTF_8));
        zos.closeEntry();
    }

    private String statusLabel(ValidationTask task) {
        if (task.getStatus() == null) {
            return "-";
        }
        switch (task.getStatus().name()) {
            case "PENDING": return "待执行";
            case "RUNNING": return "执行中";
            case "SUCCESS": return "成功";
            case "FAILED": return "失败";
            case "CANCELLED": return "已取消";
            default: return task.getStatus().name();
        }
    }

    /** 普通段落 */
    private String para(String text, int half, boolean bold, String align) {
        String pr = rpr(half, bold, null);
        StringBuilder b = new StringBuilder("<w:p><w:pPr>");
        b.append("<w:spacing w:before=\"0\" w:after=\"80\" w:line=\"276\" w:lineRule=\"auto\"/>");
        if (align != null) {
            b.append("<w:jc w:val=\"").append(align).append("\"/>");
        }
        b.append("<w:rPr>").append(pr).append("</w:rPr></w:pPr>");
        b.append("<w:r><w:rPr>").append(pr).append("</w:rPr>");
        b.append("<w:t xml:space=\"preserve\">").append(h(text)).append("</w:t></w:r></w:p>");
        return b.toString();
    }

    /** 蓝色小节标题 */
    private String heading(String text) {
        String pr = rpr(26, true, "1F5FBF");
        StringBuilder b = new StringBuilder("<w:p><w:pPr><w:spacing w:before=\"200\" w:after=\"80\"/>");
        b.append("<w:rPr>").append(pr).append("</w:rPr></w:pPr>");
        b.append("<w:r><w:rPr>").append(pr).append("</w:rPr>");
        b.append("<w:t xml:space=\"preserve\">").append(h(text)).append("</w:t></w:r></w:p>");
        return b.toString();
    }

    /** 带边框的表格：首行为表头 */
    private String table(String[] header, List<String[]> rows) {
        StringBuilder b = new StringBuilder("<w:tbl><w:tblPr><w:tblW w:w=\"0\" w:type=\"auto\"/>");
        b.append("<w:tblBorders>");
        for (String edge : new String[]{"top", "left", "bottom", "right", "insideH", "insideV"}) {
            b.append("<w:").append(edge).append(" w:val=\"single\" w:sz=\"4\" w:space=\"0\" w:color=\"BFBFBF\"/>");
        }
        b.append("</w:tblBorders></w:tblPr>");
        b.append(tr(header, true));
        for (String[] row : rows) {
            b.append(tr(row, false));
        }
        b.append("</w:tbl>");
        return b.toString();
    }

    private String tr(String[] cells, boolean header) {
        StringBuilder b = new StringBuilder("<w:tr>");
        for (String cell : cells) {
            b.append(tc(cell, header));
        }
        b.append("</w:tr>");
        return b.toString();
    }

    private String tc(String text, boolean header) {
        String pr = header ? rpr(18, true, "1F5FBF") : rpr(18, false, null);
        StringBuilder b = new StringBuilder("<w:tc><w:tcPr><w:tcW w:w=\"0\" w:type=\"auto\"/>");
        if (header) {
            b.append("<w:shd w:val=\"clear\" w:color=\"auto\" w:fill=\"EAF0FA\"/>");
        }
        b.append("<w:vAlign w:val=\"center\"/></w:tcPr>");
        b.append("<w:p><w:pPr><w:spacing w:before=\"0\" w:after=\"20\" w:line=\"240\" w:lineRule=\"auto\"/>");
        b.append("<w:rPr>").append(pr).append("</w:rPr></w:pPr>");
        b.append("<w:r><w:rPr>").append(pr).append("</w:rPr>");
        b.append("<w:t xml:space=\"preserve\">").append(h(text == null ? "" : text)).append("</w:t></w:r></w:p>");
        b.append("</w:tc>");
        return b.toString();
    }

    private String rpr(int half, boolean bold, String color) {
        StringBuilder b = new StringBuilder("<w:rFonts w:ascii=\"Calibri\" w:hAnsi=\"Calibri\" w:eastAsia=\"宋体\"/>");
        if (bold) {
            b.append("<w:b/>");
        }
        if (color != null && !color.isEmpty()) {
            b.append("<w:color w:val=\"").append(color).append("\"/>");
        }
        b.append("<w:sz w:val=\"").append(half).append("\"/><w:szCs w:val=\"").append(half).append("\"/>");
        return b.toString();
    }

    private String nvl(Object o) {
        return o == null || String.valueOf(o).isBlank() ? "-" : String.valueOf(o);
    }

    private ValidationResult parseResult(ValidationTask task) {
        if (task.getResultJson() == null || task.getResultJson().isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(task.getResultJson(), ValidationResult.class);
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseRuleSnapshot(ValidationTask task) {
        String json = task.getRuleSnapshot();
        if (json == null || json.isBlank()) {
            return List.of();
        }
        try {
            return objectMapper.readValue(json, List.class);
        } catch (Exception e) {
            return List.of();
        }
    }

    private Map<String, Object> taskSummary(ValidationTask task) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", task.getId());
        m.put("taskName", task.getTaskName());
        m.put("modelName", task.getModelName());
        m.put("builtinOnly", task.isBuiltinOnly());
        m.put("status", task.getStatus().name());
        m.put("issueCount", task.getIssueCount());
        m.put("durationMs", task.getDurationMs());
        m.put("creator", task.getCreator());
        m.put("createTime", task.getCreateTime() != null ? task.getCreateTime().format(FMT) : null);
        m.put("startTime", task.getStartTime() != null ? task.getStartTime().format(FMT) : null);
        m.put("endTime", task.getEndTime() != null ? task.getEndTime().format(FMT) : null);
        m.put("errorMessage", task.getErrorMessage());
        return m;
    }

    private String conclusion(ValidationTask task, ValidationResult result) {
        if (task.getStatus() == null || !"SUCCESS".equals(task.getStatus().name()) || result == null) {
            String reason = task.getErrorMessage();
            return "任务未成功执行（状态：" + (task.getStatus() == null ? "-" : task.getStatus().name())
                    + (reason != null ? "，原因：" + reason : "") + "）。";
        }
        long total = result.getIssues().size();
        if (total == 0) {
            return "模型校验通过，未发现问题。";
        }
        Map<String, Long> c = result.getSeverityCounts();
        return "共发现 " + total + " 个问题（阻断 " + c.getOrDefault("BLOCKER", 0L)
                + "、错误 " + c.getOrDefault("ERROR", 0L)
                + "、警告 " + c.getOrDefault("WARNING", 0L)
                + "、提示 " + c.getOrDefault("INFO", 0L)
                + "），建议按严重程度逐项修复后重新校验。";
    }

    private String sevClass(String sev) {
        return "sev-" + (sev == null ? "INFO" : sev);
    }

    private String sevLabel(String sev) {
        if (sev == null) {
            return "提示";
        }
        switch (sev) {
            case "BLOCKER": return "阻断";
            case "ERROR": return "错误";
            case "WARNING": return "警告";
            default: return "提示";
        }
    }

    private String sourceLabel(String source) {
        if (source == null) {
            return "-";
        }
        switch (source.toLowerCase()) {
            case "parser": return "解析器";
            case "builtin": return "内置结构";
            case "rule": return "规则";
            default: return source;
        }
    }

    private String h(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
                .replace("\"", "&quot;").replace("'", "&#39;");
    }

    private String csv(String s) {
        if (s == null) {
            return "";
        }
        String v = String.valueOf(s);
        if (v.indexOf(',') >= 0 || v.indexOf('"') >= 0 || v.indexOf('\n') >= 0 || v.indexOf('\r') >= 0) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private String nullTo(String s, String def) {
        return s == null || s.isBlank() ? def : s;
    }
}
