# ParsedModel 接口契约 v1.2.0

解析模块将 XML/XMI 转换为以下 JavaScript 对象，供独立校验模块消费。校验模块不得直接读取 XML 或依赖解析器内部对象。

```ts
interface ParsedModel {
  schemaVersion: '1.2.0';
  id: string;
  source: { fileName: string; encoding: string; xmiVersion?: string; productVersion?: string };
  elements: ModelElement[];
  relations: Relation[];
  diagrams: Diagram[];
  views: View[];
  issues: ParseIssue[];       // 仅解析阶段问题，stage 固定为 parse
  statistics: Statistics;
  indexes?: Indexes;
  extensions?: ExtensionNode[];
}

interface ModelElement {
  id: string; metaClass: string; name?: string; qualifiedName?: string;
  ownerId?: string; childrenIds: string[]; stereotypes: string[];
  attributes: Record<string, string>; sourceXPath: string;
  references?: Record<string, string[]>;
  textValues?: Record<string, string[]>;
}

interface Relation extends ModelElement {
  kind: string; relationOrigin: 'semantic' | 'diagram';
  sourceId?: string; targetId?: string;
  sourceIds?: string[]; targetIds?: string[]; endIds: string[]; roleIds?: string[];
  sourceLifelineIds?: string[]; targetLifelineIds?: string[];
  direction?: string;
}

interface Diagram extends ModelElement {
  type: string; rootViewId?: string; imageRef?: string; viewIds: string[];
}

interface View {
  id: string; diagramId: string; modelElementId?: string; sourceViewId?: string; targetViewId?: string; kind: string;
  modelElementScope?: 'element' | 'relation' | 'diagram' | 'external' | 'unresolved';
  presentationKind: 'graphic' | 'diagram-structure';
  bounds?: string; waypoints?: string; label?: string;
  style: Record<string, string>; sourceXPath: string;
}

interface ExtensionNode {
  id?: string; tag: string; metaClass: string;
  attributes: Record<string, string>; sourceXPath: string;
  references?: Record<string, string[]>;
  textValues?: Record<string, string[]>;
}

interface Indexes {
  idsByFilePart: Record<string, string[]>;
  externalReferences: Array<{ href: string; file?: string; id: string }>;
}

interface ParseIssue {
  stage: 'parse';
  code: string; severity: 'error' | 'warning'; message: string; xpath: string;
  elementId?: string; referenceId?: string; diagramId?: string; viewId?: string;
}
```

`issues` 只描述 XML 格式、编码、ID、引用、元类、所有者和 Diagram/View 绑定问题。名称规范、可达性、覆盖率、方向一致性等 40 条合同规则由校验模块单独输出，不写入此字段。

## v1.2.0 语义特征

v1.2.0 在原有对象中增加可选 `references`、`textValues`，不删除原有字段。Schema 标识和 `schemaVersion` 同步为 1.2.0；严格按版本或 Schema 校验的消费者需要同步契约。

- `attributes` 继续保留当前节点的原始 XML 属性，不把子节点文本覆盖到其中。
- `references` 按 XML 特征名保存引用数组，例如 Property 的 `type`、Lifeline 的 `represents`、Trigger 的 `event`。本地 `#id` 规范化为 id，外部 `file#id` 保留完整 URI，避免与本地同名 ID 混淆。只有已配置的 UML 引用特征和 `base_*` 被提取，不把所有字符串属性猜成引用。
- 已导出的内嵌对象以引用连接，例如 `transition.references.trigger = ['trigger-id']`、`guard.references.specification = ['expression-id']`；内嵌对象的文本和引用由自身记录保存，不向祖先对象混入。
- `textValues` 保存 body、language、Text、Id、value 的原始字符串数组，保留顺序、重复值、空串、前导零和空白。XML 实体及 CDATA 按 XML 解析后的文本保存，不保留 CDATA 标记本身。
- 无 ID 的内联值或表达式使用相对 XML 特征路径，例如 `textValues['specification.body']`、`textValues['lowerValue.value']`；不会凭空给它创建全局语义 ID。
- 同一 body/language 特征分别保留各自出现顺序，不自动补齐缺失的语言，也不执行表达式。
- `references` 是数据提取结果，不代表每个目标都已加载或完成校验；原有关系端点及视图引用诊断规则继续适用。

