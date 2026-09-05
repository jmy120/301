package com.example.sysmlmodelchecker.controller;

import com.example.sysmlmodelchecker.model.Result;
import com.example.sysmlmodelchecker.model.dto.ParsedModel;
import com.example.sysmlmodelchecker.model.dto.ValidationResult;
import com.example.sysmlmodelchecker.service.validation.ModelValidationService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * 模型校验接口：接收解析模块产出的 JSON（ParsedModel），返回校验结果。
 */
@RestController
@RequestMapping("/api/models")
public class ValidationController {

    private final ModelValidationService validationService;

    public ValidationController(ModelValidationService validationService) {
        this.validationService = validationService;
    }

    /**
     * 完整校验：内置结构校验 + 规则库中已启用规则校验。
     * 请求体为解析模块输出的完整 JSON（与 ParsedModel 结构一致）。
     */
    @PostMapping("/validate")
    public Result<ValidationResult> validate(@RequestBody ParsedModel model) {
        try {
            ValidationResult result = validationService.validate(model);
            return Result.success(result,
                    "校验完成，共发现 " + result.getIssues().size() + " 个问题");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("校验失败：" + e.getMessage());
        }
    }

    /**
     * 仅内置结构校验（不依赖数据库规则），用于快速排查解析结果的引用/ID问题。
     */
    @PostMapping("/validate/builtin")
    public Result<ValidationResult> validateBuiltin(@RequestBody ParsedModel model) {
        try {
            ValidationResult result = validationService.validateBuiltin(model);
            return Result.success(result,
                    "结构校验完成，共发现 " + result.getIssues().size() + " 个问题");
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("校验失败：" + e.getMessage());
        }
    }
}