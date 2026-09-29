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

## 2026-09-05 工作记录（模型解析）

### 本周完成

- 修复普通小写 `diagram` 节点未被识别的问题，Diagram 内嵌的 View 可以正确进入解析结果。
- 统一 View、MagicDraw `mdElement` 和关系端点中的 `file#id`、`PROJECT...?resource=...#id` 引用 ID。
- 增加 `general`、`relatedElement` 关系端点别名；外部 profile/library 的 `href` 不再误报为当前模型内悬空引用。
- 增加 Diagram/View 完整性诊断，检查根 View、Diagram 声明的 View 和 Edge/Link/Path 端点。
- 增加无 BOM 的 UTF-16LE/UTF-16BE XML 启发式编码识别。
- 导入请求体限制为 100 MB，超限时主动终止请求流。
- 内存模型缓存限制为 20 个模型，30 分钟未访问自动清理。
- 在 `ParsedModel.extensions` 中结构化保留未知扩展节点，并同步更新 Schema。
- 修复根 `Model` 被 XML 包装节点错误赋予 `generated-*` owner 的问题。
- 使用当前解析器解析 `E:\301\test1.xml`，生成未纳入仓库的测试产物 `E:\301\test1.parsed.js`。

### 验证结果

- `npm test`：10/10 通过。
- `npm run build`：通过。
- `test1.xml` 解析结果：855 个元素、430 个关系、54 个 Diagram、711 个 View、0 个悬空引用、0 个重复 ID。
- `test1.parsed.js` 已验证可通过 ES module `import` 正常加载。

### 尚未解决的问题

1. `test1.xml` 仍产生 297 条 `UNKNOWN_METACLASS` 警告，主要是 MagicDraw 图形扩展节点，例如 `diagramContents`、`binaryObject`。这些节点已保留在 `extensions`，但尚未建立专用适配器或白名单。
2. `owner`/`namespace` 当前只取一个规范化引用；多值、跨文件和共享模型的归属语义仍需明确后适配。
3. Edge 端点检查当前覆盖直接属性引用；MagicDraw 不同版本可能将端点写在不同的嵌套节点中，需要更多真实样例补齐。
4. 无 BOM UTF-16 采用启发式检测，罕见的二进制前缀或特殊 XML 声明仍需更严格的处理。
5. 缓存使用进程内存，服务重启后导入模型不保留；长期查询或多人共享需要后续接入持久化存储。

## 2026-09-13 工作记录（继续处理遗留解析问题）

- 关系端点解析支持嵌套引用节点：递归识别 `client/source/relatedElement`、`supplier/target/general` 和 `memberEnd/ownedEnd`，统一填充 `sourceIds`、`targetIds`、`endIds` 并去重。
- Diagram、View、Relation 出现重复 ID 时不再静默覆盖，保留冲突对象并生成 `#duplicate-N` 标识，同时输出 `DUPLICATE_ID` 诊断。
- 将 MagicDraw 常见图形扩展和 UML/SysML 元类加入识别集合，减少 `UNKNOWN_METACLASS` 噪声；未知节点仍保留在 `extensions` 中供下游追溯。
- 新增嵌套关系端点回归测试。
- 验证：`npm test` 11/11 通过；`npm run build` 通过。独立 `node --import tsx` 统计命令在当前 Windows 环境偶发 `spawn EPERM`，不影响项目脚本验证。
- 建立 `ParsedModel.indexes` 跨文件引用索引：记录 `idsByFilePart` 及外部 `href` 的原始 URI、文件部分和规范化 ID；引用片段支持 URI 编码解码，供后续跨文件解析和断链诊断使用。

### 当前仍未解决的问题（2026-09-13）

以下事项仍未完全解决，跨文件索引仅是基础能力，不代表跨文件模型已经自动加载和合并：

