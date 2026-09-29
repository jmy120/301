# ParsedModel 接口契约 v1.1.0

解析模块将 XML/XMI 转换为以下 JavaScript 对象，供独立校验模块消费。校验模块不得直接读取 XML 或依赖解析器内部对象。

```ts
interface ParsedModel {
  schemaVersion: '1.1.0';
  id: string;
  source: { fileName: string; encoding: string; xmiVersion?: string; productVersion?: string };
  elements: ModelElement[];
  relations: Relation[];
  diagrams: Diagram[];
  views: View[];
  issues: ParseIssue[];       // 仅解析阶段问题，stage 固定为 parse
  statistics: Statistics;
  indexes?: Indexes;
}

interface ModelElement {
  id: string; metaClass: string; name?: string; qualifiedName?: string;
  ownerId?: string; childrenIds: string[]; stereotypes: string[];
  attributes: Record<string, string>; sourceXPath: string;
}

interface Relation extends ModelElement {
  kind: string; relationOrigin: 'semantic' | 'diagram';
  sourceId?: string; targetId?: string;
  sourceIds?: string[]; targetIds?: string[]; endIds: string[];
  direction?: string;
}

interface Diagram extends ModelElement {
  type: string; rootViewId?: string; imageRef?: string; viewIds: string[];
}

interface View {
  id: string; diagramId: string; modelElementId?: string; kind: string;
  modelElementScope?: 'element' | 'relation' | 'diagram' | 'external' | 'unresolved';
  presentationKind: 'graphic' | 'diagram-structure';
  bounds?: string; waypoints?: string; label?: string;
  style: Record<string, string>; sourceXPath: string;
}

interface ExtensionNode {
  id?: string; tag: string; metaClass: string;
  attributes: Record<string, string>; sourceXPath: string;
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

引用字段在解析模块中统一为本模型元素 ID；原始 URI 仍保留在 `attributes` 中。`sourceId/targetId` 为单端点兼容字段，`sourceIds/targetIds` 用于多端点关系。`indexes` 为可选性能索引，不改变主数据语义。

## 集合语义

- `elements` 包含 UML/SysML 语义元素。`ownerId` 仅在其 owner 也被导出时出现；无 ID 的 XML 包装节点不会作为虚拟 owner 泄漏到输出中。
- `relations` 同时包含语义关系和图上的边。`relationOrigin: 'semantic'` 表示 UML/SysML 语义关系；`relationOrigin: 'diagram'` 表示从 MagicDraw 图形 filePart 重建的连线。消费者必须依据该字段区分二者，不能以 ID 前缀或 `kind` 判断。
- `views` 包含所有已解析的 MagicDraw 呈现记录。`presentationKind: 'graphic'` 表示可绘制的图节点或边；`presentationKind: 'diagram-structure'` 表示图自身的结构记录。后者由以下稳定规则判定：MagicDraw 明确标识为 `diagramRepresentation` / `DiagramFrame`，或该记录没有 `modelElementId` 且原始 `kind` 与所属 `Diagram.type` 完全相等。`modelElementScope: 'diagram'` 本身不足以判定为结构记录，消费者不应自行按任意 `kind` 猜测。
- `view.modelElementId` 可落在 `elements`、`relations` 或 `diagrams`。`modelElementScope` 显式给出解析到的集合；`external` 表示 ID 命中 `indexes.externalReferences`、但其所属 filePart/Profile/库尚未加载；`unresolved` 表示本模型和外部索引中均没有对应对象；字段缺失表示该 View 本身没有模型引用。校验模块可跳过 `external`，但不得将 `unresolved` 视为有效引用。

## Extensions 与索引

`extensions` 保留已识别但未归一化为主模型对象的扩展 XML 节点，供下游诊断和追溯，不自动将其解释为语义元素。

`indexes.idsByFilePart` 按 MagicDraw filePart 名称列出导出 XML ID。`indexes.externalReferences` 记录每个外部 `href` 的原始 URI、可选文件部分及规范化片段 ID；它表示库/Profile 等导入模型外的引用，不能被当作本地悬空 ID。二者仅是辅助索引，不改变主数组的语义。
