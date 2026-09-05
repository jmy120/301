package com.example.sysmlmodelchecker.service.validation;

import com.example.sysmlmodelchecker.model.dto.ModelDiagram;
import com.example.sysmlmodelchecker.model.dto.ModelElement;
import com.example.sysmlmodelchecker.model.dto.ModelIssue;
import com.example.sysmlmodelchecker.model.dto.ModelRelation;
import com.example.sysmlmodelchecker.model.dto.ModelView;
import com.example.sysmlmodelchecker.model.dto.ParsedModel;
import com.example.sysmlmodelchecker.model.dto.ValidationResult;
import com.example.sysmlmodelchecker.model.Severity;
import com.example.sysmlmodelchecker.model.ValidationRule;
import com.example.sysmlmodelchecker.repository.RuleRepository;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * 内置结构校验测试：覆盖重复ID、悬空引用、关系端点缺失、父子引用一致性、
 * 解析器问题合并与严重程度规范化。
 */
class ModelValidationServiceTest {

    /** 不触碰数据库，只走 validateBuiltin 路径 */
    private final ModelValidationService service = new ModelValidationService(null);

    @Test
    void structuralChecksDetectProblems() {
        ParsedModel model = sampleModel();

        ValidationResult result = service.validateBuiltin(model);

        // 重复ID：e1 出现两次
        long duplicates = count(result, "DUPLICATE_ID");
        assertEquals(1, duplicates);

        // 悬空引用：r1->ghost、d1->ghost-view、v1->ghost-element
        long dangling = count(result, "DANGLING_REFERENCE");
        assertEquals(3, dangling);

        // 关系端点缺失：r2
        assertEquals(1, count(result, "RELATION_ENDPOINT_MISSING"));

        // 统计
        assertEquals(4, result.getStatistics().getElements());
        assertEquals(2, result.getStatistics().getRelations());
        assertEquals(1, result.getStatistics().getDiagrams());
        assertEquals(1, result.getStatistics().getViews());
        assertEquals(3, result.getStatistics().getDanglingReferences());
        assertEquals(1, result.getStatistics().getDuplicateIds());

        // 解析器问题合并与严重程度规范化
        assertTrue(result.getIssues().stream().anyMatch(i ->
                "PARSE_WARNING".equals(i.getCode()) && "WARNING".equals(i.getSeverity())
                        && "parser".equals(i.getSource())));
        assertTrue(result.getIssues().stream().anyMatch(i ->
                "PARSE_INFO".equals(i.getCode()) && "INFO".equals(i.getSeverity())));

        // 与内置重复的解析器问题被去重（r1->ghost 只保留一条）
        long r1Ghost = result.getIssues().stream()
                .filter(i -> "r1".equals(i.getElementId()) && "ghost".equals(i.getReferenceId()))
                .count();
        assertEquals(1, r1Ghost);

        // 严重程度计数：ERROR 5（重复1 + 悬空3 + 端点缺失1），WARNING 1，INFO 1
        assertEquals(5L, result.getSeverityCounts().get("ERROR"));
        assertEquals(1L, result.getSeverityCounts().get("WARNING"));
        assertEquals(1L, result.getSeverityCounts().get("INFO"));
    }

    @Test
    void cleanModelProducesNoErrors() {
        ParsedModel model = new ParsedModel();
        model.setId("clean");

        ModelElement block = new ModelElement();
        block.setId("b1");
        block.setName("BlockA");
        block.setMetaClass("uml:Class");
        block.setStereotypes(List.of("Block"));
        block.setChildrenIds(List.of("p1"));

        ModelElement part = new ModelElement();
        part.setId("p1");
        part.setName("part1");
        part.setMetaClass("uml:Property");
        part.setOwnerId("b1");

        model.setElements(List.of(block, part));

        ValidationResult result = service.validateBuiltin(model);
        assertEquals(0, result.getIssues().size());
        assertEquals(0, result.getStatistics().getDanglingReferences());
        assertEquals(0, result.getStatistics().getDuplicateIds());
    }

    @Test
    void parentChildMismatchReported() {
        ParsedModel model = new ParsedModel();

        ModelElement parent = new ModelElement();
        parent.setId("p");
        parent.setName("Parent");
        parent.setChildrenIds(List.of("c"));

        ModelElement child = new ModelElement();
        child.setId("c");
        child.setName("Child");
        child.setOwnerId("other"); // 不一致

        model.setElements(List.of(parent, child));

        ValidationResult result = service.validateBuiltin(model);
        assertEquals(1, count(result, "PARENT_CHILD_MISMATCH"));
    }

