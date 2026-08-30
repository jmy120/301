# 模型校验模块

本目录供模型校验模块开发使用。校验模块接收解析模块输出的 `ParsedModel v1.0.0` JavaScript/JSON 对象，执行合同约定的 40 条业务规则。

## 边界

- 不直接读取 XML/XMI；
- 不依赖 `src/parser.ts` 内部实现；
- 使用 [../schema/parsed-model.schema.json](../schema/parsed-model.schema.json) 校验输入；
- `parsedModel.issues` 仅包含解析阶段问题（`stage: "parse"`）；
- 校验结果应使用独立字段或返回对象，建议标记 `stage: "validate"`，不要覆盖解析问题。

## 建议目录

```text
validator/
  src/
    rules/       40 条规则定义
    engine.ts    规则执行入口
    types.ts     校验结果类型
  test/          规则单元测试
```

## 输入示例

使用 [../examples/parsed-model.sample.json](../examples/parsed-model.sample.json) 作为脱离 XML 的开发输入。接口变更必须同步更新 Schema、样例和本说明。
