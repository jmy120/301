package com.example.sysmlmodelchecker.model.dto;

import java.util.ArrayList;
import java.util.List;

/**
 * 解析器输出的完整模型结构，对应学长解析模块产出的 JSON。
 * 校验模块以该结构为输入。
 */
public class ParsedModel {

    private String id;
    private SourceInfo source;
    private List<ModelElement> elements = new ArrayList<>();
    private List<ModelRelation> relations = new ArrayList<>();
    private List<ModelDiagram> diagrams = new ArrayList<>();
    private List<ModelView> views = new ArrayList<>();
    private List<ModelIssue> issues = new ArrayList<>();
    private ModelStatistics statistics;

    public ParsedModel() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public SourceInfo getSource() {
        return source;
    }

    public void setSource(SourceInfo source) {
        this.source = source;
    }

    public List<ModelElement> getElements() {
        return elements;
    }

    public void setElements(List<ModelElement> elements) {
        this.elements = elements != null ? elements : new ArrayList<>();
    }

    public List<ModelRelation> getRelations() {
        return relations;
    }

    public void setRelations(List<ModelRelation> relations) {
        this.relations = relations != null ? relations : new ArrayList<>();
    }

    public List<ModelDiagram> getDiagrams() {
        return diagrams;
    }

    public void setDiagrams(List<ModelDiagram> diagrams) {
        this.diagrams = diagrams != null ? diagrams : new ArrayList<>();
    }

    public List<ModelView> getViews() {
        return views;
    }

    public void setViews(List<ModelView> views) {
        this.views = views != null ? views : new ArrayList<>();
    }

    public List<ModelIssue> getIssues() {
        return issues;
    }

    public void setIssues(List<ModelIssue> issues) {
        this.issues = issues != null ? issues : new ArrayList<>();
    }

    public ModelStatistics getStatistics() {
        return statistics;
    }

    public void setStatistics(ModelStatistics statistics) {
        this.statistics = statistics;
    }
}
