# 工作日志

## 本周工作汇总（2026-10-26 至 2026-10-31）

### 一、新增模型解析与问题排查

- 对 `模型/export` 中新增的 `hybrid sport utility vehicle.xml`、`InvertedPendulum.xml`、`MultiMediaExample.xml`、`WaterSupply.xml` 运行当前解析器，同时重新解析 `test1.xml`、`test2.xml`、`distiller model.xml` 作为回归对照。
- 对照源 XML、完整解析输出和诊断，区分对象漏解析、语义引用遗漏、仅保留原始属性、合法匿名节点误报及源文件缺失定义，避免将零诊断等同于语义完整。
- 定位 InvertedPendulum 中 6 个真实 `target` InputPin 被误判为引用节点的问题，以及 AssociationClass、InformationFlow、实例槽位、动作和交互片段的特征提取缺口。
- 确认四份新输入均为 Clean XMI，源文件没有图形数据；图和视图数量为 0 属于输入限制。
- 修复前检查结果、XML 证据及可导入解析文件保存至 `E:\301\模型\解析检查_20261031`。

### 二、解析器修复与语义补全

- 修复 `target` 等标签下对象定义与引用包装节点的区分，恢复 6 个遗漏输入引脚及其对象流端点绑定。
- 补齐 AssociationClass 的关联端语义，在 `relations` 中输出一次，同时保留类的属性、操作、约束、构造型和子对象；同步前端模型树，保持关联类及其内容可浏览。
- 补齐 InformationFlow 的源端、目标端、载荷与实现连接器引用，保留 ItemFlow 构造型及完整外部 URI。
- 补齐 InstanceSpecification、Slot、InstanceValue 的分类器、槽位定义和值绑定；支持有 ID 的值对象、无 ID 的内联值与外部 QUDV 引用。
- 补齐动作族的 structuralFeature、classifier、signal、object、target、value、insertAt 等特征，以及 Operation.method、活动分区、中断区域和权重等命名引用。
- 补齐 InteractionUse.covered/refersTo、TimeExpression.expr，收敛已知元类与合法匿名对象的误报，保留有依据的缺名称和悬空引用提示。

### 三、接口、样例与文档

- 继续采用 ParsedModel v1.2.0，补充 TypeScript 注释、Schema 说明及接口契约；明确 AssociationClass、InformationFlow 从 `elements` 转入 `relations` 后的消费方式。
- 新增脱敏样例 `examples/clean-xmi-semantics.sysml.xml` 和 `test/clean-xmi.test.ts`，覆盖本轮确认的遗漏及定义/引用、外部/本地 ID、对象值/标量值等边界。
- 修正两项真实模型测试的样本路径；新增解析批处理及修复前后对照脚本 `audit-new-models.mjs`、`verify-model-fixes.py`。
- 完整修复说明见 [Clean XMI 修复与验证记录](docs/parser-fixes-20261031.md)；修复后文件保存至 `E:\301\模型\解析修复验证_20261031`，保留修复前结果供对照。

### 四、验证结果

- 新增 9 项回归测试，测试总数由 63 项增至 **72 项，全部通过**；构建、三个前端脚本语法检查及 `git diff --check` 通过。
- 七个真实模型完整输出均通过 JSON Schema Draft 2020-12 校验；645 处相关特征引用与源 XML 对照通过。
- 对照修复前后的对象属性、构造型、归属、限定名称、子对象、已有引用及文本值，原有数据保留，另恢复 6 个 InputPin；旧模型的图和视图内容保持一致。

| 新增模型 | 元素 / 关系（修复后） | 未知元类（前→后） | 缺名称（前→后） | 悬空引用（前→后） |
|---|---:|---:|---:|---:|
| hybrid sport utility vehicle | 1365 / 338 | 39 → 0 | 56 → 8 | 5 → 5 |
| InvertedPendulum | 1177 / 385 | 83 → 0 | 85 → 12 | 6 → 0 |
| MultiMediaExample | 583 / 144 | 0 → 0 | 0 → 0 | 0 → 0 |
| WaterSupply | 70 / 23 | 0 → 0 | 2 → 0 | 0 → 0 |

- 四个新模型的诊断总数由 276 条降至 25 条；三个旧模型诊断均为空。元素/关系数量变化包含类型重新分类，不能据此判断对象丢失。
- 剩余 5 条引用错误均来自 HSUV，涉及 3 个在源 XML 中没有定义的目标 ID；剩余 20 条缺名称提示对应 Class/Interface，未屏蔽或补造模型数据。

