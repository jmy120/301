import { RULE_REQUIRED_RELATIONS } from './sysml-whitelist.js';

const RELATION_TYPES = new Set([...RULE_REQUIRED_RELATIONS, 'AssociationClass', 'InformationFlow', 'ObjectFlow', 'Deployment', 'BindingConnector', 'ItemFlow', 'Allocate', 'Flow', 'Realization', 'InterfaceRealization', 'Substitution', 'Abstraction', 'CommunicationPath', 'InterruptFlow']);
const DIAGRAM_TYPES = new Set(['Diagram', 'DiagramPresentationElement']);
// UML features with a fixed concrete type may legally omit xmi:type.
// Polymorphic features such as node/fragment/subvertex still require it.
const FEATURE_TYPES: Record<string, string> = {
  ownedAttribute: 'Property', ownedEnd: 'Property', ownedParameter: 'Parameter',
  ownedOperation: 'Operation', ownedConnector: 'Connector', end: 'ConnectorEnd',
  generalization: 'Generalization', include: 'Include', extend: 'Extend',
  packageImport: 'PackageImport', packageMerge: 'PackageMerge',
  lifeline: 'Lifeline', message: 'Message', region: 'Region',
  transition: 'Transition', ownedRule: 'Constraint', guard: 'Constraint', ownedComment: 'Comment',
  trigger: 'Trigger', operand: 'InteractionOperand', interactionConstraint: 'InteractionConstraint',
  extensionPoint: 'ExtensionPoint', slot: 'Slot'
};

export function localName(name: string): string { return name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : name; }
export function normalizedType(type: string): string { return localName(type); }
export function attribute(attrs: Record<string, string>, ...names: string[]): string | undefined {
  for (const name of names) if (attrs[name] !== undefined) return attrs[name];
}
export function metaClass(tag: string, attrs: Record<string, string>): string {
  const explicit = attribute(attrs, 'xmi:type', 'xmiType', 'metaClass', 'metaclass');
  if (explicit) return explicit;
  const inferred = FEATURE_TYPES[localName(tag)];
  // A Property's unqualified type attribute references its classifier; it is
  // not the Property's own metaclass.
  return inferred ? `uml:${inferred}` : tag.startsWith('uml:') ? tag : attribute(attrs, 'type') ?? localName(tag);
}
export function isRelation(type: string, tag: string): boolean {
  return RELATION_TYPES.has(normalizedType(type)) || RELATION_TYPES.has(localName(tag));
}
export function isDiagram(type: string, tag: string, attrs: Record<string, string>): boolean {
  const normalized = normalizedType(type).toLowerCase();
  const local = localName(tag).toLowerCase();
  return [...DIAGRAM_TYPES].some(value => value.toLowerCase() === normalized || value.toLowerCase() === local) || Boolean(attribute(attrs, 'diagramType', 'humanType'));
}
export function isView(type: string, tag: string, attrs: Record<string, string>): boolean {
  const value = `${type} ${localName(tag)}`.toLowerCase();
  return Boolean(attribute(attrs, 'modelElement', 'modelElementId')) || /presentation|shape|edge|path|view/.test(value);
}
