# ParsedModel 接口契约 v1.0.0

解析模块将 XML/XMI 转换为以下 JavaScript 对象，供独立校验模块消费。校验模块不得直接读取 XML 或依赖解析器内部对象。

```ts
interface ParsedModel {
  schemaVersion: '1.0.0';
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
  kind: string; sourceId?: string; targetId?: string;
  sourceIds?: string[]; targetIds?: string[]; endIds: string[];
  direction?: string;
}

interface Diagram extends ModelElement {
  type: string; rootViewId?: string; imageRef?: string; viewIds: string[];
}

interface View {
  id: string; diagramId: string; modelElementId?: string; kind: string;
  bounds?: string; waypoints?: string; label?: string;
  style: Record<string, string>; sourceXPath: string;
}

interface ParseIssue {
  stage: 'parse';
  code: string; severity: 'error' | 'warning'; message: string; xpath: string;
  elementId?: string; referenceId?: string; diagramId?: string; viewId?: string;
}
```

`issues` 只描述 XML 格式、编码、ID、引用、元类、所有者和 Diagram/View 绑定问题。名称规范、可达性、覆盖率、方向一致性等 40 条合同规则由校验模块单独输出，不写入此字段。

引用字段在解析模块中统一为本模型元素 ID；原始 URI 仍保留在 `attributes` 中。`sourceId/targetId` 为单端点兼容字段，`sourceIds/targetIds` 用于多端点关系。`indexes` 为可选性能索引，不改变主数据语义。