1. **跨文件引用尚未闭环**：已记录 `filePart` ID 和外部 `href` 索引，但尚未加载外部文件、建立跨文件对象图，也无法对所有跨文件引用进行精确存在性校验。
2. **owner/namespace 仍为单值**：模型对象只有 `ownerId`，多值 URI、共享模型和跨包归属语义可能丢失。
3. **图形 Edge 端点兼容性不足**：不同 MagicDraw 版本可能把端点放在更深层的包装节点中，尚未覆盖全部真实样例。
4. **未知元类识别仍依赖白名单**：新版本或厂商扩展可能产生误报；`extensions` 尚未保留完整原始 XML 片段。
5. **编码处理仍有边界风险**：UTF-16 无 BOM、特殊二进制前缀、异常 XML 声明和混合编码场景缺少严格处理与测试。
6. **超大请求的连接收尾待验证**：请求体超限会终止流，但分块上传、Keep-Alive 和客户端错误响应行为尚未完成端到端测试。
7. **缓存无持久化**：当前仅有内存缓存、20 个模型上限和 30 分钟 TTL，服务重启后模型丢失。
8. **模型树环形归属的展示不完整**：已有递归保护，但如果 owner 图整体成环，节点可能无法从根节点列表访问。
9. **重复 ID 的作用域仍需明确**：语义模型、Diagram、View 和各 `filePart` 的 ID 命名空间可能不同，当前冲突处理仍是统一追加 `#duplicate-N`。
10. **回归测试覆盖不足**：尚缺真实跨 `filePart` 引用、重复图形 ID、UTF-16 无 BOM、超限分块请求、复杂 Edge 嵌套和环形 owner 图样例。

### 已完成但需持续验证的事项

- 基础 XML/XMI 解析、外部引用 ID 规范化、嵌套关系端点、Diagram/View 完整性诊断、请求大小限制、内存缓存淘汰和扩展节点保留已实现。
- 当前验证：`npm test` 11/11 通过，`npm run build` 通过；Windows 环境下独立 `node --import tsx` 可能因 `spawn EPERM` 失败，项目测试脚本不受影响。

## 2026-09-17 工作记录（遗留解析问题收敛）

- Edge/Link/Path 的端点校验现在递归读取包装节点内的 `source`、`target`、`sourceView`、`targetView`、`linkFirstEndID` 和 `linkSecondEndID` 引用，不再只依赖 View 直接属性。
- 多端点关系的所有 `sourceIds`、`targetIds` 和 `endIds` 均参与悬空引用诊断，不再只检查兼容字段 `sourceId`、`targetId`。
- Diagram 与 View 重复 ID 继续保留全部对象并生成 `#duplicate-N` 标识；新增回归测试确保后出现的图形对象不会覆盖先出现的对象。
- 模型树构建提取为独立模块。owner 图不存在自然根节点时（例如完整环）会暴露一个代表节点，递归边标记 `cycle: true`，避免该组模型在接口结果中完全不可见。
- 请求 XML 解码提取为独立模块；除 UTF-16 BOM 和无 BOM 启发式识别外，新增 XML 声明中的 ISO-8859-1、Latin-1、US-ASCII 处理。
- 新增复杂 Edge、重复图形 ID、环形 owner 图和编码解码的回归测试。

### 本轮验证

- `npx tsc -p tsconfig.json --noEmit` 通过。
- 当前 Windows 环境拒绝 Node/esbuild 创建子进程（`spawn EPERM`），因此 `npm test` 和正常写入 `dist` 的 `npm run build` 在本轮无法完成。该限制也阻止使用 `tsx` 执行新增回归用例；待权限恢复后应运行 `npm test` 与 `npm run build` 复验。

## 2026-09-17 工作记录（40 条规则解析白名单）

