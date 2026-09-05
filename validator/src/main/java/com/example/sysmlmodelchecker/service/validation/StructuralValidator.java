package com.example.sysmlmodelchecker.service.validation;

import com.example.sysmlmodelchecker.model.dto.ModelDiagram;
import com.example.sysmlmodelchecker.model.dto.ModelElement;
import com.example.sysmlmodelchecker.model.dto.ModelIssue;
import com.example.sysmlmodelchecker.model.dto.ModelRelation;
import com.example.sysmlmodelchecker.model.dto.ModelStatistics;
import com.example.sysmlmodelchecker.model.dto.ModelView;
import com.example.sysmlmodelchecker.model.dto.ParsedModel;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 内置结构校验：不依赖数据库规则，直接对解析结果做一致性检查，包括：
 * 重复ID、悬空引用（关系端点/父引用/图-视图/视图-元素）、关系端点缺失、
 * 父子引用一致性。
 */
public class StructuralValidator {

    public static final String CODE_DANGLING_REFERENCE = "DANGLING_REFERENCE";
    public static final String CODE_DUPLICATE_ID = "DUPLICATE_ID";
    public static final String CODE_RELATION_ENDPOINT_MISSING = "RELATION_ENDPOINT_MISSING";
    public static final String CODE_PARENT_CHILD_MISMATCH = "PARENT_CHILD_MISMATCH";

    /** 结构校验结果：问题列表 + 统计信息 */
    public static final class StructuralResult {
        public final List<ModelIssue> issues = new java.util.ArrayList<>();
        public final ModelStatistics statistics = new ModelStatistics();
    }

