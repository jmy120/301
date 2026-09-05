package com.example.sysmlmodelchecker.config;

import com.example.sysmlmodelchecker.service.RuleService;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;

@Component
public class RuleDataInitializer implements ApplicationRunner {

    private final RuleService ruleService;

    public RuleDataInitializer(RuleService ruleService) {
        this.ruleService = ruleService;
    }

    @Override
    public void run(ApplicationArguments args) {
        ruleService.seedDefaults();
    }
}
