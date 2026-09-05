package com.example.sysmlmodelchecker.repository;

import com.example.sysmlmodelchecker.model.Severity;
import com.example.sysmlmodelchecker.model.ValidationRule;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface RuleRepository extends JpaRepository<ValidationRule, Long> {

    boolean existsByRuleCode(String ruleCode);

    boolean existsByRuleCodeAndIdNot(String ruleCode, Long id);

    @Query("""
            SELECT r FROM ValidationRule r
            WHERE (:keyword IS NULL
                   OR r.ruleCode LIKE %:keyword%
                   OR r.ruleName LIKE %:keyword%
                   OR r.targetType LIKE %:keyword%
                   OR r.message LIKE %:keyword%)
              AND (:targetType IS NULL OR r.targetType = :targetType)
              AND (:severity IS NULL OR r.severity = :severity)
              AND (:enabled IS NULL OR r.enabled = :enabled)
            ORDER BY r.ruleCode ASC
            """)
    Page<ValidationRule> search(@Param("keyword") String keyword,
                                @Param("targetType") String targetType,
                                @Param("severity") Severity severity,
                                @Param("enabled") Boolean enabled,
                                Pageable pageable);

    @Query("SELECT DISTINCT r.targetType FROM ValidationRule r ORDER BY r.targetType ASC")
    List<String> findDistinctTargetTypes();
}
