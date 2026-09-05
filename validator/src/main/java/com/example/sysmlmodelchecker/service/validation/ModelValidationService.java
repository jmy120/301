package com.example.sysmlmodelchecker.service.validation;

import com.example.sysmlmodelchecker.model.Severity;
import com.example.sysmlmodelchecker.model.ValidationRule;
import com.example.sysmlmodelchecker.model.dto.ModelDiagram;
import com.example.sysmlmodelchecker.model.dto.ModelElement;
import com.example.sysmlmodelchecker.model.dto.ModelIssue;
import com.example.sysmlmodelchecker.model.dto.ModelRelation;
import com.example.sysmlmodelchecker.model.dto.ModelStatistics;
import com.example.sysmlmodelchecker.model.dto.ModelView;
import com.example.sysmlmodelchecker.model.dto.ParsedModel;
import com.example.sysmlmodelchecker.model.dto.ValidationResult;
import com.example.sysmlmodelchecker.repository.RuleRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 模型校验服务：接收解析模块产出的 ParsedModel，执行
 * 1) 内置结构校验（悬空引用、重复ID、关系端点等）；
 * 2) 规则库中已启用规则的脚本校验（按 targetType 匹配元素/关系/图/视图）；
 * 3) 合并解析器自带问题，输出 ValidationResult。
 */
@Service
public class ModelValidationService {

    public static final String CODE_RULE_SCRIPT_ERROR = "RULE_SCRIPT_ERROR";

    private final RuleRepository ruleRepository;
    private final RuleScriptEngine scriptEngine = new RuleScriptEngine();
    private final StructuralValidator structuralValidator = new StructuralValidator();

    public ModelValidationService(RuleRepository ruleRepository) {
        this.ruleRepository = ruleRepository;
    }

    /** 完整校验：内置结构校验 + 数据库启用规则 */
    public ValidationResult validate(ParsedModel model) {
        long start = System.nanoTime();
        checkInput(model);

        StructuralValidator.StructuralResult structural = structuralValidator.run(model);
        List<ModelIssue> issues = new ArrayList<>(structural.issues);

        int rulesExecuted = 0;
        int rulesMatched = 0;
        List<ValidationRule> rules = enabledRules();
        if (!rules.isEmpty()) {
            Map<String, Object> context = buildContext(model);
            for (ValidationRule rule : rules) {
                List<Object> candidates = collectCandidates(rule, model);
                if (candidates.isEmpty()) {
                    continue;
                }
                rulesMatched++;
                for (Object candidate : candidates) {
                    rulesExecuted++;
                    @SuppressWarnings("unchecked")
                    Map<String, Object> element = (Map<String, Object>) candidate;
                    try {
                        Object result = scriptEngine.execute(rule.getScript(), element, context);
                        if (!(result instanceof Boolean passed)) {
                            issues.add(ruleScriptError(rule, element, "脚本未返回布尔值"));
                        } else if (!passed) {
                            issues.add(ruleViolation(rule, element));
                        }
                    } catch (Exception ex) {
                        issues.add(ruleScriptError(rule, element,
                                ex.getMessage() == null ? ex.getClass().getSimpleName() : ex.getMessage()));
                    }
                }
            }
        }

        mergeParserIssues(model, issues);
        return buildResult(model, structural.statistics, issues, rulesExecuted, rulesMatched, start);
    }

    /** 仅执行内置结构校验（不依赖数据库），便于脱离数据库快速自测 */
    public ValidationResult validateBuiltin(ParsedModel model) {
        long start = System.nanoTime();
        checkInput(model);
        StructuralValidator.StructuralResult structural = structuralValidator.run(model);
        List<ModelIssue> issues = new ArrayList<>(structural.issues);
        mergeParserIssues(model, issues);
        return buildResult(model, structural.statistics, issues, 0, 0, start);
    }

    // ================= 规则脚本执行 =================

    private List<ValidationRule> enabledRules() {
        return ruleRepository.findAll().stream()
                .filter(ValidationRule::isEnabled)
                .collect(Collectors.toList());
    }

    /** 按规则的 targetType 收集候选对象（已绑定为脚本可读的 Map） */
    private List<Object> collectCandidates(ValidationRule rule, ParsedModel model) {
        String target = rule.getTargetType();
        if (blank(target)) {
            return List.of();
        }
        String t = target.trim();
        if (t.equals("*") || t.equalsIgnoreCase("Model Element") || t.equals("元素")) {
            List<Object> all = new ArrayList<>();
            for (ModelElement e : model.getElements()) {
                all.add(bindElement(e));
            }
            return all;
        }
        List<Object> out = new ArrayList<>();
        for (ModelElement e : model.getElements()) {
            if (matchesType(e.getMetaClass(), t) || matchesStereotype(e.getStereotypes(), t)) {
                out.add(bindElement(e));
            }
        }
        for (ModelRelation r : model.getRelations()) {
            if (matchesType(r.getMetaClass(), t) || matchesType(r.getKind(), t)
                    || matchesStereotype(r.getStereotypes(), t)) {
                out.add(bindRelation(r));
            }
        }
        for (ModelDiagram d : model.getDiagrams()) {
            if (matchesType(d.getType(), t) || matchesType(d.getMetaClass(), t)
                    || matchesStereotype(d.getStereotypes(), t)) {
                out.add(bindDiagram(d));
            }
        }
        for (ModelView v : model.getViews()) {
            if (matchesType(v.getKind(), t)) {
                out.add(bindView(v));
            }
        }
        return out;
    }