    /** 停用规则不应执行（后端 enabled 过滤验证） */
    @Test
    void disabledRuleIsNotExecuted() {
        RuleRepository repo = mock(RuleRepository.class);

        ValidationRule enabled = buildTestRule("ENB-001", "启用规则", "Block", Severity.ERROR,
                "function main(element) { return false; }", true);
        ValidationRule disabled = buildTestRule("DIS-001", "停用规则", "Block", Severity.WARNING,
                "function main(element) { return false; }", false);
        when(repo.findAll()).thenReturn(List.of(enabled, disabled));

        ModelValidationService svc = new ModelValidationService(repo);
        ValidationResult result = svc.validate(sampleModel());

        assertTrue(result.getIssues().stream().anyMatch(i -> "ENB-001".equals(i.getRuleCode())),
                "启用规则应执行并产生问题");
        assertTrue(result.getIssues().stream().noneMatch(i -> "DIS-001".equals(i.getRuleCode())),
                "停用规则不应执行");
    }

    private ValidationRule buildTestRule(String code, String name, String target, Severity severity,
                                         String script, boolean enabled) {
        ValidationRule rule = new ValidationRule();
        rule.setRuleCode(code);
        rule.setRuleName(name);
        rule.setTargetType(target);
        rule.setSeverity(severity);
        rule.setMessage("测试问题：" + code);
        rule.setScript(script);
        rule.setEnabled(enabled);
        return rule;
    }

    private ParsedModel sampleModel() {
        ParsedModel model = new ParsedModel();
        model.setId("sample-1");

        ModelElement e1 = new ModelElement();
        e1.setId("e1");
        e1.setName("BlockA");
        e1.setMetaClass("uml:Class");
        e1.setStereotypes(List.of("Block"));
        e1.setChildrenIds(List.of("e2"));

        ModelElement e2 = new ModelElement();
        e2.setId("e2");
        e2.setName("Port1");
        e2.setMetaClass("uml:Property");
        e2.setOwnerId("e1");

        ModelElement e3 = new ModelElement(); // 与 e1 重复ID
        e3.setId("e1");
        e3.setName("BlockB");
        e3.setMetaClass("uml:Class");
        e3.setStereotypes(List.of("Block"));

        ModelElement e4 = new ModelElement();
        e4.setId("e4");
        e4.setName("无ID元素");
        e4.setMetaClass("uml:Class");

        ModelRelation r1 = new ModelRelation();
        r1.setId("r1");
        r1.setKind("uml:Dependency");
        r1.setSourceId("e1");
        r1.setTargetId("ghost"); // 悬空

        ModelRelation r2 = new ModelRelation();
        r2.setId("r2");
        r2.setKind("uml:Association"); // 端点缺失

        ModelDiagram d1 = new ModelDiagram();
        d1.setId("d1");
        d1.setType("Block Definition Diagram");
        d1.setName("架构模型");
        d1.setViewIds(List.of("v1", "ghost-view")); // ghost-view 悬空

        ModelView v1 = new ModelView();
        v1.setId("v1");
        v1.setDiagramId("d1");
        v1.setModelElementId("ghost-element"); // 悬空
        v1.setKind("mdElement");

        model.setElements(List.of(e1, e2, e3, e4));
        model.setRelations(List.of(r1, r2));
        model.setDiagrams(List.of(d1));
        model.setViews(List.of(v1));

        // 解析器自带问题
        ModelIssue parserDup = new ModelIssue();
        parserDup.setCode("DANGLING_REFERENCE");
        parserDup.setSeverity("error");
        parserDup.setElementId("r1");
        parserDup.setReferenceId("ghost");

        ModelIssue parserWarn = new ModelIssue();
        parserWarn.setCode("PARSE_WARNING");
        parserWarn.setSeverity("warning");
        parserWarn.setElementId("x");

        ModelIssue parserInfo = new ModelIssue();
        parserInfo.setCode("PARSE_INFO");
        parserInfo.setSeverity("info");
        parserInfo.setElementId("x");
        parserInfo.setXpath("/xmi:XMI/model");

        List<ModelIssue> parserIssues = new ArrayList<>();
        parserIssues.add(parserDup);
        parserIssues.add(parserWarn);
        parserIssues.add(parserInfo);
        model.setIssues(parserIssues);
        return model;
    }

    private long count(ValidationResult result, String code) {
        return result.getIssues().stream().filter(i -> code.equals(i.getCode())).count();
    }
}