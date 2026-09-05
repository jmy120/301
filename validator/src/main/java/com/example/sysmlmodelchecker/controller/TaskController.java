package com.example.sysmlmodelchecker.controller;

import com.example.sysmlmodelchecker.model.Result;
import com.example.sysmlmodelchecker.model.ValidationTask;
import com.example.sysmlmodelchecker.model.dto.TaskCreateRequest;
import com.example.sysmlmodelchecker.service.TaskService;
import com.example.sysmlmodelchecker.service.report.ReportGenerator;
import tools.jackson.databind.ObjectMapper;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * 校验任务接口：创建/列表/详情/重跑/删除 + 报告导出（HTML/JSON/CSV）。
 */
@RestController
@RequestMapping("/api/tasks")
public class TaskController {

    private final TaskService taskService;
    private final ReportGenerator reportGenerator;
    private final ObjectMapper objectMapper;

    public TaskController(TaskService taskService, ReportGenerator reportGenerator, ObjectMapper objectMapper) {
        this.taskService = taskService;
        this.reportGenerator = reportGenerator;
        this.objectMapper = objectMapper;
    }

    /** 创建任务：同步执行校验并落库，返回任务详情（含校验结果） */
    @PostMapping
    public Result<Map<String, Object>> create(@RequestBody TaskCreateRequest req) {
        try {
            ValidationTask task = taskService.create(
                    req.getTaskName(), req.getModelName(), req.getModelJson(), req.isBuiltinOnly());
            return Result.success(taskService.toDetail(task), "任务创建并执行完成");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("创建任务失败：" + e.getMessage());
        }
    }

    /** 分页查询任务列表（不返回大字段 modelJson/resultJson） */
    @GetMapping
    public Result<Map<String, Object>> list(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String keyword) {
        try {
            return Result.success(taskService.list(page, size, status, keyword), "查询成功");
        } catch (Exception e) {
            return Result.error("查询失败：" + e.getMessage());
        }
    }

    /** 任务详情（含校验结果） */
    @GetMapping("/{id}")
    public Result<Map<String, Object>> detail(@PathVariable Long id) {
        try {
            return Result.success(taskService.toDetail(taskService.requireTask(id)), "查询成功");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("查询失败：" + e.getMessage());
        }
    }

    /** 重跑：复用模型快照 + 当前规则库 */
    @PostMapping("/{id}/rerun")
    public Result<Map<String, Object>> rerun(@PathVariable Long id) {
        try {
            ValidationTask task = taskService.rerun(id);
            return Result.success(taskService.toDetail(task), "任务已重新执行");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("重跑失败：" + e.getMessage());
        }
    }

    /** 删除任务 */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        try {
            taskService.delete(id);
            return Result.success(null, "任务已删除");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("删除失败：" + e.getMessage());
        }
    }

    /**
     * 导出报告：format=html（浏览器预览/打印PDF）/ docx 或 word（Word 附件下载）/ json / csv（附件下载，UTF-8 BOM）。
     */
    @GetMapping("/{id}/report")
    public ResponseEntity<byte[]> report(@PathVariable Long id,
                                         @RequestParam(defaultValue = "html") String format) {
        ValidationTask task = taskService.requireTask(id);
        String fmt = format == null ? "html" : format.trim().toLowerCase();
        byte[] body;
        MediaType contentType;
        HttpHeaders headers = new HttpHeaders();
        switch (fmt) {
            case "docx":
            case "word":
                body = reportGenerator.renderDocx(task);
                contentType = new MediaType("application", "vnd.openxmlformats-officedocument.wordprocessingml.document");
                headers.setContentDispositionFormData("attachment", "task-" + id + "-report.docx");
                break;
            case "json":
                try {
                    body = objectMapper.writeValueAsString(reportGenerator.renderJson(task))
                            .getBytes(StandardCharsets.UTF_8);
                } catch (Exception e) {
                    body = "{}".getBytes(StandardCharsets.UTF_8);
                }
                contentType = new MediaType("application", "json", StandardCharsets.UTF_8);
                break;
            case "csv":
                body = reportGenerator.renderCsv(task).getBytes(StandardCharsets.UTF_8);
                contentType = new MediaType("text", "csv", StandardCharsets.UTF_8);
                headers.setContentDispositionFormData("attachment", "task-" + id + "-issues.csv");
                break;
            case "html":
            default:
                body = reportGenerator.renderHtml(task).getBytes(StandardCharsets.UTF_8);
                contentType = new MediaType("text", "html", StandardCharsets.UTF_8);
                break;
        }
        return ResponseEntity.ok().headers(headers).contentType(contentType).body(body);
    }
}