    public StructuralResult run(ParsedModel model) {
        StructuralResult result = new StructuralResult();
        ModelStatistics stats = result.statistics;
        List<ModelIssue> issues = result.issues;

        stats.setElements(model.getElements().size());
        stats.setRelations(model.getRelations().size());
        stats.setDiagrams(model.getDiagrams().size());
        stats.setViews(model.getViews().size());

        // ---------- 建立索引 ----------
        Map<String, ModelElement> elementById = new LinkedHashMap<>();
        Map<String, ModelRelation> relationById = new LinkedHashMap<>();
        Map<String, ModelDiagram> diagramById = new LinkedHashMap<>();
        Map<String, ModelView> viewById = new LinkedHashMap<>();
        Map<String, Integer> idCount = new LinkedHashMap<>();

        for (ModelElement e : model.getElements()) {
            if (blank(e.getId())) {
                continue;
            }
            if (elementById.putIfAbsent(e.getId(), e) != null) {
            }
            idCount.merge(e.getId(), 1, Integer::sum);
        }
        for (ModelRelation r : model.getRelations()) {
            if (blank(r.getId())) {
                continue;
            }
            relationById.putIfAbsent(r.getId(), r);
            idCount.merge(r.getId(), 1, Integer::sum);
            if (idCount.get(r.getId()) > 1) {
            }
        }
        for (ModelDiagram d : model.getDiagrams()) {
            if (blank(d.getId())) {
                continue;
            }
            diagramById.putIfAbsent(d.getId(), d);
            idCount.merge(d.getId(), 1, Integer::sum);
            if (idCount.get(d.getId()) > 1) {
            }
        }
        for (ModelView v : model.getViews()) {
            if (blank(v.getId())) {
                continue;
            }
            viewById.putIfAbsent(v.getId(), v);
            idCount.merge(v.getId(), 1, Integer::sum);
            if (idCount.get(v.getId()) > 1) {
            }
        }

        // ---------- 重复ID ----------
        int duplicateCount = 0;
        for (Map.Entry<String, Integer> entry : idCount.entrySet()) {
            if (entry.getValue() > 1) {
                duplicateCount++;
                issues.add(issue(CODE_DUPLICATE_ID, "ERROR",
                        "ID重复出现 " + entry.getValue() + " 次：" + entry.getKey(),
                        null, entry.getKey(), entry.getKey(), "builtin"));
            }
        }
        stats.setDuplicateIds(duplicateCount);

        // ---------- 悬空引用 ----------
        Map<String, String> elementAndRelationIds = new HashMap<>();
        for (String eid : elementById.keySet()) {
            elementAndRelationIds.put(eid, "element");
        }
        for (String rid : relationById.keySet()) {
            elementAndRelationIds.put(rid, "relation");
        }

        for (ModelRelation r : model.getRelations()) {
            checkReference(issues, r.getId(), r.getSourceId(), "关系起点", r.getSourceXPath(),
                    elementAndRelationIds);
            checkReference(issues, r.getId(), r.getTargetId(), "关系终点", r.getSourceXPath(),
                    elementAndRelationIds);
            for (String endId : r.getEndIds()) {
                checkReference(issues, r.getId(), endId, "关系端点", r.getSourceXPath(),
                        elementAndRelationIds);
            }
        }

        for (ModelElement e : model.getElements()) {
            checkReference(issues, e.getId(), e.getOwnerId(), "父元素", e.getSourceXPath(), elementById);
            for (String childId : e.getChildrenIds()) {
                checkReference(issues, e.getId(), childId, "子元素", e.getSourceXPath(), elementById);
            }
        }

        for (ModelDiagram d : model.getDiagrams()) {
            checkReference(issues, d.getId(), d.getOwnerId(), "所属包", d.getSourceXPath(), elementById);
            for (String viewId : d.getViewIds()) {
                checkReference(issues, d.getId(), viewId, "图视图", d.getSourceXPath(), viewById);
            }
        }

        for (ModelView v : model.getViews()) {
            checkReference(issues, v.getId(), v.getDiagramId(), "所属图", v.getSourceXPath(), diagramById);
            checkReference(issues, v.getId(), v.getModelElementId(), "模型元素", v.getSourceXPath(), elementAndRelationIds);
        }

        int danglingCount = 0;
        for (ModelIssue issue : issues) {
            if (CODE_DANGLING_REFERENCE.equals(issue.getCode())) {
                danglingCount++;
            }
        }
        stats.setDanglingReferences(danglingCount);

        // ---------- 关系端点缺失 ----------
        for (ModelRelation r : model.getRelations()) {
            boolean noSourceTarget = blank(r.getSourceId()) && blank(r.getTargetId());
            boolean noEnds = r.getEndIds() == null || r.getEndIds().isEmpty();
            if (noSourceTarget && noEnds) {
                issues.add(issue(CODE_RELATION_ENDPOINT_MISSING, "ERROR",
                        "关系缺少起点/终点：" + display(r.getId(), r.getName()),
                        r.getSourceXPath(), r.getId(), null, "builtin"));
            }
        }

        // ---------- 父子引用一致性 ----------
        for (ModelElement e : model.getElements()) {
            for (String childId : e.getChildrenIds()) {
                ModelElement child = elementById.get(childId);
                if (child != null && !e.getId().equals(child.getOwnerId())) {
                    issues.add(issue(CODE_PARENT_CHILD_MISMATCH, "WARNING",
                            "父元素 " + e.getId() + " 声明了子元素 " + childId
                                    + "，但该子元素的 ownerId 为 " + child.getOwnerId(),
                            e.getSourceXPath(), e.getId(), childId, "builtin"));
                }
            }
        }
        for (ModelElement e : model.getElements()) {
            if (blank(e.getOwnerId())) {
                continue;
            }
            ModelElement parent = elementById.get(e.getOwnerId());
            if (parent != null && !parent.getChildrenIds().contains(e.getId())) {
                issues.add(issue(CODE_PARENT_CHILD_MISMATCH, "WARNING",
                        "元素 " + e.getId() + " 的 ownerId 指向 " + e.getOwnerId()
                                + "，但父元素未将其列入 childrenIds",
                        e.getSourceXPath(), e.getId(), e.getOwnerId(), "builtin"));
            }
        }

        return result;
    }

    private void checkReference(List<ModelIssue> issues, String elementId, String referenceId,
                                String role, String xpath, Map<String, ?> index) {
        if (blank(referenceId)) {
            return;
        }
        if (!index.containsKey(referenceId)) {
            issues.add(issue(CODE_DANGLING_REFERENCE, "ERROR",
                    role + "引用不存在：" + referenceId, xpath, elementId, referenceId, "builtin"));
        }
    }

    private ModelIssue issue(String code, String severity, String message, String xpath,
                             String elementId, String referenceId, String source) {
        ModelIssue issue = new ModelIssue();
        issue.setCode(code);
        issue.setSeverity(severity);
        issue.setMessage(message);
        issue.setXpath(xpath);
        issue.setElementId(elementId);
        issue.setReferenceId(referenceId);
        issue.setSource(source);
        return issue;
    }

    private String display(String id, String name) {
        if (!blank(name)) {
            return name + " (" + id + ")";
        }
        return id;
    }

    private boolean blank(String s) {
        return s == null || s.isBlank();
    }
}