### 五、后续工作与验证范围

- 对齐校验模块对 AssociationClass、InformationFlow 及新增语义特征的消费，开展 Java 业务规则联合验证；本周未执行 Java 业务校验或浏览器交互验证。
- 补充包含图形数据的真实导出样本，验证新模型的图类型、布局及连线呈现。
- 继续推进外部库、跨文件及跨 filePart 对象加载，跟进源文件缺失引用和分类器缺名称问题。

## 2026-10-31 新模型解析问题修复

- 修复 target InputPin 漏解析；补齐 AssociationClass、InformationFlow、实例槽位、动作、InteractionUse、TimeExpression 的语义特征；收敛合法匿名节点及已知元类诊断。
- AssociationClass/InformationFlow 以完整语义关系输出，关联类仍保留分类器内容；同步解析前端模型树、Schema 注释及接口契约。
- 新增 9 项脱敏回归测试；修正真实模型测试路径。npm test 72/72、build、前端脚本语法检查、diff --check 通过。
- 重新解析七个真实模型并校验 Schema；恢复 6 个引脚，645 处相关特征引用对照通过，原有对象属性/归属/引用/文本及图形数据保留。未知元类 122→0；缺名称 143→20；悬空引用 11→5（剩余目标在 HSUV XML 中确实缺失）。
- 结果另存 E:\301\模型\解析修复验证_20261031。详细记录见 docs/parser-fixes-20261031.md。Java 业务规则和浏览器交互未在本次验证。

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

m

## 2026-10-10 工作记录（引用诊断与关系端点）

- 复核当前代码已具备 v1.1.0、关系来源、视图分类及 owner 回溯；此前末尾反馈不完全代表当前实现状态。
- 修复 external View 同时报本地悬空、local #id 被收入外部索引的问题；MagicDraw filePart 视图不再整体豁免引用诊断。
- 关系诊断保留原始引用来源，外部同名 ID 不再掩盖本地端点缺失；外部属性端点和视图引用也纳入索引。
- 补充 Generalization specific/general、Include includingCase/addition、Extend extension/extendedCase、Message sendEvent/receiveEvent 的属性及嵌套引用解析；前三类关系可从 owner 补充隐式源端。多值端点去重。
- Message 端点保持事件 ID，尚未新增事件到生命线的归一化映射；补充消息发生规约和 Gate 元类识别。
- 契约补齐 extensions 定义、引用诊断和端点语义。裸 ID 的外部视图索引回退仍有来源歧义，跨文件对象合并尚未实现。
- 后续工作：图形连线保留语义绑定、重复 ID 的作用域及后续绑定、Connector 端点角色和真实顺序图样例。
- 验证：新增 5 项回归测试，总计 28/28 通过（包含 test1.xml、test2.xml 真实模型）；npm run build 与 git diff --check 通过。

## 2026-10-10 工作记录（图形绑定与顺序图端点）

- 图形 Edge/Link/Path 增加 `sourceViewId`、`targetViewId`，按所属 Diagram 解析端点；重复 View ID 不再跨图串联。
- 已有 `modelElementId` 的图形连线保留原语义关系；只有没有语义绑定的连线才生成 `relationOrigin: diagram` 的补充关系。语义绑定损坏时保留原引用并输出悬空诊断。
- Message 保持事件 ID 端点，并依据 MessageOccurrenceSpecification 的 `covered` 解析 `sourceLifelineIds` / `targetLifelineIds`。
- 增加重复关系、重复绘图 ID、语义连线保护、消息到生命线映射等回归测试。
- 验证：`npm test` 32/32 通过，`npm run build` 通过；test1.xml 的 190 条图形连线均绑定已有语义关系，不再重复生成 diagram-link。
- Connector/Association 关系补充 `roleIds`，独立保留 role、partWithPort、property、connectorEnd 引用与 `endIds`；新增嵌套端点回归测试。
- Schema 已通过 JSON 解析校验；最终验证 `npm test` 33/33 通过，`npm run build` 通过。

## 本周工作汇总（2026-10 至 2026-10-10）

### 解析器改进

