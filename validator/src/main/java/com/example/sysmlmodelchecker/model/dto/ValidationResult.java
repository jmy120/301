package com.example.sysmlmodelchecker.model.dto;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 校验结果：合并解析器问题、内置结构校验问题、规则校验问题，并附统计信息。
 */
public class ValidationResult {

    private String modelId;
    private List<ModelIssue> issues = new ArrayList<>();
    private ModelStatistics statistics;
    /** 规则脚本实际执行次数（每条规则 × 每个命中对象） */
    private int rulesExecuted;
    /** 命中的规则数量 */
    private int rulesMatched;
    /** 校验耗时（毫秒） */
    private long durationMs;
    /** 按严重程度统计的问题数量，如 ERROR: 3, WARNING: 5 */
    private Map<String, Long> severityCounts = new LinkedHashMap<>();

    public ValidationResult() {
    }

    public String getModelId() {
        return modelId;
    }

    public void setModelId(String modelId) {
        this.modelId = modelId;
    }

    public List<ModelIssue> getIssues() {
        return issues;
    }

    public void setIssues(List<ModelIssue> issues) {
        this.issues = issues != null ? issues : new ArrayList<>();
    }

    public ModelStatistics getStatistics() {
        return statistics;
    }

    public void setStatistics(ModelStatistics statistics) {
        this.statistics = statistics;
    }

    public int getRulesExecuted() {
        return rulesExecuted;
    }

    public void setRulesExecuted(int rulesExecuted) {
        this.rulesExecuted = rulesExecuted;
    }

    public int getRulesMatched() {
        return rulesMatched;
    }

    public void setRulesMatched(int rulesMatched) {
        this.rulesMatched = rulesMatched;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }

    public Map<String, Long> getSeverityCounts() {
        return severityCounts;
    }

    public void setSeverityCounts(Map<String, Long> severityCounts) {
        this.severityCounts = severityCounts != null ? severityCounts : new LinkedHashMap<>();
    }
}