    private boolean matchesType(String actual, String target) {
        if (blank(actual) || blank(target)) {
            return false;
        }
        if (actual.equalsIgnoreCase(target)) {
            return true;
        }
        int idx = actual.lastIndexOf(':');
        if (idx >= 0 && actual.substring(idx + 1).equalsIgnoreCase(target)) {
            return true;
        }
        // 兜底：包含匹配，如 target=Action 命中 uml:OpaqueAction，target=State 命中 Statechart Diagram
        return actual.toLowerCase(Locale.ROOT).contains(target.toLowerCase(Locale.ROOT));
    }

    private boolean matchesStereotype(List<String> stereotypes, String target) {
        if (stereotypes == null) {
            return false;
        }
        for (String s : stereotypes) {
            if (matchesType(s, target)) {
                return true;
            }
        }
        return false;
    }

    // ================= 对象绑定（DTO -> 脚本可读 Map） =================

    private Map<String, Object> buildContext(ParsedModel model) {
        Map<String, Object> context = new LinkedHashMap<>();
        List<Object> elements = new ArrayList<>();
        for (ModelElement e : model.getElements()) {
            elements.add(bindElement(e));
        }
        List<Object> relations = new ArrayList<>();
        for (ModelRelation r : model.getRelations()) {
            relations.add(bindRelation(r));
        }
        List<Object> diagrams = new ArrayList<>();
        for (ModelDiagram d : model.getDiagrams()) {
            diagrams.add(bindDiagram(d));
        }
        List<Object> views = new ArrayList<>();
        for (ModelView v : model.getViews()) {
            views.add(bindView(v));
        }
        context.put("elements", elements);
        context.put("relations", relations);
        context.put("diagrams", diagrams);
        context.put("views", views);
        return context;
    }

