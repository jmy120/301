# 2026-10-16 第二轮：九大图中的语义细节保留

本轮针对“图和元素能解析出来，但具体类型、公式、触发器等数据未完整输出”的问题，新增可选 references、textValues 字段，并将输出契约升级为 ParsedModel v1.2.0。完整 XML 在 `examples/semantic-details.sysml.xml`，测试在 `test/semantic-features.test.ts`。

## 九大图对应关系

| 图种 | XML 对应部分 | 本轮输出变化 |
|---|---|---|
| 块定义图 | `ownedAttribute/type`、`lowerValue`、`upperValue`；直接 `uml:Class` 标签 | 嵌套 type 导出为 references.type；多重性可通过值节点引用查询；直接 UML 类型标签也进入语义集合 |
| 内部块图 | `Connector/end/role`、`partWithPort` | 每个 ConnectorEnd 记录自己的 references.role / partWithPort，方便按连接端查询端口与部件的配对 |
| 需求图 | `Requirement/base_Class`、`Id`、`Text` 子节点 | 识别嵌套构造型基础引用，需求编号和正文以字符串保留，0007 不再变成数字 7 |
| 参数图 | `Constraint/specification/body`、`language`、`constrainedElement` | 保留约束对象引用、公式正文、语言与多个表达式值的原始顺序 |
| 用例图 | `UseCase/extensionPoint`、`Extend/@extensionLocation` | 保留扩展点及引用，同时继续以 extendedCase 作为 Extend 的目标用例 |
| 活动图 | `ControlFlow/guard/specification/body` | 保留控制流到守卫、守卫到表达式的引用链和条件文本；不把条件内部引用混入流端点 |
| 顺序图 | `Lifeline/represents`、执行片段的 start/finish、CombinedFragment/operand/guard | 保留生命线代表的部件、执行区间起止事件、交互操作数及守卫的层级 |
| 状态机图 | `Transition/trigger/event`、`effect/body`、FinalState | 保留触发器、事件、效果行为及正文；识别可匿名的终止状态和事件/执行类元素 |
| 包图 | `PackageImport/@importedPackage="library.uml#Library"` | 新引用字段保留完整外部 URI，原 targetId 仍保留规范化 ID；外部索引逐个记录多值引用 |

## 1. 块定义图：类型与多重性

```xml
<uml:Class xmi:id="motor" name="Motor"/>
<ownedAttribute xmi:id="motors" name="motors">
  <type xmi:idref="motor"/>
  <lowerValue xmi:type="uml:LiteralInteger" xmi:id="lower" value="0"/>
  <upperValue xmi:type="uml:LiteralUnlimitedNatural" xmi:id="upper" value="*"/>
</ownedAttribute>
```

以前只读取 Property 自身的属性，看不到子节点 type。现在：

```js
motors.references = {
  type: ['motor'], lowerValue: ['lower'], upperValue: ['upper']
};
lower.textValues = { value: ['0'] };
upper.textValues = { value: ['*'] };
```

同时修复直接 `<uml:Class>` 没有 xmi:type 时未进入语义集合的问题。

另一个实际修复是 Association 的 ownedEnd：`<ownedEnd xmi:id="e"><type href="#motor"/></ownedEnd>` 的关系 endIds 只应包含 e，不能把 motor 误认为第二个关联端。现在类型引用留在端元素的 references.type 中。

## 2. 内部块图：按端查询端口和部件

```xml
<end xmi:id="end-b" role="motor-port" partWithPort="motor-part"/>
```

除了上一轮 Connector 的 roleIds 并集，本轮 end-b 本身还提供：

```js
end.references = { role: ['motor-port'], partWithPort: ['motor-part'] };
```

消费者可以通过 Connector.endIds 定位端记录，再得到该端对应的端口和部件。属性形式和 `<role xmi:idref="…"/>` 子节点形式输出一致。

## 3. 需求图：构造型绑定和正文都作为子节点

```xml
<Requirements:Requirement xmi:id="requirement-app">
  <base_Class><ref xmi:idref="requirement"/></base_Class>
  <Id>0007</Id>
  <Text>  At most five motors.  </Text>
</Requirements:Requirement>
```

现在可识别为 Requirement 应用，并向基础 Class 添加 Requirement 构造型。扩展记录为：

```js
{
  references: { base_Class: ['requirement'] },
  textValues: { Id: ['0007'], Text: ['  At most five motors.  '] }
}
```

前导零、正文空白保留，原始 attributes 不被改写。显式 `library.uml#requirement` 基础引用不会绑定到本地同名对象。

## 4. 参数图：公式正文与语言

