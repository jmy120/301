# 模型校验模块（validator · Java / Spring Boot）

校验模块接收解析模块输出的 `ParsedModel v1.0.0` JSON，执行「内置结构校验 + 合同约定的 40 条模型质量规则」，返回可落库、可导出的校验结果，并附带一套可直接运行的 Web 前端（工作台 / 规则配置 / 校验任务与报告）。

本目录是一个**独立 Maven / Spring Boot 工程**，与仓库根目录的 Node.js 解析器互不依赖：共用同一个 Git 仓库、同一份 ParsedModel 契约，但不共享运行时。

## 职责与边界

- 输入：解析模块输出的 ParsedModel JSON（结构与 `../schema/parsed-model.schema.json` 一致，样例见 `../examples/parsed-model.sample.json` 和本目录 `sample/sample-parsed-model.json`）。
- 本模块**不直接读取 XML/XMI**，不依赖 `../src/` 下解析器内部实现。
- 解析器输出的 `issues`（`stage: "parse"`）只透传/合并展示，不覆盖校验结果；校验问题单独返回并标记来源（`builtin` / `rule` / `parser`）。
- 40 条合同规则（`GEN-*`、`STR-*`、`BDD-*`、`IBD-*`、`ACT-*`、`SEQ-*`、`STM-*`、`USE-*`、`INT-*` 等）全部由本模块实现并在首次启动时幂等写入规则库，可启停、增删改。
- 更细的职责划分见 `../docs/module-boundaries.md` 与 `../CONTRIBUTING.md`。

## 技术栈与运行环境

- JDK 17，Spring Boot 4.x（Maven 工程，`pom.xml` 独立，不并入仓库根 `package.json`）。
- MySQL：默认连接 `localhost:3306/sysml_checker`（账号 `root/12345678`，可在 `src/main/resources/application.properties` 修改）。
- 启动时自动建表/更新表（`validation_rule`、`validation_task`、`model_info`），并幂等写入 40 条种子规则。

## 运行

```powershell
# 1) 先准备数据库（本机 MySQL）
#    mysql -uroot -p -e "CREATE DATABASE IF NOT EXISTS sysml_checker DEFAULT CHARACTER SET utf8mb4;"

# 2) 让构建使用 JDK 17（按实际路径设置）
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"

# 3) 测试 / 启动 / 打包（均在本目录 validator/ 下执行）
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
.\mvnw.cmd package
```

启动成功后：

- 浏览器打开 `http://localhost:8080/index.html`（工作台：粘贴解析 JSON → 校验 → 问题列表/统计；规则页：40 条规则启停与增删改；任务页：校验历史与报告导出）。
- 服务默认 8080 端口，与解析服务（3000 端口）互不冲突；接口冒烟请求见 `test.http`（可被 IntelliJ/VS Code 直接运行）。

## 目录结构

```text
validator/
├─ pom.xml / mvnw / .mvn          Maven 工程与 Wrapper
├─ sample/
│  └─ sample-parsed-model.json    联调 JSON（故意包含重复 ID、悬空引用、端点缺失等问题）
├─ test.http                      接口冒烟脚本
└─ src/
   ├─ main/java/com/example/sysmlmodelchecker/
   │  ├─ config/                  RuleDataInitializer（40 条种子规则装载）
   │  ├─ controller/              模型上传查询 / 校验 / 规则库 / 任务与报告接口
   │  ├─ model/ + model/dto/      JPA 实体与 ParsedModel / ValidationResult 等 DTO
   │  ├─ repository/              Spring Data JPA 仓库
   │  └─ service/
   │     ├─ validation/           ModelValidationService（编排）、StructuralValidator（内置结构校验）、RuleScriptEngine（JS 子集脚本解释器）
   │     └─ report/               ReportGenerator（HTML / DOCX / JSON / CSV）
   ├─ main/resources/
   │  ├─ application.properties
   │  └─ static/                  Web 前端（index.html 工作台、rule.html 规则、tasks.html 任务、result.html 结果）
   └─ test/                       解释器与结构校验单元测试、Spring 上下文测试
```

## 主要 HTTP 接口

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| POST | `/api/models/validate` | 完整校验：结构校验 + 已启用规则（请求体为 ParsedModel JSON） |
| POST | `/api/models/validate/builtin` | 仅内置结构校验（不依赖数据库规则） |
| GET | `/api/models/test` | 健康检查 |
| POST / GET / GET | `/api/models/upload`、`/api/models`、`/api/models/{id}` | XML 模型上传 / 列表 / 详情 |
| GET / POST / PUT / DELETE / GET | `/api/rules`、`/api/rules/{id}`、`/api/rules/{id}/status` | 规则库增删改查、启停 |
| GET | `/api/rules/severities`、`/api/rules/target-types`、`/api/rules/init` | 下拉选项 / 幂等初始化种子规则 |
| POST / GET / GET | `/api/tasks`、`/api/tasks/{id}` | 校验任务创建（同步执行并落库）/ 列表 / 详情 |
| POST / DELETE | `/api/tasks/{id}/rerun`、`/api/tasks/{id}` | 重跑（复用模型快照 + 当前规则库）/ 删除 |
| GET | `/api/tasks/{id}/report?format=html` | 导出报告：`html`(默认)/`docx`(word)/`json`/`csv` |

## 联调方式

1. 解析端导出 JSON（结构同 `../examples/parsed-model.sample.json`）。
2. `POST /api/models/validate`，请求体直接粘贴该 JSON；也可先用本目录 `sample/sample-parsed-model.json` 冒烟。
3. 返回体含 `issues`（`code`/`severity`/`message`/`elementId`/`xpath`/`source`）、`modelId`、`rulesExecuted`、`rulesMatched`、`severityCounts`、`statistics`。

## 常见问题

- 启动报数据库连接失败：确认 MySQL 已启动且已执行建库语句，或修改 `application.properties` 中的账号密码。
- 规则脚本语法：规则 `script` 使用内置的极简 JS 子集解释器（Java 17 已移除 Nashorn，本模块不引入第三方脚本引擎），函数签名 `function main(element)`，返回 `false` 表示不通过。脚本引擎测试见 `src/test/.../RuleScriptEngineTest.java`。
- 端口占用：如 8080 被占用，在 `application.properties` 加 `server.port=xxxx` 后重启。