package com.example.sysmlmodelchecker.service;


import com.example.sysmlmodelchecker.model.ModelInfo;
import com.example.sysmlmodelchecker.repository.ModelRepository;

import org.springframework.stereotype.Service;

import java.util.List;


@Service
public class ModelService {


    private final ModelRepository repository;



    public ModelService(ModelRepository repository){

        this.repository = repository;

    }



    // 保存模型

    public void saveModel(ModelInfo modelInfo){

        repository.save(modelInfo);

    }



    // 查询全部

    public List<ModelInfo> findAll(){

        return repository.findAll();

    }



    // 根据ID查询

    public ModelInfo findById(String id){

        return repository.findById(id)
                .orElse(null);

    }


}