package com.example.sysmlmodelchecker.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Lob;
import jakarta.persistence.Table;

import java.time.LocalDateTime;

/**
 * 校验规则：对应方案2.3规则库结构与2.8求解脚本
 */
@Entity
@Table(name = "validation_rule")
public class ValidationRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** 规则编号，唯一，按类别分段，如 GEN-001 */
    @Column(nullable = false, unique = true, length = 32)
    private String ruleCode;

    /** 规则名称 */
    @Column(nullable = false, length = 128)
    private String ruleName;

    /** 适用范围：模型、包、图或指定元素集合 */
    @Column(length = 64)
    private String scope;

    /** 检测对象：SysML元类/构造型/关系 */
    @Column(nullable = false, length = 64)
    private String targetType;

    /** 触发条件：规则判定逻辑和必要前置条件 */
    @Column(name = "rule_condition", length = 512)
    private String condition;

    /** 严重程度：阻断、错误、警告、提示 */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 16)
    private Severity severity;

    /** 结果信息：面向用户的错误描述 */
    @Column(length = 512)
    private String message;

    /** 修复建议 */
    @Column(length = 512)
    private String fixSuggestion;

    /** 规则版本 */
    @Column(length = 32)
    private String ruleVersion;

    /** 求解脚本：JavaScript function main(element[, context]) */
    @Column(nullable = false, columnDefinition = "LONGTEXT")
    private String script;

    /** 规则状态：true启用，false停用 */
    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false)
    private LocalDateTime createTime;

    @Column(nullable = false)
    private LocalDateTime updateTime;

    public ValidationRule() {
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getRuleCode() {
        return ruleCode;
    }

    public void setRuleCode(String ruleCode) {
        this.ruleCode = ruleCode;
    }

    public String getRuleName() {
        return ruleName;
    }

    public void setRuleName(String ruleName) {
        this.ruleName = ruleName;
    }

    public String getScope() {
        return scope;
    }

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getTargetType() {
        return targetType;
    }

    public void setTargetType(String targetType) {
        this.targetType = targetType;
    }

    public String getCondition() {
        return condition;
    }

    public void setCondition(String condition) {
        this.condition = condition;
    }

    public Severity getSeverity() {
        return severity;
    }

    public void setSeverity(Severity severity) {
        this.severity = severity;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getFixSuggestion() {
        return fixSuggestion;
    }

    public void setFixSuggestion(String fixSuggestion) {
        this.fixSuggestion = fixSuggestion;
    }

    public String getRuleVersion() {
        return ruleVersion;
    }

    public void setRuleVersion(String ruleVersion) {
        this.ruleVersion = ruleVersion;
    }

    public String getScript() {
        return script;
    }

    public void setScript(String script) {
        this.script = script;
    }

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public LocalDateTime getCreateTime() {
        return createTime;
    }

    public void setCreateTime(LocalDateTime createTime) {
        this.createTime = createTime;
    }

    public LocalDateTime getUpdateTime() {
        return updateTime;
    }

    public void setUpdateTime(LocalDateTime updateTime) {
        this.updateTime = updateTime;
    }
}


