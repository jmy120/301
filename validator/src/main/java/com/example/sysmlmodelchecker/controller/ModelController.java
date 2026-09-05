package com.example.sysmlmodelchecker.controller;


import com.example.sysmlmodelchecker.model.ModelInfo;
import com.example.sysmlmodelchecker.model.Result;
import com.example.sysmlmodelchecker.service.ModelService;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;


import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.UUID;
import java.io.File;


@RestController
@RequestMapping("/api/models")
public class ModelController {



    @Autowired
    private ModelService modelService;



    /**
     * 测试接口
     */
    @GetMapping("/test")
    public String test(){

        return "SysML模型校验系统运行正常";

    }




    /**
     * 上传SysML模型
     */
    @PostMapping("/upload")
    public Result upload(
            @RequestParam("file") MultipartFile file
    ){


        try {


            // 文件名
            String originalName =
                    file.getOriginalFilename();



            if(originalName==null ||
                    !originalName.toLowerCase().endsWith(".xml")){


                return Result.error(
                        "只支持XML文件"
                );

            }



            // 创建保存目录

            String uploadDir =
                    System.getProperty("user.dir")
                            +"\\uploads\\";



            File dir=new File(uploadDir);


            if(!dir.exists()){

                dir.mkdirs();

            }



            // 防止重名

            String newFileName =
                    UUID.randomUUID()
                            +"_"+originalName;



            // 文件完整路径

            String filePath =
                    uploadDir+newFileName;



            // 保存文件

            File saveFile =
                    new File(filePath);


            file.transferTo(saveFile);





            // 模型编号

            String modelId =
                    UUID.randomUUID()
                            .toString();




            // 模型名称

            String modelName =
                    originalName.substring(
                            0,
                            originalName.lastIndexOf(".")
                    );




            String uploadTime =
                    LocalDateTime.now()
                            .format(
                                    DateTimeFormatter.ofPattern(
                                            "yyyy-MM-dd HH:mm:ss")
                            );





            ModelInfo info =
                    new ModelInfo(

                            modelId,

                            originalName,

                            modelName,

                            "未知",

                            uploadTime,

                            "已保存",

                            filePath

                    );




            modelService.saveModel(info);




            return Result.success(
                    info,
                    "文件上传成功"
            );



        }catch(Exception e){


            e.printStackTrace();


            return Result.error(
                    e.getMessage()
            );

        }

    }




    /**
     * 查询模型列表
     */
    @GetMapping
    public Result<List<ModelInfo>> list(){


        return Result.success(
                modelService.findAll(),
                "查询成功"
        );

    }




    /**
     * 查询模型详情
     */
    @GetMapping("/{id}")
    public Result<ModelInfo> detail(
            @PathVariable String id
    ){


        ModelInfo modelInfo =
                modelService.findById(id);



        if(modelInfo == null){


            return Result.error(
                    "模型不存在"
            );

        }



        return Result.success(
                modelInfo,
                "查询成功"
        );


    }



}