- 阅读 `docs/40条校验规则详细说明.md`，建立 `docs/validator-parsing-whitelist.md` 和 `src/sysml-whitelist.ts`：白名单覆盖规则依赖的 BDD、IBD、用例、活动、顺序、状态机元素与关系，并保留需求图、参数图、包图的基础解析能力以支持 SysML 九大图。
- `Diagram.type` 现在从 MagicDraw 内嵌 `diagram:DiagramRepresentationObject.type` 回填并规范化，例如 `SysML Internal Block Diagram` 输出为 `Internal Block Diagram`；校验模块可以据此选择对应规则，而不再只能看到 `uml:Diagram`。
- 将规则要求的关系类型集中接入关系识别；补齐 `InitialNode`、`ActivityFinalNode`、`FlowFinalNode`、`Operation` 等规则依赖元类的白名单识别。
- 新增图类型回填及规则白名单元类/关系回归测试。
- 验证：`npm test` 18/18 通过，`npm run build` 通过。

## 2026-09-20 工作记录（解析结果导出）

- 新增 `src/exporter.ts`，将 `ParsedModel` 序列化为可被检验模块直接 `import` 的 ESM 文件，包含默认导出和具名 `parsedModel` 导出。
- 新增命令行导出：`npm run parse -- <input.xml> <output.parsed.js>`；输入 XML 的编码沿用服务端解码逻辑。
- 新增 `GET /api/models/{id}/export.js`，可下载内存中已导入模型的同格式 ESM 文件。服务端不接收任意文件写入路径。
- 端到端验证：编译后执行 `node dist/cli.js examples/sample.sysml.xml <temporary-output>`，成功导出 4 个元素、1 个关系、1 个 Diagram、1 个 View 的 ESM 文件；文件以 `export const parsedModel = ...` 开头。

## 2026-09-20 当日汇总

- 面向检验模块的主链路已形成：MagicDraw SysML XML/XMI -> `ParsedModel`（元素、关系、Diagram、View、端点、引用、诊断）-> 可直接 `import` 的 `.parsed.js` ESM 文件。
- 解析白名单按 40 条规则实际依赖的 BDD、IBD、用例图、活动图、顺序图、状态机图元素和关系建立，并保留需求图、参数图、包图的基础覆盖；MagicDraw 嵌套图类型已规范化写入 `Diagram.type`。
- 已完成复杂图形端点、多端点关系、重复图形 ID、环形 owner 图、编码识别与解析结果导出的改进和回归测试。
- 最终验证：`npm test` 19/19 通过；`npm run build` 通过；编译后的 CLI 导出示例已端到端验证。
- 后续重点：使用真实九大图 MagicDraw 样例补全兼容性回归；跨文件模型自动加载/合并、持久化缓存、复杂 owner 语义和特殊编码边界仍待后续设计与实现。

   模型中的操作                              XML 变化
  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   新增块、需求、活动等元素                  新增一个对应的 uml:Class、uml:Requirement、uml:Activity 等节点，带 xmi:id、name、owner/namespace 等属性
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   修改元素名称、属性、标注值                原节点的 name 或对应属性值改变，xmi:id 通常保持不变
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   删除元素                                  元素节点删除；引用它的关系、图形视图、连线也可能被同步删除或留下悬空引用
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   移动元素到另一包/块                       元素可能移动到新的 XML 父节点，或其 owner / namespace 引用更新
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   新增语义关系，如依赖、泛化、满足、分配    新增一个关系节点，例如 uml:Dependency、uml:Generalization、sysml:Allocate，其中以 client/supplier、source/target 等引用关联端点 ID
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   修改关系端点                              关系节点保留，但端点引用 ID 改变；多端点关系可能同时改变 sourceIds、targetIds 一类引用
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   删除关系                                  对应语义关系节点删除；图上的连线视图通常也会删除
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   在图上增加元素                            除语义元素外，mdOwnedViews / mdElement 下会增加图形 View，通过 modelElement 指向语义元素 ID，并写入坐标、尺寸、样式
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   在图上画连线                              常新增图形层的 Edge/Link/Path，端点指向 View ID；它不一定等同于一个新的 UML/SysML 语义关系
  ────────────────────────────────────────  ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
   只拖动、缩放、改颜色或布局                通常只改 View 的 bounds、路径点、样式等图形数据，不改变语义元素或关系

