package com.example.sysmlmodelchecker.model;

/**
 * 校验规则严重程度：阻断、错误、警告、提示
 */
public enum Severity {

    BLOCKER("阻断"),
    ERROR("错误"),
    WARNING("警告"),
    INFO("提示");

    private final String label;

    Severity(String label) {
        this.label = label;
    }

    public String getLabel() {
        return label;
    }
}