类型引用、多重性、需求标签、表达式、触发器、执行片段等完整示例见 [第二轮完善说明](parser-improvements-20261016-round2.md)。

引用字段统一为规范化 ID，可能指向本地对象或尚未加载的外部对象。直接属性中的原始 URI 保留在 `attributes` 中，外部端点与视图引用的 URI 同时进入 `indexes.externalReferences`。`sourceId/targetId` 为单端点兼容字段，`sourceIds/targetIds` 用于多端点关系。`indexes` 为可选性能索引，不改变主数据语义。

### 关系端点约定

- AssociationClass：仅在 `relations` 中输出一次，保留分类器的属性、操作、约束、构造型、归属及 childrenIds；关联的 `memberEnd/ownedEnd` 同时进入 `references` 和 `endIds`。消费者枚举分类器时，应合并 `elements` 与 `relations` 中的 AssociationClass。
- InformationFlow：`informationSource → informationTarget`，进入 `relations`；`conveyed`（载荷）、`realizingConnector`、`realization`、`realizingActivityEdge`、`realizingMessage` 保存在 `references`。ItemFlow 构造型不改变 UML 元类。外部 URI 在 references 中保留完整形式，兼容端点字段继续使用片段 ID。
- Generalization：`specific → general`；未显式声明 specific 时，使用所属分类器。
- Include：`includingCase → addition`；Extend：`extension → extendedCase`。未显式声明源端时，使用所属用例。
- Message：`sendEvent → receiveEvent`，端点为消息事件/发生规约或 Gate 的 ID，不是生命线 ID。
- Message 同时提供可选的 `sourceLifelineIds` / `targetLifelineIds`，仅收集本地事件 `covered` 的 Lifeline；事件端点字段本身保持不变。
- Connector 等关系可额外提供 `roleIds`，表示 `role`、`partWithPort`、`property` 或 `connectorEnd` 引用；`endIds` 仍表示关系端节点本身。
- ConnectorEnd 中的属性形式 `role` / `partWithPort` 和子节点形式的引用均进入所属 Connector 的 `roleIds`。固定类型的 `<end xmi:id="…">` 即使省略 `xmi:type`，也会作为 `uml:ConnectorEnd` 元素保留。
- PackageImport：`importingNamespace → importedPackage`；PackageMerge：`receivingPackage → mergedPackage`。未显式声明源端时使用所属 owner，支持目标端的属性和嵌套引用形式。
- 支持直接属性、子引用节点、包装节点内引用及文本形式的多值端点，输出数组去重。

关系悬空诊断按每一处原始引用判断：`#id` 和裸 ID 按本地引用检查，`file#id` 按外部引用记录，其他位置出现同名外部 ID 不会掩盖本地端点缺失。

## 集合语义

- `elements` 包含 UML/SysML 语义元素。`ownerId` 仅在其 owner 也被导出时出现；无 ID 的 XML 包装节点不会作为虚拟 owner 泄漏到输出中。
- `relations` 同时包含语义关系和图上的边。`relationOrigin: 'semantic'` 表示 UML/SysML 语义关系；`relationOrigin: 'diagram'` 表示从 MagicDraw 图形 filePart 重建的连线。消费者必须依据该字段区分二者，不能以 ID 前缀或 `kind` 判断。
- `views` 包含所有已解析的 MagicDraw 呈现记录。`presentationKind: 'graphic'` 表示可绘制的图节点或边；`presentationKind: 'diagram-structure'` 表示图自身的结构记录。后者由以下稳定规则判定：MagicDraw 明确标识为 `diagramRepresentation` / `DiagramFrame`，或该记录没有 `modelElementId` 且原始 `kind` 与所属 `Diagram.type` 完全相等。`modelElementScope: 'diagram'` 本身不足以判定为结构记录，消费者不应自行按任意 `kind` 猜测。
- `view.modelElementId` 可落在 `elements`、`relations` 或 `diagrams`。`modelElementScope` 显式给出解析到的集合；`external` 表示 ID 命中 `indexes.externalReferences`、但其所属 filePart/Profile/库尚未加载；`unresolved` 表示本模型和外部索引中均没有对应对象；字段缺失表示该 View 本身没有模型引用。校验模块可跳过 `external`，但不得将 `unresolved` 视为有效引用。

