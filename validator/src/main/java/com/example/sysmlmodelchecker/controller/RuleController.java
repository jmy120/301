package com.example.sysmlmodelchecker.controller;

import com.example.sysmlmodelchecker.model.Result;
import com.example.sysmlmodelchecker.model.Severity;
import com.example.sysmlmodelchecker.model.ValidationRule;
import com.example.sysmlmodelchecker.service.RuleService;
import org.springframework.data.domain.Page;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/rules")
public class RuleController {

    private final RuleService ruleService;

    public RuleController(RuleService ruleService) {
        this.ruleService = ruleService;
    }

    /** 创建规则 */
    @PostMapping
    public Result<ValidationRule> create(@RequestBody ValidationRule rule) {
        try {
            return Result.success(ruleService.create(rule), "规则创建成功");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }

    /** 更新规则 */
    @PutMapping("/{id}")
    public Result<ValidationRule> update(@PathVariable Long id,
                                         @RequestBody ValidationRule rule) {
        try {
            return Result.success(ruleService.update(id, rule), "规则更新成功");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }

    /** 删除规则 */
    @DeleteMapping("/{id}")
    public Result<Void> delete(@PathVariable Long id) {
        try {
            ruleService.delete(id);
            return Result.success(null, "规则删除成功");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }

    /** 查询规则详情 */
    @GetMapping("/{id}")
    public Result<ValidationRule> detail(@PathVariable Long id) {
        try {
            return Result.success(ruleService.findById(id), "查询成功");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }

    /** 分页查询规则列表，支持关键字/检测对象/严重程度/状态筛选 */
    @GetMapping
    public Result<Page<ValidationRule>> list(
            @RequestParam(required = false) String keyword,
            @RequestParam(required = false) String targetType,
            @RequestParam(required = false) Severity severity,
            @RequestParam(required = false) Boolean enabled,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        return Result.success(
                ruleService.search(keyword, targetType, severity, enabled, page, size),
                "查询成功");
    }

    /** 启用/停用规则 */
    @PutMapping("/{id}/status")
    public Result<ValidationRule> setStatus(@PathVariable Long id,
                                           @RequestBody Map<String, Boolean> body) {
        try {
            boolean enabled = Boolean.TRUE.equals(body.get("enabled"));
            return Result.success(ruleService.setEnabled(id, enabled), "状态更新成功");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        }
    }

    /** 严重程度选项（供前端下拉使用） */
    @GetMapping("/severities")
    public Result<List<Map<String, String>>> severities() {
        List<Map<String, String>> options = new ArrayList<>();
        for (Severity severity : Severity.values()) {
            Map<String, String> option = new LinkedHashMap<>();
            option.put("code", severity.name());
            option.put("label", severity.getLabel());
            options.add(option);
        }
        return Result.success(options, "查询成功");
    }

    /** 已使用的检测对象选项 */
    @GetMapping("/target-types")
    public Result<List<String>> targetTypes() {
        return Result.success(ruleService.listTargetTypes(), "查询成功");
    }

    /** 初始化内置示例规则（幂等，仅补充缺失的规则编号） */
    @PostMapping("/init")
    public Result<Integer> init() {
        return Result.success(ruleService.seedDefaults(), "初始化完成");
    }
}
