# SysML Parser

2026-10-31：修复 Clean XMI 的目标输入引脚、关联类、信息流、实例槽位及动作引用遗漏，详见 [修复与验证记录](docs/parser-fixes-20261031.md)。脱敏回归样例：`examples/clean-xmi-semantics.sysml.xml`。

MagicDraw/M-Design XMI/XML 的第一阶段解析服务。它将 XML 转为与工具版本无关的模型、元素、关系、图和视图数据，并报告重复 ID、悬空引用、缺少名称及不支持的输入。

## 使用

```powershell
npm install
npm test
npm run dev
```

启动后在浏览器打开 `http://localhost:3000`：导入 XML/XMI 后即可浏览模型树、统计、图列表、图元几何位置与元素详情。前端使用同一服务的 API，无需另行配置端口或跨域。

导入模型：

```powershell
curl.exe -X POST --data-binary "@examples/sample.sysml.xml" -H "Content-Type: application/xml" http://localhost:3000/api/models/import
```

接口：`POST /api/models/import`、`GET /api/models/{id}/tree`、`GET /api/diagrams/{id}`、`GET /api/elements/{id}`。

导出供校验模块直接导入的 ES module：

```powershell
npm run parse -- examples/sample.sysml.xml output/sample.parsed.js
```

生成文件同时提供默认导出和具名导出 `parsedModel`。导入服务端模型后，也可请求 `GET /api/models/{id}/export.js` 下载同一格式的文件。

校验模块的用例图和顺序图回归样本位于 `examples/use-case-sequence.parsed-model.sample.json`，其中包含 Actor、UseCase、Include、Interaction、Lifeline 与 Message，以及对应的 Use Case Diagram 和 Sequence Diagram 视图。

当前实现采用通用 XMI 属性别名与元类识别；拿到真实 MagicDraw 导出样本后，应在 `src/adapter.ts` 增加版本专用别名/路径适配器。

九大图回归样例：`examples/nine-diagrams.sysml.xml`。本轮完善的元素、关系、XML 片段和输出变化见 [九大图解析完善说明](docs/parser-improvements-20261016.md)。

当前输出契约为 `ParsedModel v1.2.0`，新增可选 `references` / `textValues`，保留类型引用、表达式、需求文本和嵌套语义特征。详见 [第二轮九大图完善说明](docs/parser-improvements-20261016-round2.md)，对应样例为 `examples/semantic-details.sysml.xml`。