- 统一外部引用与本地引用的判定：`file#id` 记录为外部引用，`#id` 按本地引用诊断；外部同名 ID 不再掩盖本地悬空引用。视图引用、关系端点和 MagicDraw filePart 中的模型引用均纳入统一处理。
- 扩展关系端点解析：支持直接属性、嵌套引用、包装节点和多值端点；补齐 Generalization、Include、Extend、Message 的专用端点语义，并对端点数组去重。
- 改进图形连线处理：新增 View 的 `sourceViewId` / `targetViewId`；按所属 Diagram 解析端点，避免重复 ID 跨图绑定。已有语义关系的连线保留原绑定，只有纯图形连线才生成 `relationOrigin: diagram` 的补充关系。
- 完善顺序图数据：Message 保持发送/接收事件 ID，同时依据发生规约的 `covered` 引用解析 `sourceLifelineIds` / `targetLifelineIds`；补充 MessageOccurrenceSpecification、OccurrenceSpecification、ExecutionOccurrenceSpecification 和 Gate 元类识别。
- 完善 Connector/Association 端点：新增 `roleIds`，区分连接端节点 `endIds` 与 `role`、`partWithPort`、`property`、`connectorEnd` 等角色引用。
- 处理重复对象绑定：重复关系、Diagram 和 View 均保留，不再由 Map 静默覆盖；新增重复绘图 ID 下的端点归属测试。

### 接口与文档

- 更新 `ParsedModel v1.1.0` 的 TypeScript 类型、接口契约和 JSON Schema，补充 `sourceViewId`、`targetViewId`、`sourceLifelineIds`、`targetLifelineIds` 和 `roleIds`。
- 明确语义关系与图形连线的区别、视图模型引用可能落入的集合，以及外部引用索引的边界。

### 验证结果

- 新增关系端点、外部引用、filePart 视图、重复 ID、图形连线保护、消息生命线映射和 Connector 角色引用回归测试。
- `npm test`：33/33 通过。
- `npm run build`：通过。
- `schema/parsed-model.schema.json`：JSON 解析校验通过。
- 使用 `test1.xml`、`test2.xml` 进行真实 MagicDraw 样例回归；`test1.xml` 中 190 条图形连线均绑定已有语义关系，不再重复生成 diagram-link。

### 后续计划

- 完善跨 filePart 模型的自动加载与对象合并。
- 继续补充真实用例图、顺序图和 Connector 样例。
- 明确跨文件同名 ID 的命名空间和持久化缓存策略。

## 2026-10-10 工作记录（低风险诊断收敛）

- 根据 `distiller model.xml` 的实际诊断，补充 FlowPort、FlowProperty、FlowSpecification、ReferenceProperty、ValueType、QuantityKind、Unit、ActivityPartition、AllocateActivityPartition、ForkNode、CentralBufferNode、OpaqueBehavior、InteractionOperand、InteractionConstraint、Trigger、ChangeEvent、CombinedFragment、DependencyMatrix、MatrixFilter、DiagramTable、ICD Table 等 MagicDraw/UML 扩展元类白名单。
- 将合法匿名的活动节点、状态机节点、消息发生规约、生命线、依赖/实现关系等加入名称豁免集合，减少误报的 `MISSING_NAME`。
- 新增白名单和匿名节点回归测试。
- 验证：`npm test` 34/34 通过，`npm run build` 通过。
- 使用当前版本重新检查 `distiller model.xml` 时，诊断已由前一轮的 609 条降至 20 条（372 条未知元类和 237 条名称警告被收敛）；剩余主要是 Rationale、useCaseModel、RequirementTable 及消息发生规约/状态节点。继续补齐这些低风险白名单与名称豁免后，待文件输出权限恢复再做最终 CLI 统计。

## 2026-10-16 工作记录（九大图解析补全）

