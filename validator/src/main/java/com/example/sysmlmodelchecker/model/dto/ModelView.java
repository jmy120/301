package com.example.sysmlmodelchecker.model.dto;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 图中的图形/连线视图，对应解析结果中的 views[]。
 */
public class ModelView {

    private String id;
    private String diagramId;
    private String modelElementId;
    private String kind;
    private String bounds;
    private String waypoints;
    private String label;
    private Map<String, Object> style = new LinkedHashMap<>();
    private String sourceXPath;

    public ModelView() {
    }

    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getDiagramId() {
        return diagramId;
    }

    public void setDiagramId(String diagramId) {
        this.diagramId = diagramId;
    }

    public String getModelElementId() {
        return modelElementId;
    }

    public void setModelElementId(String modelElementId) {
        this.modelElementId = modelElementId;
    }

    public String getKind() {
        return kind;
    }

    public void setKind(String kind) {
        this.kind = kind;
    }

    public String getBounds() {
        return bounds;
    }

    public void setBounds(String bounds) {
        this.bounds = bounds;
    }

    public String getWaypoints() {
        return waypoints;
    }

    public void setWaypoints(String waypoints) {
        this.waypoints = waypoints;
    }

    public String getLabel() {
        return label;
    }

    public void setLabel(String label) {
        this.label = label;
    }

    public Map<String, Object> getStyle() {
        return style;
    }

    public void setStyle(Map<String, Object> style) {
        this.style = style != null ? style : new LinkedHashMap<>();
    }

    public String getSourceXPath() {
        return sourceXPath;
    }

    public void setSourceXPath(String sourceXPath) {
        this.sourceXPath = sourceXPath;
    }
}
