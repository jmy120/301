package com.example.sysmlmodelchecker.service;

import com.example.sysmlmodelchecker.model.Severity;
import com.example.sysmlmodelchecker.model.ValidationRule;
import com.example.sysmlmodelchecker.repository.RuleRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class RuleService {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;

    private final RuleRepository repository;

    public RuleService(RuleRepository repository) {
        this.repository = repository;
    }

    public ValidationRule create(ValidationRule rule) {
        validate(rule);
        if (repository.existsByRuleCode(rule.getRuleCode())) {
            throw new IllegalArgumentException("规则编号已存在：" + rule.getRuleCode());
        }
        rule.setId(null);
        rule.setCreateTime(LocalDateTime.now());
        rule.setUpdateTime(LocalDateTime.now());
        return repository.save(rule);
    }

    public ValidationRule update(Long id, ValidationRule rule) {
        ValidationRule existing = findById(id);
        validate(rule);
        if (!rule.getRuleCode().equals(existing.getRuleCode())
                && repository.existsByRuleCodeAndIdNot(rule.getRuleCode(), id)) {
            throw new IllegalArgumentException("规则编号已存在：" + rule.getRuleCode());
        }
        existing.setRuleCode(rule.getRuleCode());
        existing.setRuleName(rule.getRuleName());
        existing.setScope(rule.getScope());
        existing.setTargetType(rule.getTargetType());
        existing.setCondition(rule.getCondition());
        existing.setSeverity(rule.getSeverity());
        existing.setMessage(rule.getMessage());
        existing.setFixSuggestion(rule.getFixSuggestion());
        existing.setRuleVersion(rule.getRuleVersion());
        existing.setScript(rule.getScript());
        existing.setEnabled(rule.isEnabled());
        existing.setUpdateTime(LocalDateTime.now());
        return repository.save(existing);
    }

    public void delete(Long id) {
        ValidationRule rule = findById(id);
        repository.delete(rule);
    }

    public ValidationRule findById(Long id) {
        return repository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("规则不存在：" + id));
    }

    public Page<ValidationRule> search(String keyword, String targetType, Severity severity,
                                       Boolean enabled, int page, int size) {
        int pageSize = size <= 0 ? DEFAULT_PAGE_SIZE : Math.min(size, MAX_PAGE_SIZE);
        PageRequest pageable = PageRequest.of(Math.max(page, 0), pageSize,
                Sort.by("ruleCode").ascending());
        return repository.search(blankToNull(keyword), blankToNull(targetType),
                severity, enabled, pageable);
    }

    public ValidationRule setEnabled(Long id, boolean enabled) {
        ValidationRule rule = findById(id);
        rule.setEnabled(enabled);
        rule.setUpdateTime(LocalDateTime.now());
        return repository.save(rule);
    }

    public List<String> listTargetTypes() {
        return repository.findDistinctTargetTypes();
    }

    public int seedDefaults() {
        int added = 0;
        for (ValidationRule rule : defaultRules()) {
            if (!repository.existsByRuleCode(rule.getRuleCode())) {
                repository.save(rule);
                added++;
            }
        }
        return added;
    }

    private void validate(ValidationRule rule) {
        if (rule.getRuleCode() == null || rule.getRuleCode().isBlank()) {
            throw new IllegalArgumentException("规则编号不能为空");
        }
        if (rule.getRuleName() == null || rule.getRuleName().isBlank()) {
            throw new IllegalArgumentException("规则名称不能为空");
        }
        if (rule.getTargetType() == null || rule.getTargetType().isBlank()) {
            throw new IllegalArgumentException("检测对象不能为空");
        }
        if (rule.getSeverity() == null) {
            throw new IllegalArgumentException("严重程度不能为空");
        }
        if (rule.getScript() == null || rule.getScript().isBlank()) {
            throw new IllegalArgumentException("求解脚本不能为空");
        }
    }

    private String blankToNull(String value) {
        return (value == null || value.isBlank()) ? null : value.trim();
    }

    /**
     * 内置规则库（40 条）：GEN/STR/INT 通用规则 +
     * 方案 3.1 总体要求、3.2 模块定义图、3.3 内部模块图、
     * 3.4 用例图、3.5 活动图、3.6 顺序图、3.7 状态机图。
     * 幂等初始化（只补充缺失编号），可在规则页面停用/修改。
     */
    private List<ValidationRule> defaultRules() {
        List<ValidationRule> rules = new ArrayList<>();

        rules.add(buildRule("GEN-001", "Block名称不能为空", "模型", "Block",
                "name不能为空", Severity.ERROR,
                "Block元素必须具有有效名称",
                "为Block元素补充有效名称",
                """
                function main(element) {
                  if (element.name == null || element.name.trim() === "") {
                    return false;
                  }
                  return true;
                }
                """));

        rules.add(buildRule("GEN-002", "模型元素名称不能重复", "模型", "Model Element",
                "名称唯一", Severity.ERROR,
                "模型内不允许存在同名元素",
                "修改重复元素的名称",
                """
                function main(element, context) {
                  if (element.name == null || element.name.trim() === "") {
                    return true;
                  }
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < elements.length; i++) {
                    if (elements[i].id !== element.id && elements[i].name === element.name) {
                      return false;
                    }
                  }
                  return true;
                }
                """));

        rules.add(buildRule("STR-001", "Connector必须连接有效元素", "模型", "Connector",
                "连接端对象存在", Severity.ERROR,
                "Connector的sourceId/targetId必须指向存在的元素",
                "检查并修复Connector端点引用",
                """
                function main(element, context) {
                  if (element.sourceId == null || element.targetId == null) {
                    return false;
                  }
                  var elements = context && context.elements ? context.elements : [];
                  var hasSource = false;
                  var hasTarget = false;
                  for (var i = 0; i < elements.length; i++) {
                    if (elements[i].id === element.sourceId) { hasSource = true; }
                    if (elements[i].id === element.targetId) { hasTarget = true; }
                  }
                  return hasSource && hasTarget;
                }
                """));

        rules.add(buildRule("STR-002", "Port必须定义类型", "模型", "Port",
                "type不能为空", Severity.WARNING,
                "Port元素必须指定类型",
                "为Port指定类型",
                """
                function main(element) {
                  if (element.type == null || element.type === "") {
                    return false;
                  }
                  return true;
                }
                """));

        rules.add(buildRule("STR-003", "Part属性必须指定类型", "模型", "Property",
                "type不能为空", Severity.ERROR,
                "Part/Property属性必须指定类型",
                "为属性指定类型",
                """
                function main(element) {
                  if (element.type == null || element.type === "") {
                    return false;
                  }
                  return true;
                }
                """));
        rules.add(buildRule("INT-001", "接口方向必须明确", "模型", "Port",
                "direction已定义", Severity.WARNING,
                "Port接口方向必须明确",
                "为Port定义direction属性",
                """
                function main(element) {
                  if (element.direction == null || element.direction === "") {
                    return false;
                  }
                  return true;
                }
                """));

        
        
        
        
        /* ================= 3.1 总体要求 ================= */

        rules.add(buildRule("GEN-003", "Block必须有注释", "模型", "Block",
                "documentation/description不能为空", Severity.WARNING,
                "Block元素建议补充文档注释（英文名称、中文标签、中文描述）",
                "为Block元素补充文档注释",
                """
                function main(element) {
                  var doc = element.documentation || element.description || "";
                  if (doc.trim() !== "") {
                    return true;
                  }
                  return false;
                }
                """));

        rules.add(buildRule("GEN-010", "单张图元素数量不宜过多", "图", "Diagram",
                "视图数不超过30", Severity.WARNING,
                "单张图视图数量过多，建议按A4可读性要求进行层次拆分，用多张图表达",
                "将复杂图拆分为多张子图",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId === element.id) { n++; }
                  }
                  return n <= 30;
                }
                """));

                
        
        rules.add(buildRule("GEN-014", "图中连线应为直线或直角", "图", "Diagram",
                "连线折点水平/垂直", Severity.WARNING,
                "图中存在非水平/垂直的斜线连线，所有线条应为直线或直角转弯线",
                "将连线调整为直线或直角转弯线",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var total = 0;
                  var bad = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var wp = views[i].waypoints;
                    if (wp == null || wp.trim() === "") { continue; }
                    var pts = wp.split(",");
                    if (pts.length < 4) { continue; }
                    total++;
                    var px = pts[0] * 1;
                    var py = pts[1] * 1;
                    var ok = true;
                    for (var j = 2; j < pts.length - 1; j += 2) {
                      var cx = pts[j] * 1;
                      var cy = pts[j + 1] * 1;
                      if (px != cx && py != cy) { ok = false; }
                      px = cx;
                      py = cy;
                    }
                    if (!ok) { bad++; }
                  }
                  if (total == 0) { return true; }
                  return bad == 0;
                }
                """));

        /* ================= 3.2 模块定义图 BDD ================= */

        rules.add(buildRule("BDD-001", "BDD应包含模块要素", "模块定义图", "Block Definition Diagram",
                "图中存在Block", Severity.ERROR,
                "模块定义图缺少模块（Block）要素",
                "在图中补充模块并按规定层级分解",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Class") >= 0) { n++; break; }
                    }
                  }
                  return n > 0;
                }
                """));

        rules.add(buildRule("BDD-002", "BDD应包含连接关系", "模块定义图", "Block Definition Diagram",
                "图中存在关系视图", Severity.ERROR,
                "模块定义图缺少连接（表示块和子块之间的关联）",
                "在图中补充组合/关联等连接关系",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var relations = context && context.relations ? context.relations : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < relations.length; j++) {
                      if (relations[j].id === meId) { n++; break; }
                    }
                  }
                  return n > 0;
                }
                """));

        rules.add(buildRule("BDD-003", "Block中不应出现属性/操作/端口", "模块定义图", "Block",
                "子元素不含Property/Operation/Port", Severity.WARNING,
                "Block下出现了属性、操作或端口，模块定义图中不应出现，分解应采用组合关系",
                "移除块内属性/操作/端口，改用组合关系表达分解",
                """
                function main(element, context) {
                  var kids = element.childrenIds || [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < kids.length; i++) {
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== kids[i]) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Property") >= 0 || mc.indexOf("Operation") >= 0 || mc.indexOf("Port") >= 0) {
                        return false;
                      }
                    }
                  }
                  return true;
                }
                """));

        rules.add(buildRule("BDD-004", "Block不应嵌套在另一个Block中", "模块定义图", "Block",
                "父元素不是Block", Severity.ERROR,
                "Block被嵌套在另一个Block中，块的分解应采用组合关系，不应出现一个块在另一个块中的情况",
                "改用组合关系表达块分解",
                """
                function main(element, context) {
                  var ownerId = element.ownerId || "";
                  if (ownerId === "") { return true; }
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < elements.length; i++) {
                    if (elements[i].id !== ownerId) { continue; }
                    var mc = elements[i].metaClass || "";
                    if (mc.indexOf("Class") >= 0 && mc.indexOf("Opaque") < 0) { return false; }
                  }
                  return true;
                }
                """));

        rules.add(buildRule("BDD-005", "BDD命名规范BDD_系统名", "模块定义图", "Block Definition Diagram",
                "名称以BDD_开头", Severity.WARNING,
                "模块定义图命名不符合规范 BDD_<系统名>（如 BDD_AirplanePlatform）",
                "按 BDD_<系统名> 重命名图",
                """
                function main(element) {
                  if (element.viewIds == null) { return true; }
                  var name = element.name || "";
                  var upper = name.toUpperCase();
                  return upper.startsWith("BDD_");
                }
                """));

        /* ================= 3.3 内部模块图 IBD ================= */

        rules.add(buildRule("IBD-001", "IBD应包含标准端口", "内部块图", "Internal Block Diagram",
                "图中存在Port", Severity.ERROR,
                "内部块图缺少标准端口要素",
                "为部件补充带名称的交互端口",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Port") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("IBD-002", "IBD应包含连接线", "内部块图", "Internal Block Diagram",
                "图中存在连接线", Severity.ERROR,
                "内部块图缺少连接线（信息流经过接口和两个端口之间的连接）",
                "在端口之间补充连接线",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var relations = context && context.relations ? context.relations : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < relations.length; j++) {
                      if (relations[j].id === meId) { n++; break; }
                    }
                  }
                  return n > 0;
                }
                """));
        rules.add(buildRule("IBD-003", "连接应通过端口建立", "内部块图", "Connector",
                "连接线两端是Port", Severity.WARNING,
                "连接线未通过端口连接，所有部件都应通过端口和定义好的接口进行通讯",
                "在部件之间建立端口后再连接",
                """
                function main(element, context) {
                  var sourceId = element.sourceId || "";
                  var targetId = element.targetId || "";
                  if (sourceId === "" || targetId === "") { return true; }
                  var elements = context && context.elements ? context.elements : [];
                  var sOk = false;
                  var tOk = false;
                  for (var i = 0; i < elements.length; i++) {
                    if (elements[i].id === sourceId) {
                      var mc1 = elements[i].metaClass || "";
                      if (mc1.indexOf("Port") >= 0) { sOk = true; }
                    }
                    if (elements[i].id === targetId) {
                      var mc2 = elements[i].metaClass || "";
                      if (mc2.indexOf("Port") >= 0) { tOk = true; }
                    }
                  }
                  return sOk && tOk;
                }
                """));

        rules.add(buildRule("IBD-004", "IBD命名规范IBD_用例名", "内部块图", "Internal Block Diagram",
                "名称以IBD_开头", Severity.WARNING,
                "内部块图命名不符合规范 IBD_<用例名>（如 IBD_ucMissionPrepare）",
                "按 IBD_<用例名> 重命名图",
                """
                function main(element) {
                  if (element.viewIds == null) { return true; }
                  var name = element.name || "";
                  var upper = name.toUpperCase();
                  return upper.startsWith("IBD_");
                }
                """));

        rules.add(buildRule("IBD-005", "部件默认命名its块名", "内部块图", "Property",
                "Part构造型的name以its开头", Severity.WARNING,
                "部件名称不符合默认命名 its<块名>",
                "将部件重命名为 its<块名>",
                """
                function main(element) {
                  var st = element.stereotypes || [];
                  var isPart = false;
                  for (var i = 0; i < st.length; i++) {
                    if (st[i] === "Part" || st[i] === "part") { isPart = true; }
                  }
                  if (!isPart) { return true; }
                  var name = element.name || "";
                  return name.startsWith("its");
                }
                """));

        rules.add(buildRule("IBD-006", "端口命名p部件名", "内部块图", "Port",
                "名称以p开头", Severity.WARNING,
                "端口名称应以 p 开头（p<部件名>）",
                "按 p<部件名> 重命名端口",
                """
                function main(element) {
                  var name = element.name || "";
                  if (name === "") { return true; }
                  var c = name.charAt(0);
                  return c === 'p';
                }
                """));

        rules.add(buildRule("IBD-007", "接口命名its发送者_its接收者", "内部块图", "Interface",
                "名称以its开头且包含下划线", Severity.WARNING,
                "接口名称不符合规范 its<发送者>_its<接收者>",
                "按 its<发送者>_its<接收者> 重命名接口",
                """
                function main(element) {
                  var name = element.name || "";
                  if (name === "") { return true; }
                  if (name.indexOf("_") < 0) { return false; }
                  return name.startsWith("its");
                }
                """));

        /* ================= 3.4 用例图 ================= */

        rules.add(buildRule("USE-001", "用例图应包含用例", "用例图", "Use Case Diagram",
                "图中存在UseCase", Severity.ERROR,
                "用例图缺少用例（Use Case）要素",
                "在图中补充系统用例",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("UseCase") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("USE-002", "用例图应包含参与者", "用例图", "Use Case Diagram",
                "图中存在Actor", Severity.ERROR,
                "用例图缺少参与者（Actor）要素",
                "在图中补充参与者",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Actor") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));
        
        rules.add(buildRule("USE-004", "用例图应包含关联", "用例图", "Use Case Diagram",
                "图中存在关联", Severity.ERROR,
                "用例图缺少关联（连接参与者和用例）",
                "用关联连接参与者和用例",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var relations = context && context.relations ? context.relations : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < relations.length; j++) {
                      if (relations[j].id === meId) { n++; break; }
                    }
                  }
                  return n > 0;
                }
                """));

        rules.add(buildRule("USE-005", "每个用例应连接至少一个参与者", "用例图", "UseCase",
                "存在指向Actor的关系", Severity.ERROR,
                "用例未连接任何参与者",
                "为用例添加与参与者的关联",
                """
                function main(element, context) {
                  var relations = context && context.relations ? context.relations : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < relations.length; i++) {
                    var otherId = null;
                    if (relations[i].sourceId === element.id) { otherId = relations[i].targetId; }
                    if (relations[i].targetId === element.id) { otherId = relations[i].sourceId; }
                    if (otherId === null) { continue; }
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== otherId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Actor") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("USE-006", "每个参与者应连接至少一个用例", "用例图", "Actor",
                "存在指向UseCase的关系", Severity.ERROR,
                "参与者未连接任何用例",
                "为参与者添加与用例的关联",
                """
                function main(element, context) {
                  var relations = context && context.relations ? context.relations : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < relations.length; i++) {
                    var otherId = null;
                    if (relations[i].sourceId === element.id) { otherId = relations[i].targetId; }
                    if (relations[i].targetId === element.id) { otherId = relations[i].sourceId; }
                    if (otherId === null) { continue; }
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== otherId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("UseCase") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        /* ================= 3.5 活动图 ================= */

        rules.add(buildRule("ACT-001", "活动图应包含操作", "活动图", "Activity Diagram",
                "图中存在Action", Severity.ERROR,
                "活动图缺少操作（Action）要素",
                "在图中补充操作",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Action") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("ACT-002", "活动图应包含控制流", "活动图", "Activity Diagram",
                "图中存在ControlFlow", Severity.ERROR,
                "活动图缺少控制流（操作之间控制流连接）",
                "在操作之间补充控制流",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var relations = context && context.relations ? context.relations : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < relations.length; j++) {
                      if (relations[j].id === meId) { n++; break; }
                    }
                  }
                  return n > 0;
                }
                """));
        rules.add(buildRule("ACT-003", "活动图应包含初始流", "活动图", "Activity Diagram",
                "图中存在InitialNode", Severity.WARNING,
                "活动图缺少初始流（初始节点）",
                "在活动图顶部补充初始节点与初始流",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Initial") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("ACT-004", "活动图应包含活动终点", "活动图", "Activity Diagram",
                "图中存在FinalNode", Severity.WARNING,
                "活动图缺少活动终点（Activity Final）",
                "在活动图底部补充活动终点",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Final") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("ACT-005", "操作名应以小写动词开头", "活动图", "Action",
                "名称首字母小写", Severity.WARNING,
                "操作名称应以小写动词开头（如 loadLayoutRoute）",
                "按 camelCase 规范重命名操作",
                """
                function main(element) {
                  var mc = element.metaClass || "";
                  if (mc.indexOf("StateMachine") >= 0) { return true; }
                  var name = element.name || "";
                  if (name === "") { return true; }
                  var c = name.charAt(0);
                  return c >= 'a' && c <= 'z';
                }
                """));

        rules.add(buildRule("ACT-006", "控制流不允许有触发条件", "活动图", "ControlFlow",
                "trigger/guard为空", Severity.ERROR,
                "控制流/初始流不允许设置触发条件",
                "移除控制流上的触发条件",
                """
                function main(element) {
                  var trigger = element.trigger || "";
                  if (trigger.trim() !== "") { return false; }
                  var guard = element.guard || "";
                  if (guard.trim() !== "") { return false; }
                  return true;
                }
                """));

        rules.add(buildRule("ACT-007", "操作应只有一个出口控制流", "活动图", "Action",
                "出度控制流<=1", Severity.WARNING,
                "操作存在多个出口控制流，建议使用决策节点或分支节点",
                "将多出口改为经决策节点分流",
                """
                function main(element, context) {
                  var mc = element.metaClass || "";
                  if (mc.indexOf("StateMachine") >= 0) { return true; }
                  var relations = context && context.relations ? context.relations : [];
                  var out = 0;
                  for (var i = 0; i < relations.length; i++) {
                    var kind = relations[i].kind || relations[i].metaClass || "";
                    if (kind.indexOf("ControlFlow") < 0) { continue; }
                    if (relations[i].sourceId === element.id) { out++; }
                  }
                  return out <= 1;
                }
                """));

        /* ================= 3.6 顺序图 ================= */

        rules.add(buildRule("SEQ-001", "顺序图应包含生命线", "顺序图", "Sequence Diagram",
                "图中存在Lifeline", Severity.ERROR,
                "顺序图缺少生命线（实例线/系统边界）",
                "在图中补充参与者与块的生命线",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Lifeline") >= 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("SEQ-002", "顺序图应包含消息", "顺序图", "Sequence Diagram",
                "图中存在Message", Severity.ERROR,
                "顺序图缺少消息（生命线之间的消息传递）",
                "在生命线之间补充消息",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var relations = context && context.relations ? context.relations : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < relations.length; j++) {
                      var kind = relations[j].kind || relations[j].metaClass || "";
                      if (relations[j].id === meId && kind.indexOf("Message") >= 0) { n++; break; }
                    }
                  }
                  return n > 0;
                }
                """));

        rules.add(buildRule("SEQ-003", "消息命名req/ret/ev前缀规范", "顺序图", "Message",
                "名称以req/ret/ev开头", Severity.WARNING,
                "消息名称不符合前缀规范：req（请求服务）/ret（应答服务）/ev（变化通知）",
                "按 req/ret/ev 前缀重命名消息",
                """
                function main(element) {
                  var name = element.name || "";
                  if (name === "") { return true; }
                  if (name.startsWith("req") || name.startsWith("ret") || name.startsWith("ev")) {
                    return true;
                  }
                  return false;
                }
                """));
        /* ================= 3.7 状态机图 ================= */

        rules.add(buildRule("STM-001", "状态机图应包含状态", "状态机图", "State Machine",
                "图中存在State", Severity.ERROR,
                "状态机图缺少状态（State）要素",
                "在图中补充状态",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("State") >= 0 && mc.indexOf("StateMachine") < 0) { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("STM-002", "状态机图应包含过渡", "状态机图", "State Machine",
                "图中存在Transition", Severity.ERROR,
                "状态机图缺少过渡（Transition）",
                "在状态之间补充过渡",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var relations = context && context.relations ? context.relations : [];
                  var n = 0;
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < relations.length; j++) {
                      var kind = relations[j].kind || relations[j].metaClass || "";
                      if (relations[j].id === meId && kind.indexOf("Transition") >= 0) { n++; break; }
                    }
                  }
                  return n > 0;
                }
                """));

        rules.add(buildRule("STM-003", "状态机图应包含缺省过渡", "状态机图", "State Machine",
                "图中存在初始状态/缺省过渡", Severity.ERROR,
                "状态机图缺少缺省过渡（初始状态），缺省过渡应缺省地进入初始状态或子状态",
                "在图中补充初始状态及缺省过渡",
                """
                function main(element, context) {
                  if (element.viewIds == null) { return true; }
                  var views = context && context.views ? context.views : [];
                  var elements = context && context.elements ? context.elements : [];
                  for (var i = 0; i < views.length; i++) {
                    if (views[i].diagramId !== element.id) { continue; }
                    var meId = views[i].modelElementId;
                    for (var j = 0; j < elements.length; j++) {
                      if (elements[j].id !== meId) { continue; }
                      var mc = elements[j].metaClass || "";
                      if (mc.indexOf("Pseudostate") >= 0 || mc.indexOf("Initial") >= 0) { return true; }
                      var kd = elements[j].kind || "";
                      if (kd === "initial") { return true; }
                    }
                  }
                  return false;
                }
                """));

        rules.add(buildRule("STM-004", "状态应至少有进入和出口过渡", "状态机图", "State",
                "进入过渡>=1且出口过渡>=1", Severity.ERROR,
                "状态缺少进入过渡或出口过渡，所有状态都应有至少一个进入和出口过渡",
                "为状态补充进入/出口过渡",
                """
                function main(element, context) {
                  if (element.modelElementId != null) { return true; }
                  if (element.viewIds != null) { return true; }
                  var mc = element.metaClass || "";
                  if (mc.indexOf("StateMachine") >= 0) { return true; }
                  var relations = context && context.relations ? context.relations : [];
                  var inCount = 0;
                  var outCount = 0;
                  for (var i = 0; i < relations.length; i++) {
                    var kind = relations[i].kind || relations[i].metaClass || "";
                    if (kind.indexOf("Transition") < 0) { continue; }
                    if (relations[i].targetId === element.id) { inCount++; }
                    if (relations[i].sourceId === element.id) { outCount++; }
                  }
                  return inCount > 0 && outCount > 0;
                }
                """));

        return rules;
    }

    private ValidationRule buildRule(String ruleCode, String ruleName, String scope,
                                     String targetType, String condition, Severity severity,
                                     String message, String fixSuggestion, String script) {
        ValidationRule rule = new ValidationRule();
        rule.setRuleCode(ruleCode);
        rule.setRuleName(ruleName);
        rule.setScope(scope);
        rule.setTargetType(targetType);
        rule.setCondition(condition);
        rule.setSeverity(severity);
        rule.setMessage(message);
        rule.setFixSuggestion(fixSuggestion);
        rule.setRuleVersion("1.0");
        rule.setScript(script);
        rule.setEnabled(true);
        rule.setCreateTime(LocalDateTime.now());
        rule.setUpdateTime(LocalDateTime.now());
        return rule;
    }
}
