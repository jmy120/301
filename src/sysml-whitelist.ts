/**
 * Parser support required by docs/40条校验规则详细说明.md. This is not a
 * validation-rule list: it defines the XML metaclasses that must survive in
 * ParsedModel so the independent validator can apply those rules.
 */
export const RULE_REQUIRED_METACLASSES = new Set([
  // Common and structural rules
  'Model', 'Package', 'Class', 'Block', 'Property', 'Operation', 'Port', 'Connector',
  // BDD and IBD
  'Association', 'Dependency', 'Generalization', 'ConnectorEnd',
  // Use-case diagrams
  'Actor', 'UseCase', 'Include', 'Extend',
  // Activity diagrams
  'Activity', 'Action', 'OpaqueAction', 'CallBehaviorAction', 'ControlFlow',
  'InitialNode', 'ActivityFinalNode', 'FlowFinalNode', 'Pseudostate',
  // Sequence diagrams
  'Interaction', 'Lifeline', 'Message',
  // State-machine diagrams
  'StateMachine', 'State', 'Transition',
  // Requirement and package diagrams are not rule-specific today, but are
  // retained for nine-diagram model coverage and traceability checks.
  'Requirement', 'Satisfy', 'Verify', 'DeriveReqt', 'Refine', 'Trace',
  'PackageImport', 'PackageMerge'
]);

export const RULE_REQUIRED_RELATIONS = new Set([
  'Association', 'Dependency', 'Generalization', 'Connector', 'ControlFlow',
  'Message', 'Transition', 'Include', 'Extend', 'Satisfy', 'Verify',
  'DeriveReqt', 'Refine', 'Trace', 'PackageImport', 'PackageMerge'
]);

const diagramTypeAliases: Record<string, string> = {
  'sysml block definition diagram': 'Block Definition Diagram',
  'block definition diagram': 'Block Definition Diagram',
  'sysml internal block diagram': 'Internal Block Diagram',
  'internal block diagram': 'Internal Block Diagram',
  'sysml requirement diagram': 'Requirement Diagram',
  'requirement diagram': 'Requirement Diagram',
  'sysml parametric diagram': 'Parametric Diagram',
  'parametric diagram': 'Parametric Diagram',
  'package diagram': 'Package Diagram',
  'use case diagram': 'Use Case Diagram',
  'activity diagram': 'Activity Diagram',
  'sequence diagram': 'Sequence Diagram',
  'state machine diagram': 'State Machine Diagram',
  'statechart diagram': 'State Machine Diagram'
};

export function canonicalDiagramType(value?: string): string | undefined {
  if (!value) return undefined;
  return diagramTypeAliases[value.trim().toLowerCase()] ?? value;
}
