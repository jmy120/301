package com.example.sysmlmodelchecker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 校验任务：一次"模型 + 规则集 + 校验执行"的完整记录。
 * 保存模型 JSON 与结果 JSON 快照，支持历史查询、重跑与报告导出。
 */
@Entity
@Table(name = "validation_task")
public class ValidationTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 任务名称 */
    @Column(nullable = false, length = 200)
    private String taskName;

    /** 模型文件名 */
    @Column(length = 200)
    private String modelName;

    /** 解析结果 JSON 快照（ParsedModel） */
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String modelJson;

    /** 执行时的规则快照（JSON：ruleCode/ruleName/severity/enabled） */
    @Column(columnDefinition = "TEXT")
    private String ruleSnapshot;

    /** 是否仅内置结构校验 */
    @Column(nullable = false)
    private boolean builtinOnly;

    /** 任务状态 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TaskStatus status;

    /** 失败/取消原因 */
    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    /** 校验结果 JSON 快照（ValidationResult） */
    @Column(columnDefinition = "LONGTEXT")
    private String resultJson;

    /** 严重程度汇总 JSON，列表页免读大字段 */
    @Column(columnDefinition = "TEXT")
    private String severityJson;

    /** 问题总数，列表页免读大字段 */
    @Column(nullable = false)
    private int issueCount;

    /** 校验耗时（毫秒） */
    @Column(nullable = false)
    private long durationMs;

    /** 创建人 */
    @Column(length = 64)
    private String creator;

    @Column(nullable = false)
    private LocalDateTime createTime;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    public ValidationTask() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getTaskName() {
        return taskName;
    }

    public void setTaskName(String taskName) {
        this.taskName = taskName;
    }

    public String getModelName() {
        return modelName;
    }

    public void setModelName(String modelName) {
        this.modelName = modelName;
    }

    public String getModelJson() {
        return modelJson;
    }

    public void setModelJson(String modelJson) {
        this.modelJson = modelJson;
    }

    public String getRuleSnapshot() {
        return ruleSnapshot;
    }

    public void setRuleSnapshot(String ruleSnapshot) {
        this.ruleSnapshot = ruleSnapshot;
    }

    public boolean isBuiltinOnly() {
        return builtinOnly;
    }

    public void setBuiltinOnly(boolean builtinOnly) {
        this.builtinOnly = builtinOnly;
    }

    public TaskStatus getStatus() {
        return status;
    }

    public void setStatus(TaskStatus status) {
        this.status = status;
    }

    public String getErrorMessage() {
        return errorMessage;
    }

    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }

    public String getResultJson() {
        return resultJson;
    }

    public void setResultJson(String resultJson) {
        this.resultJson = resultJson;
    }

    public String getSeverityJson() {
        return severityJson;
    }

    public void setSeverityJson(String severityJson) {
        this.severityJson = severityJson;
    }

    public int getIssueCount() {
        return issueCount;
    }

    public void setIssueCount(int issueCount) {
        this.issueCount = issueCount;
    }

    public long getDurationMs() {
        return durationMs;
    }

    public void setDurationMs(long durationMs) {
        this.durationMs = durationMs;
    }

    public String getCreator() {
        return creator;
    }

    public void setCreator(String creator) {
        this.creator = creator;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public LocalDateTime getStartTime() {
        return startTime;
    }

    public void setStartTime(LocalDateTime startTime) {
        this.startTime = startTime;
    }

    public LocalDateTime getEndTime() {
        return endTime;
    }

    public void setEndTime(LocalDateTime endTime) {
        this.endTime = endTime;
    }
}