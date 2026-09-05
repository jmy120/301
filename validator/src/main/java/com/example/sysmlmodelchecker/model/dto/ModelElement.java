package com.example.sysmlmodelchecker.model.dto;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * 普通模型元素，对应解析结果中的 elements[]。
 */
public class ModelElement {

    private String id;
    private String metaClass;
    private String name;
    private String qualifiedName;
    private String ownerId;
    private List<String> childrenIds = new ArrayList<>();
    private List<String> stereotypes = new ArrayList<>();
    private Map<String, Object> attributes = new LinkedHashMap<>();
    private String sourceXPath;

    public ModelElement() {
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

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    public String getQualifiedName() {
        return qualifiedName;
    }

    public void setQualifiedName(String qualifiedName) {
        this.qualifiedName = qualifiedName;
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
}
