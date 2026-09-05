package com.example.sysmlmodelchecker.controller;

import com.example.sysmlmodelchecker.model.Result;
import com.example.sysmlmodelchecker.service.ParseService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;
import tools.jackson.databind.JsonNode;

/**
 * 解析桥接接口：接收 XML，转发给解析模块并原样返回 ParsedModel JSON，
 * 供工作台「导入 XML」后直接开始校验。
 */
@RestController
@RequestMapping("/api/models")
public class ParseController {

    private final ParseService parseService;

    public ParseController(ParseService parseService) {
        this.parseService = parseService;
    }

    /** 上传 XML → 调用解析模块 → 返回 ParsedModel JSON（与原解析输出结构一致）。 */
    @PostMapping("/parse")
    public Result<JsonNode> parse(@RequestParam("file") MultipartFile file) {
        try {
            JsonNode model = parseService.parseXml(file);
            return Result.success(model,
                    "解析完成：元素 " + model.path("statistics").path("elements").asInt(0)
                            + "，关系 " + model.path("statistics").path("relations").asInt(0)
                            + "，图 " + model.path("statistics").path("diagrams").asInt(0));
        } catch (IllegalArgumentException e) {
            return Result.error(e.getMessage());
        } catch (Exception e) {
            return Result.error("解析失败：" + e.getMessage());
        }
    }
}