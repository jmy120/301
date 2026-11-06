# Clean XMI 新模型解析修复（2026-10-31）

本次修复基于四个新增模型的 XML/输出对照结果，覆盖真实对象遗漏、引用特征缺失和匿名节点诊断。保留现有工作区改动，未提交 Git。

## 修改内容

- `target` 等标签只有在没有对象 ID 时才按引用包装节点处理。带 `xmi:id` 的 InputPin 定义正常进入元素集合，恢复 CallOperationAction 和 SendSignalAction 的目标输入引脚。
- AssociationClass 在 `relations` 中输出一次，保留类的属性、操作、约束、子对象、构造型和归属，同时提取 memberEnd/ownedEnd。三个解析前端的模型树同步包含关联类，避免分类调整后类及其内容在树中失去原有归属。
- InformationFlow 在 `relations` 中输出，源端和目标端分别来自 informationSource/informationTarget；载荷和实现关系使用 references 保留。外部 URI 保留完整来源，兼容端点字段继续采用已有片段 ID 约定。
- 补齐 InstanceSpecification.classifier/slot、Slot.definingFeature/value、InstanceValue.instance；保留外部 QUDV 引用、带 ID 值对象、无 ID 的内联值和原始数字字符串。
- 补齐动作族的 structuralFeature、classifier、signal、object、target、value、insertAt 等特征，以及 Operation.method、活动分区/中断区域、权重和其他已有归属特征的命名引用。
- 补齐 InteractionUse.covered/refersTo 与 TimeExpression.expr；没有在源 XML 中出现的引用不进行推断。
- 将此次出现的元类加入已知集合，允许 Slot、InstanceValue、动作、InteractionUse、TimeExpression、Port 等合法匿名对象；保留 Class/Interface 缺名称诊断。
- 两项 MagicDraw 真实模型测试改用当前 export 目录的相对路径，修复 ENOENT。

## 输出兼容性

继续使用 ParsedModel v1.2.0，未增加字段或更改字段类型。补充了 TypeScript 注释、Schema 说明、接口契约和脱敏 XML 样例。

AssociationClass 与 InformationFlow 从 `elements` 移至 `relations`，因此元素和关系数量会变化；每个 ID 仅输出一次。分类器消费者需要同时考虑 relations 中的 AssociationClass，具体字段约定见 [接口契约](parsed-model-contract.md)。解析前端模型树已适配；本次未修改或执行 Java 业务规则校验。

## 实测结果

| 模型 | 修复后元素/关系 | 未知元类（前→后） | 缺名称（前→后） | 悬空引用（前→后） |
|---|---:|---:|---:|---:|
| hybrid sport utility vehicle | 1365 / 338 | 39 → 0 | 56 → 8 | 5 → 5 |
| InvertedPendulum | 1177 / 385 | 83 → 0 | 85 → 12 | 6 → 0 |
| MultiMediaExample | 583 / 144 | 0 → 0 | 0 → 0 | 0 → 0 |
| WaterSupply | 70 / 23 | 0 → 0 | 2 → 0 | 0 → 0 |

HSUV 剩余 5 条引用错误与修复前完全相同，涉及的 3 个目标 ID 在源 XML 中确实没有定义。剩余 20 条缺名称提示分别为 HSUV 的 7 个 Class 和 1 个 Interface、InvertedPendulum 的 12 个 Class，未通过虚构名称或屏蔽诊断来消除。

四个输入仍为无图形数据的 Clean XMI，因此不生成图形数据。test1、test2、distiller model 诊断均为空，图和视图内容通过修复前后逐项对照。

## 验证

- 新增 9 项脱敏回归用例；`npm test` **72/72 通过**。
- `npm run build`、三个前端脚本的 `node --check`、`git diff --check` 通过。
- 七个真实模型完整输出均通过 Draft 2020-12 Schema 校验。
- 逐对象检查修复前后的属性、构造型、归属、限定名称、子对象、已有引用及文本值：原有数据均保留，另恢复 6 个 InputPin。
- 对照源 XML 验证 **645 处**本次相关特征引用（209 + 143 + 252 + 24 + 17），全部通过；完整检查结果见输出目录 `verification.json`。
- Java 业务规则及浏览器交互未在本次执行验证。

脱敏样例：`examples/clean-xmi-semantics.sysml.xml`；测试：`test/clean-xmi.test.ts`。

真实模型结果位于 `E:\301\模型\解析修复验证_20261031`，包含四个新模型的 `.parsed.js`、七个模型的 `.parsed.json`、`summary.json` 和 `verification.json`。修复前输出保留在 `解析检查_20261031`，便于对照。

本机复现命令（在解析器目录）：

```powershell
npm test
npm run build
node audit-new-models.mjs E:/301/模型/解析修复验证_20261031
E:\Anaconda3\python.exe verify-model-fixes.py
```

Python 对照脚本依赖 lxml、jsonschema，并读取本机的修复前检查目录；没有将真实模型加入回归样例。