- 新增九大图脱敏 XML 样例和 13 项回归测试；按图种、元素/关系、XML 片段和输出变化记录于 `docs/parser-improvements-20261016.md`。
- 固定具体类型的 UML 特征节点支持省略 xmi:type；Property 的 type 继续保留为分类器引用。补齐 ConnectorEnd 定义及属性形式的 role/partWithPort。
- 补齐 PackageImport/PackageMerge 的目标字段、属性/嵌套引用及 owner 源端回退；补充 DecisionNode/MergeNode/JoinNode 的识别和合法匿名豁免。
- 构造型应用根据命名空间限定标签和 base_* 识别，支持任意前缀别名；去重附着到本地基础对象，并在 extensions 保留 Requirement Id/Text 等载荷。外部引用及库 filePart 应用不附着本地同名对象。
- 通用 Edge/Link/Path 导出按所属 Diagram 解析的 sourceViewId/targetViewId；冲突端点输出诊断。
- 九大图的直接图类型和内嵌类型统一规范化；test1.xml 中 24 条带 SysML 前缀的图结构记录改为正确分类。
- 修正 Schema 将 roleIds 错放到 View 的问题，同步接口契约和协作版本说明。
- 验证：npm test 47/47 通过；npm run build、git diff --check 通过。九大图样例及 test1.xml、test2.xml、distiller model.xml 的完整结果均通过 Draft 2020-12 Schema 校验，四者解析诊断均为空；业务校验未在本轮执行。

## 2026-10-16 第二轮工作记录（语义引用与文本）

- 输出契约升级至 ParsedModel v1.2.0，新增可选 references/textValues；同步类型、JSON Schema、JSON/JS 样例、版本说明和契约。
- 新增 src/semantic-features.ts，按已配置 UML 特征提取属性/嵌套引用，保留本地 ID 与完整外部 URI的区别；导出带 ID 的内嵌对象引用，无 ID 值/表达式按相对特征路径保存。
- 保留 OpaqueExpression/OpaqueBehavior 的 body/language、Literal value、需求 Id/Text 的顺序、重复值、空串、前导零和原始空白；禁用标签数值自动转换。
- 支持嵌套 base_Class 构造型绑定、直接 UML 类型标签，以及 trigger/operand/interactionConstraint/extensionPoint 的固定类型推断。
- 完善 Lifeline represents、执行片段 start/finish、状态转换 trigger/event/effect、UseCase extensionLocation、Property type/多重性等语义细节。
- 修复 Association ownedEnd 的类型引用被误算为额外端点，以及端点遍历吸入嵌套语义对象引用的问题；外部索引对多值引用逐个分词。
- 新增 examples/semantic-details.sysml.xml 和 16 项测试；详细九大图对应 XML 与输出说明见 docs/parser-improvements-20261016-round2.md。
- 验证：npm test 63/63、npm run build、git diff --check 通过；两个合成 XML 及三个真实模型完整输出、两个 JSON 样例共 7 份数据通过 v1.2.0 Schema 校验。五份 XML 解析诊断为空；Java 业务校验及新字段消费未在本轮修改或验证。
- 真实 test1.xml 中已有 516 个元素/关系记录带 references、181 个带 textValues；distiller model.xml 分别为 1356、218。已核对 test1.xml 的 N_vis 公式正文与 English 语言字段。

## 本周工作汇总（2026-10-12 至 2026-10-16）

### 一、解析器主要改进

- 完善九大图中元素、关系和嵌套语义特征的提取，补齐固定类型节点省略 `xmi:type` 时的识别；支持直接 `uml:Class` 等 UML 类型标签。Property 的普通 `type` 属性继续作为分类器引用保留。
- 补齐 ConnectorEnd 定义和属性/子节点形式的 `role`、`partWithPort` 引用；既保留连接器整体的 `endIds`、`roleIds`，也能按端元素查询端口与部件的对应关系。
- 构造型应用不再依赖固定的 `sysml:` 前缀，支持 `base_*` 属性及嵌套引用；将构造型附着到本地基础元素或关系，并保留需求编号、正文等应用数据。
- 保留表达式和行为的正文、语言及字面量值，避免子节点文本丢失、前导零被转换、重复值及空文本位置丢失；无 ID 的内联表达式按相对 XML 特征路径保存。
- 修复 Association 的关联端类型引用被误算为额外端点，以及守卫、默认值、表达式等内部引用被混入外层关系端点的问题。
- 统一直接图类型与 MagicDraw 内嵌图类型的名称规范化；修正 `test1.xml` 中 24 条带 SysML 前缀的图结构记录分类。通用连线导出按所属 Diagram 解析的视图端点，冲突端点输出诊断。
- 外部引用索引逐个处理多值引用；新语义引用字段保留完整外部 URI，避免与本地同名 ID 混淆。

### 二、九大图对应元素、关系与 XML 部分

