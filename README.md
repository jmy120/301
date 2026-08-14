# SysML Parser

MagicDraw/M-Design XMI/XML 的第一阶段解析服务。它将 XML 转为与工具版本无关的模型、元素、关系、图和视图数据，并报告重复 ID、悬空引用、缺少名称及不支持的输入。

## 使用

```powershell
npm install
npm test
npm run dev
```

导入模型：

```powershell
curl.exe -X POST --data-binary "@examples/sample.sysml.xml" -H "Content-Type: application/xml" http://localhost:3000/api/models/import
```

接口：`POST /api/models/import`、`GET /api/models/{id}/tree`、`GET /api/diagrams/{id}`、`GET /api/elements/{id}`。

当前实现采用通用 XMI 属性别名与元类识别；拿到真实 MagicDraw 导出样本后，应在 `src/adapter.ts` 增加版本专用别名/路径适配器。