检验出现的问题
1. 三个伪状态元类没导出
   InitialNode、ActivityFinalNode、Pseudostate 在 elements 里查不到，views.kind 里也没有。
   活动图里 OpaqueAction、CallBehaviorAction、ControlFlow、Pin、ObjectFlow 都有，状态机里
   State、Transition 也都有，唯独初始节点和终止节点一个都没有——看着像导出时被过滤掉了，
   不像工具里没画。
   受影响的规则：ACT-003 活动图应包含初始流（16 条）、ACT-004 活动图应包含活动终点（16 条）、
   STM-003 状态机图应包含缺省过渡（13 条），一共 45 条误报。规则本身没问题，是数据里查不到
   对应节点。这三个能补进解析结果吗？

2. 契约想请你明确几件事
   - 图上的连线被输出成 relations 条目，190 条，id 形如 diagram-link:<uuid>，metaClass / kind
     都不带 uml: 前缀（比如是 Transition，而真关系是 uml:Transition），sourceXPath 指向
     .../filePart/mdOwnedViews/mdElement。我现在靠 id 前缀判断再跳过，能不能加个显式字段，
     把"语义关系"和"图上连线"区分开？
   - 非图形记录：我把 kind 为 diagramRepresentation、DiagramFrame、以及 kind 直接写成图类型名
     的记录过滤掉了。实测是 138 条 / 54 张图（平均 2.56 条/图），不是每张图固定 3 条——
     diagramRepresentation 54 条、DiagramFrame 54 条、kind 等于图类型名的只有 30 条。这个口径
     是我自己按 kind 猜的（JSON 里没有 graphic 这类标志位），契约里也没写，怕以后 kind 一变就崩，
     能不能定义一下"什么算图形视图"？
   - view.modelElementId 不只在 elements 里查：603 个带该字段的视图里，357 个指向 elements、
     190 个指向 relations（就是那批 diagram-link）、还有 56 个两处都查不到。契约上写的是
     "对应模型元素 ID"，建议明确一下这个 id 可能落在哪个集合。
   - docs/parsed-model-contract.md 现在是 v1.0.0、只有 50 行。schemaVersion 和 indexes 已经列了
     （indexes 只写了个名字，Indexes 接口没定义），extensions 完全没写。建议升到 v1.1.0 一次补齐：
     extensions、Indexes 的结构、indexes.externalReferences 的语义，以及上面三条。
   - indexes.externalReferences 我已经用上了，1024 条外部库元素，把 7 条 UML 外部库元素的
     "引用不存在"误报消掉了，挺好用。

3. 3 条悬空引用
   不是跨 filePart 那么简单。具体是 3 个 uml:LiteralUnlimitedNatural 元素（多重性上界字面量，
   value="1"）的 ownerId 指向 generated-2181、generated-2243、generated-2261，这三个 id 既不在
   elements 也不在 views 里。看起来是多重性字面量导出了、但它的 owner（MultiplicityElement /
   TypedElement）没导出。全模型有 56 个 uml:LiteralUnlimitedNatural，你确认一下？

4. 规则库还是 40 条，换了两条
   删了 GEN-006（图中同类元素尺寸应保持一致）和 ACT-005（操作名应以小写动词开头），换成
   PAR-001（参数图应包含绑定连接）和 PKG-001（包图应包含包元素），把参数图和包图的覆盖补上，
   总数没变。这两条的依据是图类型自身的语义完整性（属建模语言层），现行建模规范没有覆盖
   参数图和包图。

5. 想跟你要一个含用例图和顺序图的模型
   XML 或者解析结果都行。样本里图类型只有块定义图、内部块图、参数图、状态机图和活动图，
   既没有用例图也没有顺序图，USE 5 条、SEQ 3 条规则到现在一条都还没测到。
