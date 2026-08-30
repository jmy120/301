# 工作日志

## 2026-08-22

- 确认并启动 SysML Parser 后端服务，监听地址为 `http://localhost:3000`。
- 排查需求图导入后模块连线缺失的问题：MagicDraw 导出的需求图将层级连线保存为图形层 `mdElement` / `ContainmentLink`，端点引用的是视图 ID，而非 UML 语义关系。
- 更新 `src/parser.ts`：解析此类图形连线，解析端点视图并回溯到对应的需求模块，生成包含 `sourceId`、`targetId` 和几何路径的关系/视图数据，供前端绘制折线。
- 使用 `E:\301\test2.xml` 验证：成功解析 6 条 `ContainmentLink` 连线，图中共 20 个视图、6 条关系。
- 在 `test/magicdraw2026.test.ts` 新增需求图连线解析回归测试。
- 重新构建并启动更新后的后端服务。
- 
## 解析器问题清单（2026-08-30）

以下问题来自对 `src/parser.ts`、`src/adapter.ts`、`src/server.ts`、`src/store.ts` 的代码检查，暂只记录，未修改实现：

1. 测试未全通过：`npm test` 中 MagicDraw 2026 测试失败；`test1.xml` 产生 20 条 `MISSING_NAME`，源于自动生成的 `diagram-link:*` 关系被按普通无名关系检查。
2. 重复 ID 检查不完整：当前只检查 `elements`，关系、Diagram、View 重复时可能被 `Map.set()` 静默覆盖。
3. 多端点关系处理不完整：`source/client`、`target/supplier` 可能包含多个空格分隔 ID，当前按单个字符串处理。
4. 外部 `href` 引用解析不完整：只移除开头的 `#`，未提取 `file#id` 或 `PROJECT...?resource=...#id` 中真正的元素 ID。
5. 上传请求无大小限制：服务端将整个请求体读入内存，没有最大 body 限制。
6. 编码处理与文档不一致：服务端固定使用 UTF-8 解码，无法正确处理 UTF-16 XML。
7. 关系类型覆盖不足：未覆盖部分常见 UML/SysML 关系，如 Trace、Refine、Allocate、Flow、Realization、InterfaceRealization、Substitution 等。
8. 模型树接口实际返回扁平列表：`GET /api/models/{id}/tree` 未递归组装树结构。
9. 元素查询未按模型隔离：`GET /api/elements/{id}` 遍历所有模型，相同 ID 时可能返回错误对象。
10. 所有者/层级解析依赖 XML 父节点：未充分解析显式 `owner`、`namespace` 引用，跨包或共享模型的归属可能错误。

## 解析问题处理进展（2026-08-30）

- 已修复自动生成 `diagram-link:*` 关系被误报 `MISSING_NAME` 的问题。
- 已将重复 ID 检查扩展到参与语义/图形模型的对象，同时忽略 MagicDraw 内置 filePart 配置资源中的跨文件重复 ID。
- 已增加多 ID 引用拆分及 `file#id`、`PROJECT...?resource=...#id` 形式的引用 ID 提取。
- 已扩展关系类型识别：Trace、Refine、Allocate、Flow、Realization、InterfaceRealization、Substitution、Abstraction、CommunicationPath、InterruptFlow 等。
- 已优先使用显式 `owner`/`namespace` 引用，缺失时回退到 XML 父节点。
- 已为导入请求增加 100 MB 请求体限制，并支持 UTF-16 BOM 输入。
- 已将模型树接口改为递归树结构；元素/Diagram 查询支持 `modelId` 查询参数以避免多模型同 ID 串数据。
- 验证结果：`npm test` 5/5 通过，`npm run build` 通过。

## 待处理解析问题清单（2026-08-30，业务分层后复查）

当前解析模块的职责限定为：将 XML/XMI 模型解析为供独立校验模块消费的 JavaScript 统一模型；不在解析阶段执行合同中的业务校验规则。以下问题暂记录，待后续迭代处理：

1. 普通 View 的 `modelElement` 引用尚未统一经过 `href/file#id` 规范化，可能导致视图绑定失败。
2. MagicDraw `mdElement` 下的 `elementID` 引用未统一经过引用 ID 提取，可能保留完整 URI。
3. 关系端点只读取 `xmi:idref`/`href` 属性，未处理以 XML 文本内容表示的 `client`、`supplier`、`source`、`target`。
4. `Relation` 仍只有单个 `sourceId`/`targetId`，多客户端、多供应商关系可能丢失端点。
5. 关系端点属性别名覆盖不全，`general`、`type`、`role`、`relatedElement` 等引用尚未统一处理。
6. 关系、Diagram、View 重复 ID 虽可诊断，但对象仍可能通过 `Map.set()` 被覆盖，造成原始数据丢失。
7. `owner`/`namespace` 只取单个规范化 ID，复杂 URI 或多值场景可能造成所有者归属错误。
8. 未识别元类没有单独的解析诊断，未知 UML/SysML 节点可能被误当普通元素。
9. Diagram/View 层级完整性检查不足，尚未系统检查 View 所属 Diagram、根视图、Edge 端点和跨 Diagram 重复绑定。
10. 最终 JavaScript 模型未保留未知扩展节点、原始 XML 片段或 `extensions` 字段，复杂工具格式问题不易追溯。
11. 无 BOM 的 UTF-16 文件仍可能按 UTF-8 解码；UTF-16 编码检测和处理还不完整。
12. 请求体超限后未主动终止上传流，可能继续占用连接和资源。
13. 内存模型仓没有删除、过期清理和容量限制，连续导入大模型可能导致内存增长。
14. 模型树递归未设置循环检测，异常 `owner` 环可能导致接口递归异常。
15. 解析诊断与校验结果的数据边界仍需进一步固化：解析模块只输出格式、索引、引用、绑定等基础问题；名称规范、可达性、关系语义等业务规则交由独立校验模块。

## 2026-08-30 工作记录（解析与接口协作）

- 明确业务分层：当前仓库负责 XML/XMI → ParsedModel JavaScript/JSON；另一位开发者负责消费 `ParsedModel v1.0.0` 的 40 条业务校验规则。
- 新增接口契约文档 `docs/parsed-model-contract.md`、模块边界文档 `docs/module-boundaries.md`、校验模块对接说明 `validator/README.md` 和 Git 协作指南 `docs/git-collaboration-guide.md`。
- 新增校验模块使用的脱离 XML 样例 `examples/parsed-model.sample.json`，以及接口 Schema `schema/parsed-model.schema.json`。
- 解析代码已增加：View/`mdElement` 外部引用 ID 规范化、关系文本端点读取、多端点 `sourceIds/targetIds`、未知元类和无效 View 诊断、模型树循环保护、UTF-16 BOM 处理、请求体大小限制、模型查询隔离等能力。
- 新增 `Issue.stage = "parse"` 与 `ParsedModel.schemaVersion = "1.0.0"`，明确解析问题不与校验结果混用。
- 本轮测试：基础解析和需求图测试通过；新增外部引用测试因测试样例未构造真实 MagicDraw `filePart/streamContentID` 结构而失败，需要调整测试样例；MagicDraw 2026 样例仍有跨 filePart 引用未纳入索引，以及未知元类集合过窄的问题。
- 当前验证环境存在 Windows 权限限制，可能出现 `dist` 写入 `EPERM` 或测试子进程 `spawn EPERM`；静态类型检查曾通过。
