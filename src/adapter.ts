const RELATION_TYPES = new Set(['Association', 'Dependency', 'Generalization', 'Connector', 'Transition', 'Message', 'ControlFlow', 'ObjectFlow', 'Deployment', 'PackageImport', 'PackageMerge', 'Satisfy', 'Verify', 'DeriveReqt', 'Include', 'Extend', 'BindingConnector', 'ItemFlow', 'Trace', 'Refine', 'Allocate', 'Flow', 'Realization', 'InterfaceRealization', 'Substitution', 'Abstraction', 'CommunicationPath', 'InterruptFlow']);
const DIAGRAM_TYPES = new Set(['Diagram', 'DiagramPresentationElement']);

export function localName(name: string): string { return name.includes(':') ? name.slice(name.lastIndexOf(':') + 1) : name; }
export function normalizedType(type: string): string { return localName(type); }
export function attribute(attrs: Record<string, string>, ...names: string[]): string | undefined {
  for (const name of names) if (attrs[name] !== undefined) return attrs[name];
}
export function metaClass(tag: string, attrs: Record<string, string>): string {
  return attribute(attrs, 'xmi:type', 'xmiType', 'metaClass', 'metaclass', 'type') ?? localName(tag);
}
export function isRelation(type: string, tag: string): boolean {
  return RELATION_TYPES.has(normalizedType(type)) || RELATION_TYPES.has(localName(tag));
}
export function isDiagram(type: string, tag: string, attrs: Record<string, string>): boolean {
  return DIAGRAM_TYPES.has(normalizedType(type)) || DIAGRAM_TYPES.has(localName(tag)) || Boolean(attribute(attrs, 'diagramType', 'humanType'));
}
export function isView(type: string, tag: string, attrs: Record<string, string>): boolean {
  const value = `${type} ${localName(tag)}`.toLowerCase();
  return Boolean(attribute(attrs, 'modelElement', 'modelElementId')) || /presentation|shape|edge|path|view/.test(value);
}