| 图种 | 对应元素或关系 | XML 对应部分与本周完善 |
|---|---|---|
| 块定义图 BDD | Property、Association、Generalization、Block | `ownedAttribute/type`、`lowerValue`、`upperValue` 保留类型及多重性；`ownedEnd/type` 不再污染关联端集合；`generalization` 支持缺省类型与源端 |
| 内部块图 IBD | Connector、ConnectorEnd、Port、部件引用 | `end/@role`、`end/@partWithPort` 及嵌套 `role` 归一化，保留连接端、端口和部件的配对 |
| 需求图 REQ | Requirement、Satisfy | `base_Class`、`base_Dependency` 支持属性和嵌套形式；`Id`、`Text` 支持子节点文本，保留编号前导零和正文空白 |
| 参数图 PAR | ConstraintBlock、BindingConnector、Constraint、OpaqueExpression | 保留绑定端角色；提取 `constrainedElement`、`specification/body`、`language`，保留公式正文及语言顺序 |
| 用例图 UC | Include、Extend、ExtensionPoint | 补齐 `include`、`extend` 的固定类型识别与端点方向；保留 `extensionPoint`、`extensionLocation`，与目标用例分别记录 |
| 活动图 ACT | DecisionNode、MergeNode、JoinNode、ControlFlow、guard | 补充控制节点识别及合法匿名豁免；保留 `guard/specification/body`，守卫内部引用不混入控制流端点 |
| 顺序图 SEQ | Lifeline、Message、执行片段、CombinedFragment、InteractionOperand | `lifeline`、`message` 可省略固定类型；保留 `represents`、`covered`、`start`、`finish`、`operand/guard`，支持消息事件到生命线映射 |
| 状态机图 STM | Region、Transition、Trigger、Event、FinalState | 补齐固定类型识别；保留 `trigger/event`、`effect/body`、守卫及归属，转换源端与目标端保持独立 |
| 包图 PKG | PackageImport、PackageMerge | 解析 `importedPackage`、`mergedPackage`，支持嵌套目标及 owner 源端回退；保留外部包的完整 URI |

### 三、接口、样例与文档

- 输出契约由 `ParsedModel v1.1.0` 升至 `v1.2.0`，新增可选 `references`、`textValues`，保留原有字段；同步 TypeScript 类型、JSON Schema、JSON/JS 样例、README 和协作说明。
- `references` 保存按 XML 特征名归类的引用，本地引用归一化为 ID，外部引用保留 `file#id`；`textValues` 保存有序文本数组。原始 XML 属性继续放在 `attributes`，不被子节点数据覆盖。
- 修正 JSON Schema 中 `roleIds` 被误放在 View、未定义在 Relation 的问题。
- 新增 `src/semantic-features.ts`，集中处理语义特征；新增 `examples/nine-diagrams.sysml.xml`、`examples/semantic-details.sysml.xml` 两份脱敏样例及对应测试。
- 九大图逐项 XML 与输出说明：`docs/parser-improvements-20261016.md`、`docs/parser-improvements-20261016-round2.md`；当前接口见 `docs/parsed-model-contract.md`。

### 四、验证结果

- 本周新增 29 项测试，总数从 34 项增至 63 项，最终 `npm test` 为 **63/63 通过**；`npm run build`、`git diff --check` 通过。
- 两份合成 XML 和 `test1.xml`、`test2.xml`、`distiller model.xml` 的完整输出，以及两份 JSON 样例，共 7 份数据通过 v1.2.0 JSON Schema Draft 2020-12 校验；五份 XML 的解析诊断均为空。
- `test1.xml`：855 个元素、240 条关系、54 张图、711 个视图；516 个元素或关系记录带 `references`，181 个带 `textValues`。已核对真实公式 `N_vis = N * (R/(R+H))*El` 及 English 语言字段。
- `distiller model.xml`：1616 个元素、427 条关系、60 张图、2006 个视图；1356 个元素或关系记录带 `references`，218 个带 `textValues`。
- 上述结果验证解析和输出契约；本周未修改或验证 Java 业务校验对新字段的消费逻辑，解析诊断为空不代表模型通过业务质量校验。

### 五、后续工作

- 补充真实用例图、顺序图、参数图和状态机图样本，继续检查嵌套引用及厂商扩展的覆盖。
- 推进跨文件、跨 filePart 对象加载与合并，明确同名 ID 的来源和作用域。
- 与校验模块对齐 v1.2.0 契约及新字段消费，开展联合业务校验回归。
