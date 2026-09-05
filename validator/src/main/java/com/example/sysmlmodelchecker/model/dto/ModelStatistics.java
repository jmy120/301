package com.example.sysmlmodelchecker.model.dto;

/**
 * 统计信息，对应解析结果中的 statistics 节点。
 */
public class ModelStatistics {

    private int elements;
    private int relations;
    private int diagrams;
    private int views;
    private int danglingReferences;
    private int duplicateIds;

    public ModelStatistics() {
    }

    public int getElements() {
        return elements;
    }

    public void setElements(int elements) {
        this.elements = elements;
    }

    public int getRelations() {
        return relations;
    }

    public void setRelations(int relations) {
        this.relations = relations;
    }

    public int getDiagrams() {
        return diagrams;
    }

    public void setDiagrams(int diagrams) {
        this.diagrams = diagrams;
    }

    public int getViews() {
        return views;
    }

    public void setViews(int views) {
        this.views = views;
    }

    public int getDanglingReferences() {
        return danglingReferences;
    }

    public void setDanglingReferences(int danglingReferences) {
        this.danglingReferences = danglingReferences;
    }

    public int getDuplicateIds() {
        return duplicateIds;
    }

    public void setDuplicateIds(int duplicateIds) {
        this.duplicateIds = duplicateIds;
    }
}