## Extensions 与索引

`extensions` 保留已识别但未归一化为主模型对象的扩展 XML 节点，供下游诊断和追溯，不自动将其解释为语义元素。

模型主体中带 `base_*` 属性或直接子特征的命名空间限定节点作为构造型应用处理，不要求前缀必须为 `sysml:`。应用的局部名去重加入本地基础元素或关系的 `stereotypes`，基础对象的 `metaClass` / `kind` 保持 UML 类型。例如 `Requirements:Satisfy base_Dependency="d"` 为关系 d 添加 Satisfy 构造型，不额外创建一条关系。显式外部基础引用和 filePart 库内应用不附着到同名本地对象。

构造型应用节点也保留在 `extensions` 中，包括已知的 Requirement、Block、ConstraintBlock、BindingConnector 等。需求编号和正文可通过 `extensions[].attributes.base_Class` 关联基础元素，再读取原始 `Id` / `Text`；字段大小写和原始属性值保持不变。它们不会直接覆盖基础元素的 `attributes`。

对子节点形式的构造型应用，基础引用通过 `extensions[].references.base_Class` 等查询，需求正文和编号通过 `textValues.Text` / `textValues.Id` 查询；原属性形式也同步提供这两个可选字段。

固定具体类型的 UML 特征节点（ownedAttribute、ownedEnd、ownedParameter、ownedOperation、ownedConnector、end、generalization、include、extend、packageImport、packageMerge、lifeline、message、region、transition、ownedRule、guard、ownedComment、trigger、operand、interactionConstraint、extensionPoint）支持省略 `xmi:type`，显式元类声明始终优先。`ownedAttribute` / `ownedEnd` 的普通 `type` 属性仍表示分类器引用，不能当成元类。node、fragment、subvertex 等多态特征仍需要显式类型。

九种图的直接 `diagramType` / `humanType` / `type` 和 MagicDraw 内嵌图类型使用相同的别名规范化规则；支持 SysML 前缀、大小写及重复空白。图结构记录在比较类型时也使用相同规则。通用 Edge/Link/Path 与 MagicDraw mdElement 连线均输出按所属 Diagram 解析的 `sourceViewId` / `targetViewId`，同一端声明多个不同 View 时产生 `INVALID_VIEW`，不任取第一个。

本轮对应的 XML 片段和九大图逐项说明见 [九大图解析完善说明](parser-improvements-20261016.md)，可运行样例见 `examples/nine-diagrams.sysml.xml`。

`indexes.idsByFilePart` 按 MagicDraw filePart 名称列出导出 XML ID。`indexes.externalReferences` 记录外部 `href`、关系端点、视图模型引用和已提取语义特征引用的原始 URI、文件部分及规范化片段 ID；多值引用按每个 token 单独记录，不包含本地 `#id`，不代表外部文件已经加载。二者仅是辅助索引，不改变主数组的语义。

View 显式使用 `file#id` 时优先标记为 `external`，不会绑定到同名本地对象；显式 `#id` 不会因外部索引同名而跳过断链诊断。为兼容 MagicDraw 的裸 ID 库引用，裸 ID 在本地找不到对象时仍允许匹配外部索引；这类无文件来源的引用仍存在歧义。所有 `unresolved` View 均产生悬空诊断，包括 filePart 中的视图；`external` View 不产生本地悬空诊断。
