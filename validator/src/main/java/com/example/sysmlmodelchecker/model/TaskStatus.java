package com.example.sysmlmodelchecker.model;

/**
 * 校验任务状态：创建后进入 PENDING，开始执行 RUNNING，
 * 正常结束 SUCCESS，异常 FAILED，主动取消 CANCELLED。
 */
public enum TaskStatus {
    PENDING, RUNNING, SUCCESS, FAILED, CANCELLED
}