# 2026-10-16 九大图解析完善说明

本文记录第一轮 v1.1.0 的修改。后续 v1.2.0 的嵌套引用、表达式与需求文本完善见 [第二轮说明](parser-improvements-20261016-round2.md)。

本轮继续完善 XML/XMI 解析和统一模型输出。保持 ParsedModel v1.1.0 的字段结构，补齐遗漏的数据、规范化规则和 Schema 定义；不执行模型业务校验。以下 XML 是脱敏示例；完整可运行版本在 `examples/nine-diagrams.sysml.xml`，断言在 `test/nine-diagrams.test.ts`。

## 九大图对应改进

| 图种 | 对应元素或关系 | 原有缺漏 | 本轮结果 |
|---|---|---|---|
| 块定义图 BDD | Property、Association 的 ownedEnd、Generalization、Block | 固定类型节点省略 xmi:type 时可能漏掉或类型错误；非 sysml 前缀的 Block 应用未附着 | 推断固定元类，保留属性分类器引用；关联端进入 elements；泛化方向和 Block 构造型可查询 |
| 内部块图 IBD | Connector、ConnectorEnd、Port、PartProperty 引用 | end 属性中的 role/partWithPort 未进入关系角色数组；无 xmi:type 的 end 未进入元素集合 | endIds 指向 ConnectorEnd，roleIds 包含端口和部件引用，通用连线导出视图端点 |
| 需求图 REQ | Requirement、Satisfy | 构造型前缀写死；已知 Requirement 应用的 Id/Text 未必保留 | 支持 Requirements 等前缀，构造型附着基础 Class/Dependency，原始需求属性保留在 extensions |
| 参数图 PAR | ConstraintBlock、BindingConnector、约束参数与约束属性 | 非 sysml 前缀的构造型未附着；绑定端的属性形式引用未归一化 | 保留 UML Connector + BindingConnector 构造型，输出 endIds/roleIds |
| 用例图 UC | Include、Extend | 省略 xmi:type 的 include/extend 子节点可能漏掉 | 分别按 includingCase→addition、extension→extendedCase 解析，缺省源端取所属用例 |
| 活动图 ACT | DecisionNode、MergeNode、JoinNode、ControlFlow | 三类合法控制节点不在已知元类及匿名名称豁免集合 | 保留为语义元素，不误报未知元类或缺少名称；控制流仍指向节点 |
| 顺序图 SEQ | Lifeline、Message、消息发生规约 | lifeline/message 省略 xmi:type 时可能漏掉，影响事件到生命线映射 | 推断元类，保留事件端点，并输出 sourceLifelineIds/targetLifelineIds |
| 状态机图 STM | Region、Transition、guard Constraint | 固定类型节点省略 xmi:type 时类型不规范或漏掉 | region/transition/guard 推断为 Region/Transition/Constraint，保留所有权和转换方向 |
| 包图 PKG | PackageImport、PackageMerge | 未解析 importedPackage/mergedPackage 专用目标字段及缺省源端 | importingNamespace→importedPackage、receivingPackage→mergedPackage，支持属性及嵌套引用 |

这些改进针对列出的序列化形式；九种图的业务规则、所有厂商扩展、跨文件对象自动加载不在本轮完成范围内。

## 1. 块定义图：属性、关联端、泛化

```xml
<packagedElement xmi:type="uml:Class" xmi:id="drive" name="Drive">
  <ownedAttribute xmi:id="motor-part" name="motor" type="motor"/>
  <generalization xmi:id="inherits-motor" general="motor"/>
</packagedElement>
<packagedElement xmi:type="uml:Association" xmi:id="association"
                 memberEnd="association-a association-b">
  <ownedEnd xmi:id="association-a" type="motor"/>
  <ownedEnd xmi:id="association-b" type="controller"/>
</packagedElement>
<Blocks:Block xmi:id="drive-block" base_Class="#drive"/>
```

`motor-part.metaClass = uml:Property`，`attributes.type = motor`，不是将 motor 当成元类；`ownerId = drive`。泛化为 `sourceId = drive`、`targetId = motor`。关联的 `endIds` 指向两个已保留的 Property；关联端顺序不被解释成有向 source/target。drive 的 `stereotypes` 包含 Block，基础元类仍是 uml:Class。

