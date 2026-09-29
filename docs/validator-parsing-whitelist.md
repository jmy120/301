# 面向 40 条规则的 SysML 解析白名单

本白名单来源于 `40条校验规则详细说明.md`，定义解析模块必须导出的元类、关系与标准图类型。它只决定解析输出覆盖范围；40 条业务规则仍由校验模块执行。

| 图类型 | 校验规则依赖的元素 | 校验规则依赖的关系 |
|---|---|---|
| 模块定义图（BDD） | Block、Property、Operation、Port | Association、Dependency、Generalization |
| 内部块图（IBD） | Property、Port、Connector | Connector |
| 用例图 | Actor、UseCase | Association、Include、Extend |
| 活动图 | Activity、Action、InitialNode、Pseudostate、ActivityFinalNode、FlowFinalNode | ControlFlow |
| 顺序图 | Interaction、Lifeline | Message |
| 状态机图 | StateMachine、State、Pseudostate | Transition |
| 需求图 | Requirement | Satisfy、Verify、DeriveReqt、Refine、Trace |
| 参数图 | Block、ConstraintBlock、Constraint、Property、ValueProperty | BindingConnector |
| 包图 | Package | PackageImport、PackageMerge |

通用规则还依赖 `Model`、所有 Diagram/View 的名称、所有者、尺寸、绑定关系及视图数量。`Diagram.type` 使用规范化类型名称，如 `Block Definition Diagram`、`Internal Block Diagram`、`Use Case Diagram`。

MagicDraw 的 `uml:Diagram` 自身通常没有图类型；解析器须从其子树中 `diagram:DiagramRepresentationObject` 的 `type` 属性回填。对应源码白名单为 `src/sysml-whitelist.ts`。
