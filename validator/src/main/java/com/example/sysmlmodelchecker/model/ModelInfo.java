package com.example.sysmlmodelchecker.model;


import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;


@Entity
@Table(name="model_info")
public class ModelInfo {


    @Id
    private String modelId;


    private String fileName;


    private String modelName;


    private String version;


    private String uploadTime;


    private String status;


    private String filePath;



    public ModelInfo(){

    }



    public ModelInfo(String modelId,
                     String fileName,
                     String modelName,
                     String version,
                     String uploadTime,
                     String status,
                     String filePath){

        this.modelId=modelId;
        this.fileName=fileName;
        this.modelName=modelName;
        this.version=version;
        this.uploadTime=uploadTime;
        this.status=status;
        this.filePath=filePath;

    }




    public String getModelId(){
        return modelId;
    }


    public void setModelId(String modelId){
        this.modelId=modelId;
    }



    public String getFileName(){
        return fileName;
    }


    public void setFileName(String fileName){
        this.fileName=fileName;
    }




    public String getModelName(){
        return modelName;
    }


    public void setModelName(String modelName){
        this.modelName=modelName;
    }




    public String getVersion(){
        return version;
    }


    public void setVersion(String version){
        this.version=version;
    }



    public String getUploadTime(){
        return uploadTime;
    }


    public void setUploadTime(String uploadTime){
        this.uploadTime=uploadTime;
    }



    public String getStatus(){
        return status;
    }


    public void setStatus(String status){
        this.status=status;
    }



    public String getFilePath(){
        return filePath;
    }


    public void setFilePath(String filePath){
        this.filePath=filePath;
    }


}