```xml
<specification xmi:type="uml:OpaqueExpression" xmi:id="expression">
  <body>001</body><language>Text</language>
  <body><![CDATA[count < 5 && enabled]]></body><language>OCL</language>
</specification>
```

输出：

```js
expression.textValues = {
  body: ['001', 'count < 5 && enabled'], language: ['Text', 'OCL']
};
```

不再把 001 转成数字；true 也保留为文本。重复语言、空 body 均保留位置；CDATA 保留解析后的文本。Constraint 通过 references.specification 连接到表达式，通过 references.constrainedElement 连接被约束对象。

真实 test1.xml 中已核对的表达式为 `N_vis = N * (R/(R+H))*El`，language 为 English；此前正文没有出现在统一模型中。

## 5. 用例图：扩展点与目标用例分别保留

```xml
<extensionPoint xmi:id="point" name="BeforeStart"/>
<extend xmi:id="extend" extendedCase="base-case" extensionLocation="point"/>
```

point 识别为 uml:ExtensionPoint，Extend 的 references.extensionLocation 为 `['point']`，targetId 仍为 base-case，不把扩展点当作目标用例。

## 6. 活动图：守卫条件与引用边界

```xml
<edge xmi:type="uml:ControlFlow" xmi:id="flow" source="initial" target="final">
  <guard xmi:id="flow-guard">
    <specification xmi:type="uml:OpaqueExpression" xmi:id="flow-expression">
      <body>true</body><language>OCL</language>
    </specification>
  </guard>
</edge>
```

形成 flow.references.guard → flow-guard.references.specification → flow-expression.textValues.body 的引用链。每个对象保留自己的语义特征，祖先流不会吞入表达式里的 source/target。

## 7. 顺序图：生命线、执行区间和交互操作数

```xml
<lifeline xmi:id="line" name="motor"><represents xmi:idref="motors"/></lifeline>
<fragment xmi:type="uml:BehaviorExecutionSpecification" xmi:id="execution"
          covered="line" start="start" finish="finish"/>
<fragment xmi:type="uml:CombinedFragment" xmi:id="alt" interactionOperator="alt">
  <operand xmi:id="operand">
    <guard xmi:type="uml:InteractionConstraint" xmi:id="interaction-guard"/>
  </operand>
</fragment>
```

line.references.represents 为 motors；execution.references 包含 covered、start、finish；alt.references.operand 和 operand.references.guard 保留交互片段结构。operand 可省略 xmi:type；多态的 fragment 和此处 InteractionConstraint guard 使用明确类型。

## 8. 状态机图：事件和效果行为

```xml
<transition xmi:id="transition" source="idle" target="done">
  <trigger xmi:id="trigger"><event href="events.uml#StartEvent"/></trigger>
  <effect xmi:type="uml:OpaqueBehavior" xmi:id="effect">
    <body>stopMotor()</body><language>JavaScript</language>
  </effect>
</transition>
```

transition.references 包含 trigger 和 effect 的对象 ID；trigger.references.event 保留完整外部 URI；effect.textValues.body 为 `['stopMotor()']`。新字段不会执行效果代码或事件，也不改变转换的 idle→done 端点。

## 9. 包图：外部引用来源保留

```xml
<packageImport xmi:id="package-import" importedPackage="library.uml#Library"/>
```

`references.importedPackage = ['library.uml#Library']`，兼容字段 `targetId = 'Library'`。因此新字段中本地 Library 和 library.uml#Library 不会混成同一个字符串。外部文件仍不会自动加载。

## 无 ID 的内联表达式

```xml
<ownedRule xmi:id="constraint">
  <specification xmi:type="uml:OpaqueExpression"><body>001</body></specification>
</ownedRule>
```

无可引用的表达式 ID 时，正文保存为 `constraint.textValues['specification.body'] = ['001']`，不虚构全局元素 ID，也不把公式文本误存成对象引用。

## 验证与边界

- 新增 16 项测试，总计 63 项通过；包括真实模型公式、空文本、CDATA、内联无 ID 表达式、关系端点污染及本地/外部同名引用。
- npm run build 通过。
- 两个合成 XML 样例及 test1.xml、test2.xml、distiller model.xml 的完整输出通过 Draft 2020-12 Schema 校验，解析诊断均为空。
- test1.xml 中 516 个元素或关系记录有 references，181 个有 textValues；distiller model.xml 中分别为 1356、218 个。
- 引用和文本提取由明确的 UML 特征集合控制，不保证任意厂商扩展都自动解释；新增 references 也不代表已完成所有引用目标的加载或业务校验。
- 此轮更新解析器与输出契约；Java 业务校验及其新字段消费逻辑未在本轮修改或验证。
