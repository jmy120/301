package com.example.sysmlmodelchecker.model.dto;

/**
 * 校验问题：解析器产生的 issues[] 与校验模块新增的问题统一用此结构表示。
 * severity 统一规范为大写枚举名（BLOCKER/ERROR/WARNING/INFO）。
 * source 表示问题来源：parser（解析器）、builtin（内置结构校验）、rule（规则校验）。
 */
public class ModelIssue {

    private String code;
    private String severity;
    private String message;
    private String xpath;
    private String elementId;
    private String referenceId;
    private String source;
    private String ruleCode;
    private String ruleName;

    public ModelIssue() {
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getSeverity() {
        return severity;
    }

    public void setSeverity(String severity) {
        this.severity = severity;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }

    public String getXpath() {
        return xpath;
    }

    public void setXpath(String xpath) {
        this.xpath = xpath;
    }

    public String getElementId() {
        return elementId;
    }

    public void setElementId(String elementId) {
        this.elementId = elementId;
    }

    public String getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(String referenceId) {
        this.referenceId = referenceId;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
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
}
