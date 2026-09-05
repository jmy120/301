package com.example.sysmlmodelchecker.service;

import com.example.sysmlmodelchecker.model.TaskStatus;
import com.example.sysmlmodelchecker.model.ValidationRule;
import com.example.sysmlmodelchecker.model.ValidationTask;
import com.example.sysmlmodelchecker.model.dto.ParsedModel;
import com.example.sysmlmodelchecker.model.dto.ValidationResult;
import com.example.sysmlmodelchecker.repository.RuleRepository;
import com.example.sysmlmodelchecker.repository.ValidationTaskRepository;
import com.example.sysmlmodelchecker.service.validation.ModelValidationService;
import tools.jackson.databind.ObjectMapper;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * 校验任务服务：创建（同步执行并落库）、分页查询、详情、重跑、删除。
 */
@Service
public class TaskService {

    private static final DateTimeFormatter FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final ValidationTaskRepository taskRepository;
    private final ModelValidationService validationService;
    private final RuleRepository ruleRepository;
    private final ObjectMapper objectMapper;

    public TaskService(ValidationTaskRepository taskRepository,
                       ModelValidationService validationService,
                       RuleRepository ruleRepository,
                       ObjectMapper objectMapper) {
        this.taskRepository = taskRepository;
        this.validationService = validationService;
        this.ruleRepository = ruleRepository;
        this.objectMapper = objectMapper;
    }

    /** 创建任务并同步执行 */
    public ValidationTask create(String taskName, String modelName, String modelJson, boolean builtinOnly) {
        if (modelJson == null || modelJson.isBlank()) {
            throw new IllegalArgumentException("模型 JSON 不能为空");
        }
        ValidationTask task = new ValidationTask();
        task.setTaskName(blankToDefault(taskName, "模型校验-" + timestamp()));
        task.setModelName(blankToNull(modelName));
        task.setModelJson(modelJson);
        task.setBuiltinOnly(builtinOnly);
        task.setStatus(TaskStatus.PENDING);
        task.setCreator("admin");
        task.setCreateTime(LocalDateTime.now());
        task = taskRepository.save(task);
        return execute(task);
    }

    /** 重跑：复用模型快照 + 当前规则库 */
    public ValidationTask rerun(Long id) {
        ValidationTask task = requireTask(id);
        task.setStatus(TaskStatus.PENDING);
        task.setErrorMessage(null);
        task.setResultJson(null);
        task.setSeverityJson(null);
        task.setIssueCount(0);
        task.setDurationMs(0);
        task.setStartTime(null);
        task.setEndTime(null);
        task = taskRepository.save(task);
        return execute(task);
    }

    public void delete(Long id) {
        requireTask(id);
        taskRepository.deleteById(id);
    }

    /** 分页查询任务列表 */
    public Map<String, Object> list(int page, int size, String status, String keyword) {
        TaskStatus st = null;
        if (status != null && !status.isBlank()) {
            try {
                st = TaskStatus.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException ignored) {
                // 非法状态按不过滤处理
            }
        }
        String kw = blankToNull(keyword);
        Pageable pageable = PageRequest.of(Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by(Sort.Direction.DESC, "createTime").and(Sort.by(Sort.Direction.DESC, "id")));
        Page<ValidationTask> result = taskRepository.search(st, kw, pageable);
        List<Map<String, Object>> items = result.getContent().stream()
                .map(this::toSummary).collect(Collectors.toList());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", result.getTotalElements());
        out.put("page", result.getNumber());
        out.put("size", result.getSize());
        out.put("items", items);
        return out;
    }

    /** 任务详情：摘要 + 校验结果（issues/statistics/severityCounts 等） */
    public Map<String, Object> toDetail(ValidationTask task) {
        Map<String, Object> m = toSummary(task);
        if (task.getResultJson() != null) {
            try {
                m.put("result", objectMapper.readValue(task.getResultJson(), Object.class));
            } catch (Exception ignored) {
                m.put("result", null);
            }
        } else {
            m.put("result", null);
        }
        return m;
    }

    public Map<String, Object> toSummary(ValidationTask task) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", task.getId());
        m.put("taskName", task.getTaskName());
        m.put("modelName", task.getModelName());
        m.put("builtinOnly", task.isBuiltinOnly());
        m.put("status", task.getStatus().name());
        m.put("issueCount", task.getIssueCount());
        m.put("durationMs", task.getDurationMs());
        m.put("severityCounts", parseSeverity(task.getSeverityJson()));
        m.put("creator", task.getCreator());
        m.put("createTime", fmt(task.getCreateTime()));
        m.put("startTime", fmt(task.getStartTime()));
        m.put("endTime", fmt(task.getEndTime()));
        m.put("errorMessage", task.getErrorMessage());
        return m;
    }

    public ValidationTask requireTask(Long id) {
        if (id == null) {
            throw new IllegalArgumentException("任务ID不能为空");
        }
        return taskRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("任务不存在：" + id));
    }

    /** 执行校验并落库（同步） */
    private ValidationTask execute(ValidationTask task) {
        task.setStatus(TaskStatus.RUNNING);
        task.setStartTime(LocalDateTime.now());
        taskRepository.save(task);
        try {
            ParsedModel model = objectMapper.readValue(task.getModelJson(), ParsedModel.class);
            task.setRuleSnapshot(snapshotRules());
            long begin = System.nanoTime();
            ValidationResult result = task.isBuiltinOnly()
                    ? validationService.validateBuiltin(model)
                    : validationService.validate(model);
            long durationMs = (System.nanoTime() - begin) / 1_000_000;
            result.setDurationMs(durationMs);

            task.setResultJson(objectMapper.writeValueAsString(result));
            task.setSeverityJson(objectMapper.writeValueAsString(result.getSeverityCounts()));
            task.setIssueCount(result.getIssues().size());
            task.setDurationMs(durationMs);
            task.setStatus(TaskStatus.SUCCESS);
        } catch (IllegalArgumentException e) {
            task.setStatus(TaskStatus.FAILED);
            task.setErrorMessage(e.getMessage());
        } catch (Exception e) {
            task.setStatus(TaskStatus.FAILED);
            task.setErrorMessage(e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
        }
        task.setEndTime(LocalDateTime.now());
        return taskRepository.save(task);
    }

    /** 规则快照：当前规则库的编号/名称/严重度/启用状态 */
    private String snapshotRules() {
        List<Map<String, Object>> list = new ArrayList<>();
        for (ValidationRule r : ruleRepository.findAll()) {
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("ruleCode", r.getRuleCode());
            m.put("ruleName", r.getRuleName());
            m.put("severity", r.getSeverity() != null ? r.getSeverity().name() : null);
            m.put("enabled", r.isEnabled());
            list.add(m);
        }
        try {
            return objectMapper.writeValueAsString(list);
        } catch (Exception e) {
            return "[]";
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Long> parseSeverity(String json) {
        if (json == null || json.isBlank()) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(json, LinkedHashMap.class);
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String blankToDefault(String s, String def) {
        return blankToNull(s) == null ? def : s.trim();
    }

    private String timestamp() {
        return LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss"));
    }

    private String fmt(LocalDateTime t) {
        return t == null ? null : t.format(FMT);
    }
}