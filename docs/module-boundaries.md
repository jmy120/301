# 解析模块与校验模块边界

## 模块职责

### 解析模块（当前仓库）

输入 MagicDraw/M-Design 等工具导出的 XML/XMI，输出稳定、可版本化的 JavaScript/JSON 统一模型。负责 XML 编码、格式和根节点识别；元素、关系、Diagram、View、构造型和原始属性提取；ID、owner、namespace、关系端点和视图引用解析；解析级问题、来源 XPath 和统计信息；输出接口版本管理、样例和回归测试。

解析模块不执行名称规范、可达性、覆盖率、方向一致性等业务校验。

### 校验模块（另一位开发）

消费解析模块输出的 JavaScript 模型，执行合同约定的 40 条模型质量规则。负责规则定义、规则执行、等级、问题建议、过滤和校验报告；不直接读取 XML，也不依赖 MagicDraw 私有标签。

## 15 条问题归属

| 编号 | 归属 | 处理边界 |
|---|---|---|
| 1 | 解析核心 | View 的 modelElement 引用规范化 |
| 2 | 解析核心 | mdElement 的 elementID 规范化 |
| 3 | 解析核心 | 关系端点文本读取 |
| 4 | 解析接口 | 多端点关系数据结构 |
| 5 | 解析服务 | 请求体大小和上传保护 |
| 6 | 解析服务 | 输入编码检测和解码 |
| 7 | 解析核心 | owner/namespace 引用解析 |
| 8 | 解析核心 | 未知元类诊断 |
| 9 | 解析核心 | Diagram/View 结构完整性 |
| 10 | 解析接口 | 扩展节点和原始片段保留 |
| 11 | 解析服务 | 无 BOM 编码识别 |
| 12 | 解析服务 | 超限请求流终止 |
| 13 | 解析服务 | 模型缓存容量和生命周期 |
| 14 | 查询接口 | 模型树循环保护 |
| 15 | 共同边界 | 固化“解析诊断”和“业务校验结果”的数据分离 |

40 条合同规则全部归属校验模块。解析模块只提供规则所需的完整字段，不在导入过程中执行这些规则。

## 建议的 Git 组织

当前先保持单仓库、按目录分层，避免两个开发者维护两个仓库导致接口漂移：

```text
src/parser/       XML/XMI 解析核心
src/adapter/      工具和版本适配
src/model/        JavaScript 模型类型与 schema
src/service/      导入、缓存、查询 HTTP 服务
src/diagnostics/  解析级问题
test/             解析回归测试
examples/         脱敏小样例
docs/             接口和边界说明
```

校验模块可先在同一仓库使用独立目录 `validator/`，或后续拆成独立仓库；无论哪种方式，都通过版本化的模型 schema 和样例 JSON 交付，不直接引用解析器内部实现。

分支建议：`main` 只放可验证版本；解析开发使用 `feature/parser-*`，校验开发使用 `feature/validator-*`，接口变更使用 `feature/model-contract-*`；通过 Pull Request 合并。提交按单一目的组织，例如 `fix(parser): normalize external href references`、`feat(contract): add parsed model schema`、`test(parser): add multi-endpoint regression`。
