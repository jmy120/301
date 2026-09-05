package com.example.sysmlmodelchecker.repository;


import com.example.sysmlmodelchecker.model.ModelInfo;
import org.springframework.data.jpa.repository.JpaRepository;


public interface ModelRepository
        extends JpaRepository<ModelInfo,String> {


}