## 2. 内部块图：连接端、端口与部件

```xml
<ownedConnector xmi:id="power-wire">
  <end xmi:id="power-source"
       role="controller-port" partWithPort="controller-part"/>
  <end xmi:id="power-target"
       role="motor-port" partWithPort="motor-part"/>
</ownedConnector>
```

解析输出：

```js
{
  id: 'power-wire', kind: 'uml:Connector',
  endIds: ['power-source', 'power-target'],
  roleIds: ['controller-port', 'controller-part', 'motor-port', 'motor-part']
}
```

两个 end 以 `uml:ConnectorEnd` 进入 elements，ownerId 为 power-wire。`roleIds` 是引用并集；具体哪个端对应哪个 role/partWithPort，仍通过 endIds 查询端元素的原始 attributes。不会假定端数组顺序就是信号方向。缺失的本地角色引用产生 DANGLING_REFERENCE。

## 3. 需求图：需求编号、正文和满足关系

```xml
<packagedElement xmi:type="uml:Class" xmi:id="speed-requirement"
                 name="SpeedRequirement"/>
<Requirements:Requirement xmi:id="requirement-application"
  base_Class="speed-requirement" Id="REQ-001" Text="Speed shall be limited."/>
<packagedElement xmi:type="uml:Dependency" xmi:id="satisfy-speed"
                 client="drive" supplier="speed-requirement"/>
<Requirements:Satisfy xmi:id="satisfy-application"
                      base_Dependency="satisfy-speed"/>
```

基础 Class 的 stereotypes 包含 Requirement，Dependency 的 stereotypes 包含 Satisfy。`satisfy-speed.sourceId = drive`，`targetId = speed-requirement`；不会把构造型应用再解析成第二条 Satisfy 关系。

需求正文和编号保留在扩展节点：

```js
const application = model.extensions.find(x => x.id === 'requirement-application');
application.attributes.base_Class; // 'speed-requirement'
application.attributes.Id;         // 'REQ-001'
application.attributes.Text;       // 'Speed shall be limited.'
```

前缀 Requirements、Blocks、Constraints 等由导出工具选择。本轮依据命名空间限定节点及 base_* 绑定识别构造型应用，不再要求字面前缀为 sysml。显式外部 base 引用不绑定本地同名对象；库 filePart 内的应用不污染本地模型。

## 4. 参数图：约束块和绑定连接器

```xml
<Constraints:ConstraintBlock xmi:id="constraint-application"
                            base_Class="speed-constraint"/>
<ownedConnector xmi:id="speed-binding">
  <end xmi:id="binding-a" role="speed"/>
  <end xmi:id="binding-b" role="constraint-input"
       partWithPort="constraint-property"/>
</ownedConnector>
<Constraints:BindingConnector xmi:id="binding-application"
                              base_Connector="speed-binding"/>
```

speed-constraint 的 stereotypes 包含 ConstraintBlock；speed-binding 保持 `kind = uml:Connector`，stereotypes 包含 BindingConnector，roleIds 为 speed、constraint-input、constraint-property。绑定连接器不被自动赋予数据流方向。

## 5. 用例图：包含与扩展

```xml
<packagedElement xmi:type="uml:UseCase" xmi:id="start" name="Start">
  <include xmi:id="include-check" addition="check"/>
  <extend xmi:id="extend-stop">
    <extendedCase xmi:idref="stop"/>
  </extend>
</packagedElement>
```

不要求两个子节点重复声明 xmi:type。包含关系：start→check；扩展关系：start→stop，其中 start 是扩展用例、stop 是被扩展的基础用例。原有显式 includingCase/extension 源端仍优先于 owner 回退。

## 6. 活动图：分支、合并、汇合

```xml
<node xmi:type="uml:DecisionNode" xmi:id="decision"/>
<node xmi:type="uml:MergeNode" xmi:id="merge"/>
<node xmi:type="uml:JoinNode" xmi:id="join"/>
<edge xmi:type="uml:ControlFlow" xmi:id="control-flow"
      source="initial" target="decision"/>
```

三种节点均可合法匿名，进入 elements 后不误报 UNKNOWN_METACLASS / MISSING_NAME。ControlFlow 保持 initial→decision。node 是多态特征，仍必须声明其具体 xmi:type；本轮没有把任意 node 猜成某种活动节点。

