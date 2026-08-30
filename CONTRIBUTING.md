# 协作开发规范

## 模块边界

- `src/`：XML/XMI 解析模块和解析服务；
- `validator/`：模型校验模块；
- `schema/`：解析输出接口 Schema；
- `examples/`：脱敏 XML 和 ParsedModel JSON 样例。

解析模块输出 `ParsedModel v1.0.0`。校验模块只消费该对象，不直接读取 XML，也不依赖解析器内部实现。接口变更必须同时更新 Schema、样例和文档。

## 分支与提交

- `main` 只合并可构建、可测试的版本；
- 解析开发：`feature/parser-*`；
- 校验开发：`feature/validator-*`；
- 接口变更：`feature/model-contract-*`；
- 每个提交只完成一个目的，提交信息使用 `feat(parser): ...`、`fix(parser): ...`、`feat(validator): ...`、`docs(contract): ...` 等格式。

## 提交前检查

```powershell
npm test
npm run build
```

不得提交真实敏感模型、生成的日志、依赖目录或构建产物。
