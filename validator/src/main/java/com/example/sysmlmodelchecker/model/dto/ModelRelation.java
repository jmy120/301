package com.example.sysmlmodelchecker.model.dto;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 模型关系，对应解析结果中的 relations[]。
 */
public class ModelRelation {

    private String id;
    private String metaClass;
    private String kind;
    private String name;
    private String ownerId;
    private List<String> childrenIds = new ArrayList<>();
    private List<String> stereotypes = new ArrayList<>();
    private Map<String, Object> attributes = new LinkedHashMap<>();
    private String sourceXPath;
    private String sourceId;
    private String targetId;
    private List<String> endIds = new ArrayList<>();
    private String direction;

    public ModelRelation() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getMetaClass() {
        return metaClass;
    }

    public void setMetaClass(String metaClass) {
        this.metaClass = metaClass;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getOwnerId() {
        return ownerId;
    }

    public void setOwnerId(String ownerId) {
        this.ownerId = ownerId;
    }

    public List<String> getChildrenIds() {
        return childrenIds;
    }

    public void setChildrenIds(List<String> childrenIds) {
        this.childrenIds = childrenIds != null ? childrenIds : new ArrayList<>();
    }

    public List<String> getStereotypes() {
        return stereotypes;
    }

    public void setStereotypes(List<String> stereotypes) {
        this.stereotypes = stereotypes != null ? stereotypes : new ArrayList<>();
    }

    public Map<String, Object> getAttributes() {
        return attributes;
    }

    public void setAttributes(Map<String, Object> attributes) {
        this.attributes = attributes != null ? attributes : new LinkedHashMap<>();
    }

    public String getSourceXPath() {
        return sourceXPath;
    }

    public void setSourceXPath(String sourceXPath) {
        this.sourceXPath = sourceXPath;
    }

    public String getSourceId() {
        return sourceId;
    }

    public void setSourceId(String sourceId) {
        this.sourceId = sourceId;
    }

    public String getTargetId() {
        return targetId;
    }

    public void setTargetId(String targetId) {
        this.targetId = targetId;
    }

    public List<String> getEndIds() {
        return endIds;
    }

    public void setEndIds(List<String> endIds) {
        this.endIds = endIds != null ? endIds : new ArrayList<>();
    }

    public String getDirection() {
        return direction;
    }

    public void setDirection(String direction) {
        this.direction = direction;
    }
}