## 7. 顺序图：消息与生命线

```xml
<lifeline xmi:id="operator-line" name="operator"/>
<lifeline xmi:id="controller-line" name="controller"/>
<fragment xmi:type="uml:MessageOccurrenceSpecification"
          xmi:id="send" covered="operator-line"/>
<fragment xmi:type="uml:MessageOccurrenceSpecification"
          xmi:id="receive" covered="controller-line"/>
<message xmi:id="start-message" name="start"
         sendEvent="send" receiveEvent="receive"/>
```

lifeline/message 自动推断元类，fragment 仍使用显式类型。消息结果：`sourceId = send`、`targetId = receive`，`sourceLifelineIds = ['operator-line']`、`targetLifelineIds = ['controller-line']`。事件端点与生命线端点保持不同语义。

## 8. 状态机图：区域、转换和守卫

```xml
<region xmi:id="region">
  <subvertex xmi:type="uml:State" xmi:id="idle" name="Idle"/>
  <subvertex xmi:type="uml:State" xmi:id="running" name="Running"/>
  <transition xmi:id="start-transition" source="idle" target="running">
    <guard xmi:id="start-guard" name="CanStart"/>
  </transition>
</region>
```

region / transition / guard 分别推断为 UML Region / Transition / Constraint。转换为 idle→running，guard 的 ownerId 为 start-transition。这里完善的是 guard 元素及归属的提取；没有执行守卫表达式。

## 9. 包图：包导入与包合并

```xml
<packagedElement xmi:type="uml:Package" xmi:id="system" name="System">
  <packageImport xmi:id="import-library">
    <importedPackage xmi:idref="library"/>
  </packageImport>
  <packageMerge xmi:id="merge-base" mergedPackage="base"/>
</packagedElement>
```

结果分别为 system→library、system→base。显式 importingNamespace / receivingPackage 可覆盖 owner 源端回退。本地目标缺失会报悬空引用，`library.uml#external` 则保留为外部引用，不伪报本地缺失。

## 通用图形与接口修复

```xml
<diagram xmi:id="ibd" diagramType="SysML Internal Block Diagram">
  <shape xmi:id="controller-view" modelElement="controller"/>
  <shape xmi:id="motor-view" modelElement="motor"/>
  <edge xmi:id="wire-view" modelElement="power-wire"
        sourceView="#controller-view">
    <endpoint><targetView xmi:idref="motor-view"/></endpoint>
  </edge>
</diagram>
```

直接声明的 diagramType 与 MagicDraw 的 DiagramRepresentationObject 使用同一套九大图名称规范化。此例图类型为 Internal Block Diagram，连线 sourceViewId/targetViewId 为 controller-view/motor-view，仍绑定原 Connector power-wire。以前通用 edge 的端点只做有效性检查，现在也导出规范化字段。

端点解析限定在所属 Diagram 内，避免同名 View 跨图绑定；同一端声明多个不同 View 时输出 INVALID_VIEW。图结构记录的类型比较也会先规范化，避免带 SysML 前缀的图自身记录被当成普通可绘制节点。

修正 JSON Schema 中 roleIds 被误放在 View 而不在 Relation 的问题；实际关系导出可以通过严格 Schema 校验。同步修正协作说明的接口版本和契约中陈旧的 Message 说明。

## 验证结果

- 自动测试：47 项，包含九大图样例、负例及真实 MagicDraw 模型。
- TypeScript 构建：通过。
- 九大图样例：44 个元素、12 条关系、9 张图、4 个视图，解析诊断为空。
- test1.xml：855 个元素、240 条关系、54 张图、711 个视图，解析诊断为空；11 条关系有 roleIds；24 条带 SysML 图类型前缀的结构记录被正确分类，结构记录总数为 162。
- test2.xml：18 个元素、6 条关系、1 张图、20 个视图，解析诊断为空。
- distiller model.xml：1616 个元素、427 条关系、60 张图、2006 个视图，解析诊断为空；66 条关系有 roleIds。
- 上述四个完整解析结果均通过 JSON Schema Draft 2020-12 校验，包含新增保留的构造型应用数据。

解析诊断为空仅说明本轮检查没有报告解析问题，不代表模型已经通过业务质量校验。