    private Map<String, Object> bindElement(ModelElement e) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (e.getAttributes() != null) {
            m.putAll(e.getAttributes());
        }
        m.put("id", e.getId());
        m.put("metaClass", e.getMetaClass());
        m.put("name", e.getName());
        m.put("qualifiedName", e.getQualifiedName());
        m.put("ownerId", e.getOwnerId());
        m.put("childrenIds", listOrEmpty(e.getChildrenIds()));
        m.put("stereotypes", listOrEmpty(e.getStereotypes()));
        m.put("sourceXPath", e.getSourceXPath());
        return m;
    }

    private Map<String, Object> bindRelation(ModelRelation r) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (r.getAttributes() != null) {
            m.putAll(r.getAttributes());
        }
        m.put("id", r.getId());
        m.put("metaClass", r.getMetaClass());
        m.put("kind", r.getKind());
        m.put("name", r.getName());
        m.put("ownerId", r.getOwnerId());
        m.put("childrenIds", listOrEmpty(r.getChildrenIds()));
        m.put("stereotypes", listOrEmpty(r.getStereotypes()));
        m.put("sourceXPath", r.getSourceXPath());
        m.put("sourceId", r.getSourceId());
        m.put("targetId", r.getTargetId());
        m.put("endIds", listOrEmpty(r.getEndIds()));
        m.put("direction", r.getDirection());
        return m;
    }

    private Map<String, Object> bindDiagram(ModelDiagram d) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (d.getAttributes() != null) {
            m.putAll(d.getAttributes());
        }
        m.put("id", d.getId());
        m.put("metaClass", d.getMetaClass());
        m.put("type", d.getType());
        m.put("name", d.getName());
        m.put("ownerId", d.getOwnerId());
        m.put("childrenIds", listOrEmpty(d.getChildrenIds()));
        m.put("stereotypes", listOrEmpty(d.getStereotypes()));
        m.put("sourceXPath", d.getSourceXPath());
        m.put("imageRef", d.getImageRef());
        m.put("viewIds", listOrEmpty(d.getViewIds()));
        return m;
    }

    private Map<String, Object> bindView(ModelView v) {
        Map<String, Object> m = new LinkedHashMap<>();
        if (v.getStyle() != null) {
            m.putAll(v.getStyle());
        }
        m.put("id", v.getId());
        m.put("diagramId", v.getDiagramId());
        m.put("modelElementId", v.getModelElementId());
        m.put("kind", v.getKind());
        m.put("bounds", v.getBounds());
        m.put("waypoints", v.getWaypoints());
        m.put("label", v.getLabel());
        m.put("sourceXPath", v.getSourceXPath());
        return m;
    }

    // ================= 问题合并与结果组装 =================

    private void mergeParserIssues(ParsedModel model, List<ModelIssue> issues) {
        if (model.getIssues() == null || model.getIssues().isEmpty()) {
            return;
        }
        Set<String> seen = new HashSet<>();
        for (ModelIssue issue : issues) {
            seen.add(dedupKey(issue));
        }
        for (ModelIssue parserIssue : model.getIssues()) {
            if (parserIssue == null) {
                continue;
            }
            if (seen.contains(dedupKey(parserIssue))) {
                continue; // 与内置/规则问题重复，跳过
            }
            parserIssue.setSeverity(normalizeSeverity(parserIssue.getSeverity()));
            if (blank(parserIssue.getSource())) {
                parserIssue.setSource("parser");
            }
            issues.add(parserIssue);
            seen.add(dedupKey(parserIssue));
        }
    }

    private String dedupKey(ModelIssue issue) {
        return (issue.getCode() == null ? "" : issue.getCode())
                + "|" + (issue.getElementId() == null ? "" : issue.getElementId())
                + "|" + (issue.getReferenceId() == null ? "" : issue.getReferenceId());
    }

    private String normalizeSeverity(String severity) {
        if (severity == null) {
            return "WARNING";
        }
        String s = severity.trim().toUpperCase(Locale.ROOT);
        if (s.equals("BLOCKER") || s.equals("ERROR") || s.equals("WARNING") || s.equals("INFO")) {
            return s;
        }
        return "WARNING";
    }

    private ValidationResult buildResult(ParsedModel model, ModelStatistics stats, List<ModelIssue> issues,
                                         int rulesExecuted, int rulesMatched, long startNanos) {
        long dangling = issues.stream()
                .filter(i -> StructuralValidator.CODE_DANGLING_REFERENCE.equals(i.getCode())).count();
        long duplicates = issues.stream()
                .filter(i -> StructuralValidator.CODE_DUPLICATE_ID.equals(i.getCode())).count();
        stats.setDanglingReferences((int) dangling);
        stats.setDuplicateIds((int) duplicates);

        ValidationResult result = new ValidationResult();
        result.setModelId(model.getId());
        result.setIssues(issues);
        result.setStatistics(stats);
        result.setRulesExecuted(rulesExecuted);
        result.setRulesMatched(rulesMatched);
        result.setSeverityCounts(countBySeverity(issues));
        result.setDurationMs((System.nanoTime() - startNanos) / 1_000_000);
        return result;
    }

    private Map<String, Long> countBySeverity(List<ModelIssue> issues) {
        Map<String, Long> counts = new LinkedHashMap<>();
        for (Severity severity : Severity.values()) {
            counts.put(severity.name(), 0L);
        }
        for (ModelIssue issue : issues) {
            String severity = issue.getSeverity() != null ? issue.getSeverity() : "WARNING";
            counts.merge(severity, 1L, Long::sum);
        }
        return counts;
    }

    private ModelIssue ruleViolation(ValidationRule rule, Map<String, Object> element) {
        ModelIssue issue = new ModelIssue();
        issue.setCode(rule.getRuleCode());
        issue.setSeverity(rule.getSeverity().name());
        issue.setMessage(rule.getMessage() != null ? rule.getMessage() : rule.getRuleName());
        issue.setXpath(str(element.get("sourceXPath")));
        issue.setElementId(str(element.get("id")));
        issue.setSource("rule");
        issue.setRuleCode(rule.getRuleCode());
        issue.setRuleName(rule.getRuleName());
        return issue;
    }

    private ModelIssue ruleScriptError(ValidationRule rule, Map<String, Object> element, String detail) {
        ModelIssue issue = new ModelIssue();
        issue.setCode(CODE_RULE_SCRIPT_ERROR);
        issue.setSeverity(Severity.ERROR.name());
        issue.setMessage("规则脚本执行失败 [" + rule.getRuleCode() + "]：" + detail);
        issue.setXpath(str(element.get("sourceXPath")));
        issue.setElementId(str(element.get("id")));
        issue.setSource("rule");
        issue.setRuleCode(rule.getRuleCode());
        issue.setRuleName(rule.getRuleName());
        return issue;
    }

    private void checkInput(ParsedModel model) {
        if (model == null) {
            throw new IllegalArgumentException("校验输入不能为空");
        }
    }

    private List<String> listOrEmpty(List<String> list) {
        return list != null ? list : List.of();
    }

    private String str(Object value) {
        return value == null ? null : String.valueOf(value);
    }

    private boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
