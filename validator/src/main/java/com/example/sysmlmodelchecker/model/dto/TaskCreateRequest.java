package com.example.sysmlmodelchecker.model.dto;

/**
 * 创建校验任务请求体。
 */
public class TaskCreateRequest {

    /** 任务名称，为空时后端自动生成 */
    private String taskName;

    /** 模型文件名 */
    private String modelName;

    /** 解析结果 JSON（ParsedModel 结构） */
    private String modelJson;

    /** 是否仅内置结构校验 */
    private boolean builtinOnly;

    public TaskCreateRequest() {
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

    public boolean isBuiltinOnly() {
        return builtinOnly;
    }

    public void setBuiltinOnly(boolean builtinOnly) {
        this.builtinOnly = builtinOnly;
    }
}