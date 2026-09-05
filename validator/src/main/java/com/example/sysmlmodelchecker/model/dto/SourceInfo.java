package com.example.sysmlmodelchecker.model.dto;

/**
 * 源文件信息，对应解析结果中的 source 节点。
 */
public class SourceInfo {

    private String fileName;
    private String encoding;
    private String xmiVersion;
    private String productVersion;

    public SourceInfo() {
    }

    public String getFileName() {
        return fileName;
    }

    public void setFileName(String fileName) {
        this.fileName = fileName;
    }

    public String getEncoding() {
        return encoding;
    }

    public void setEncoding(String encoding) {
        this.encoding = encoding;
    }

    public String getXmiVersion() {
        return xmiVersion;
    }

    public void setXmiVersion(String xmiVersion) {
        this.xmiVersion = xmiVersion;
    }

    public String getProductVersion() {
        return productVersion;
    }

    public void setProductVersion(String productVersion) {
        this.productVersion = productVersion;
    }
}
