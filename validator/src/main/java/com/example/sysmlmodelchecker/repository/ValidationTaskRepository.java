package com.example.sysmlmodelchecker.repository;

import com.example.sysmlmodelchecker.model.TaskStatus;
import com.example.sysmlmodelchecker.model.ValidationTask;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ValidationTaskRepository extends JpaRepository<ValidationTask, Long> {

    @Query("""
            SELECT t FROM ValidationTask t
            WHERE (:status IS NULL OR t.status = :status)
              AND (:keyword IS NULL
                   OR t.taskName LIKE %:keyword%
                   OR t.modelName LIKE %:keyword%)
            ORDER BY t.createTime DESC, t.id DESC
            """)
    Page<ValidationTask> search(@Param("status") TaskStatus status,
                                @Param("keyword") String keyword,
                                Pageable pageable);
}