import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { attribute, isDiagram, isRelation, isView, localName, metaClass, normalizedType } from './adapter.js';
import type { Diagram, Issue, ModelElement, ParsedModel, Relation, View } from './types.js';

type RawNode = { id: string; tag: string; attrs: Record<string, string>; path: string; parentId?: string; diagramId?: string; filePartName?: string; text?: string };
const idNames = ['xmi:id', 'id', 'ID'];
const referenceTags = new Set(['annotatedElement', 'client', 'supplier', 'source', 'target', 'memberEnd', 'constrainedElement', 'elementID', 'usedObjects']);
// Association ends are normally serialized as `ownedEnd` properties.  They
// must enter the semantic index as well, otherwise valid memberEnd references
// look dangling and their diagram views cannot be resolved.
const structuralTags = new Set(['packagedElement', 'ownedElement', 'ownedAttribute', 'ownedEnd', 'ownedRule', 'nestedClassifier', 'ownedBehavior', 'ownedParameter', 'region', 'subvertex', 'transition', 'ownedMember']);
const knownMetaClasses = new Set(['Model', 'Package', 'Class', 'Property', 'Port', 'Block', 'Requirement', 'Actor', 'UseCase', 'Activity', 'Action', 'ObjectNode', 'StateMachine', 'State', 'Pseudostate', 'Region', 'Transition', 'Interaction', 'Lifeline', 'Message', 'ConstraintBlock', 'Constraint', 'ValueProperty', 'Node', 'Device', 'Artifact', 'Association', 'Dependency', 'Generalization', 'Connector', 'ControlFlow', 'ObjectFlow', 'Deployment', 'PackageImport', 'PackageMerge', 'Satisfy', 'Verify', 'DeriveReqt', 'Include', 'Extend', 'BindingConnector', 'ItemFlow', 'Trace', 'Refine', 'Allocate', 'Flow', 'Realization', 'InterfaceRealization', 'Substitution', 'Abstraction', 'CommunicationPath', 'InterruptFlow', 'OpaqueExpression', 'LiteralString', 'LiteralInteger', 'LiteralUnlimitedNatural', 'ConnectorEnd', 'Comment']);
// These UML nodes carry values, endpoints, or relationship semantics and are
// valid without a user-visible name.  Reporting them as missing names makes
// the model-quality result unusably noisy.
const nameOptionalMetaClasses = new Set([
  'OpaqueExpression', 'LiteralString', 'LiteralInteger', 'LiteralUnlimitedNatural',
  'Constraint', 'ConnectorEnd', 'Extension', 'Region', 'CallBehaviorAction',
  'ProfileApplication', 'Association', 'Generalization', 'Connector',
  'PackageImport', 'Transition', 'ControlFlow', 'ObjectFlow',
  'Property', 'Parameter', 'Comment'
  , 'DiagramLink'
]);
function refId(value?: string): string | undefined {
  if (!value) return undefined;
  const token = value.trim().split(/\s+/)[0];
  if (!token) return undefined;
  const hash = token.lastIndexOf('#');
  return (hash >= 0 ? token.slice(hash + 1) : token).trim() || undefined;
}
function refIds(value?: string): string[] {
  return (value ?? '').trim().split(/\s+/).map(refId).filter((x): x is string => Boolean(x));
}
function nodeRef(node: RawNode): string | undefined { return refId(attribute(node.attrs, 'xmi:idref', 'href') ?? node.text); }

export function parseSysmlXml(xml: string, fileName = 'model.xml'): ParsedModel {
  const issues: Issue[] = [];
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error(`INVALID_XML: ${validation.err.msg} at line ${validation.err.line}`);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false });
  const doc = parser.parse(xml) as unknown[];
  const elements = new Map<string, ModelElement>(); const relations = new Map<string, Relation>();
  const diagrams = new Map<string, Diagram>(); const views = new Map<string, View>(); const raw: RawNode[] = [];
  const duplicateIds = new Set<string>(); const seenIds = new Set<string>(); let generated = 0; let rootTag = '';

  const visit = (nodes: unknown[], path: string, parentId?: string, diagramId?: string, semanticAllowed = true, filePartName?: string): void => {
    for (const item of nodes) {
      if (!item || typeof item !== 'object') continue;
      for (const [tag, value] of Object.entries(item as Record<string, unknown>)) {
        if (tag === ':@') continue;
        const rawAttrs = ((item as Record<string, unknown>)[':@'] ?? {}) as Record<string, string>;
        const attrs = Object.fromEntries(Object.entries(rawAttrs).map(([key, value]) => [key.startsWith('@_') ? key.slice(2) : key, String(value)]));
        const nodePath = `${path}/${tag}`;
        // fast-xml-parser exposes the XML declaration in preserve-order mode;
        // it is metadata, not the document root.
        if (!rootTag && tag !== '?xml' && tag !== '#text') rootTag = tag;
        const explicitId = attribute(attrs, ...idNames);
        const id = explicitId ?? `generated-${++generated}`;
        const type = metaClass(tag, attrs);
        const tagName = localName(tag);
        const currentFilePart = tagName === 'filePart' ? attribute(attrs, 'name') : filePartName;
        const text = Array.isArray(value) ? (value.find(x => x && typeof x === 'object' && '#text' in x) as Record<string, string> | undefined)?.['#text'] : undefined;
        const node: RawNode = { id, tag, attrs, path: nodePath, parentId, diagramId, filePartName: currentFilePart, text };
        const currentDiagramId = isDiagram(type, tag, attrs) ? id : diagramId;
        const isReference = Boolean(attribute(attrs, 'xmi:idref', 'href')) || referenceTags.has(tagName);
        const normalized = normalizedType(type);
        const isSemantic = semanticAllowed && Boolean(explicitId) && !isReference && !tag.startsWith('sysml:') && (type.startsWith('uml:') || structuralTags.has(tagName) || isRelation(type, tag) || ['Model', 'Package'].includes(normalized));
        // Only IDs participating in the exported semantic/diagram model are
        // subject to uniqueness; embedded MagicDraw profiles may legitimately
        // repeat IDs across separate fileParts.
        if (explicitId && semanticAllowed && (isSemantic || isDiagram(type, tag, attrs) || isView(type, tag, attrs))) { if (seenIds.has(id)) { duplicateIds.add(id); issues.push({ stage: 'parse', code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath: nodePath, elementId: id }); } seenIds.add(id); }
        if (isView(type, tag, attrs) && diagramId) {
          views.set(id, { id, diagramId, modelElementId: refId(attribute(attrs, 'modelElement', 'modelElementId', 'subject')), kind: type, bounds: attribute(attrs, 'bounds'), waypoints: attribute(attrs, 'waypoints', 'points'), label: attribute(attrs, 'text', 'label'), style: attrs, sourceXPath: nodePath });
        } else if (isDiagram(type, tag, attrs)) {
          diagrams.set(id, { id, metaClass: type, type: attribute(attrs, 'diagramType', 'humanType', 'type') ?? type, name: attribute(attrs, 'name'), ownerId: parentId, childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, imageRef: attribute(attrs, 'imageRef', 'image'), viewIds: [] });
        } else if (isSemantic && isRelation(type, tag)) {
          const sourceIds = refIds(attribute(attrs, 'source', 'client', 'from')); const targetIds = refIds(attribute(attrs, 'target', 'supplier', 'to'));
          relations.set(id, { id, metaClass: type, kind: type, name: attribute(attrs, 'name'), ownerId: refId(attribute(attrs, 'owner', 'namespace')) ?? parentId, childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, sourceId: sourceIds[0], targetId: targetIds[0], sourceIds, targetIds, endIds: refIds(attribute(attrs, 'memberEnd', 'ends', 'end')), direction: attribute(attrs, 'direction') });
        } else if (isSemantic) {
          if (elements.has(id)) { duplicateIds.add(id); issues.push({ stage: 'parse', code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath: nodePath, elementId: id }); }
          else elements.set(id, { id, metaClass: type, name: attribute(attrs, 'name'), ownerId: refId(attribute(attrs, 'owner', 'namespace')) ?? parentId, childrenIds: [], stereotypes: (attribute(attrs, 'stereotype', 'appliedStereotype') ?? '').split(/\s+/).filter(Boolean), attributes: attrs, sourceXPath: nodePath });
        }
        if (semanticAllowed && explicitId && !isReference && !isDiagram(type, tag, attrs) && !isView(type, tag, attrs) && !knownMetaClasses.has(normalized) && !structuralTags.has(tagName)) issues.push({ stage: 'parse', code: 'UNKNOWN_METACLASS', severity: 'warning', message: `Unknown metaclass: ${type}`, xpath: nodePath, elementId: id });
        raw.push(node);
        const child = Array.isArray(value) ? value : [];
        // filePart may contain MagicDraw installation profiles/projects. They are not part of the exported user model.
        visit(child, nodePath, id, currentDiagramId, semanticAllowed && tagName !== 'filePart', currentFilePart);
      }
    }
  };
  visit(doc, '');
  if (!/xmi|model/i.test(rootTag)) issues.push({ stage: 'parse', code: 'UNSUPPORTED_ROOT', severity: 'warning', message: `Root node ${rootTag} does not look like XMI/XML model input`, xpath: `/${rootTag}` });
  const allObjects = new Map<string, ModelElement | Relation | Diagram>([...elements, ...relations, ...diagrams]);
  // MagicDraw commonly puts Dependency client/supplier and Association memberEnd in child reference nodes.
  for (const node of raw) {
    if (!node.parentId || !relations.has(node.parentId)) continue;
    const ref = nodeRef(node);
    if (!ref) continue;
    const relation = relations.get(node.parentId)!;
    switch (localName(node.tag)) {
      case 'client': case 'source': relation.sourceId ??= ref; (relation.sourceIds ??= []).push(ref); break;
      case 'supplier': case 'target': relation.targetId ??= ref; (relation.targetIds ??= []).push(ref); break;
      case 'memberEnd': case 'ownedEnd': relation.endIds.push(ref); break;
    }
  }
  // MagicDraw stores each diagram's drawing in a separate filePart whose name is streamContentID.
  const rawById = new Map(raw.map(node => [node.id, node]));
  const childrenByParent = new Map<string, RawNode[]>();
  for (const node of raw) if (node.parentId) (childrenByParent.get(node.parentId) ?? childrenByParent.set(node.parentId, []).get(node.parentId)!).push(node);
  const diagramByStream = new Map<string, string>();
  for (const node of raw.filter(node => localName(node.tag) === 'binaryObject')) {
    let ancestor: RawNode | undefined = node;
    while (ancestor?.parentId) {
      ancestor = rawById.get(ancestor.parentId);
      if (ancestor && diagrams.has(ancestor.id)) { const stream = attribute(node.attrs, 'streamContentID'); if (stream) diagramByStream.set(stream, ancestor.id); break; }
    }
  }
  for (const node of raw.filter(node => localName(node.tag) === 'mdElement' && node.filePartName && diagramByStream.has(node.filePartName))) {
    const children = childrenByParent.get(node.id) ?? [];
    const modelRef = refId(children.find(child => localName(child.tag) === 'elementID')?.attrs['xmi:idref'] ?? children.find(child => localName(child.tag) === 'elementID')?.attrs.href);
    if (!modelRef) continue;
    const geometry = children.find(child => localName(child.tag) === 'geometry')?.text;
    const diagramId = diagramByStream.get(node.filePartName!);
    if (!diagramId) continue;
    views.set(node.id, { id: node.id, diagramId, modelElementId: modelRef, kind: attribute(node.attrs, 'elementClass') ?? 'mdElement', bounds: geometry, style: node.attrs, sourceXPath: node.path });
  }
  // A MagicDraw requirement diagram can express hierarchy with presentation
  // links (for example ContainmentLink), rather than UML Dependency objects.
  // Their endpoints point to mdElement view IDs, so resolve the view endpoints
  // back to the represented semantic elements and retain both the relation and
  // its routed geometry for rendering.
  for (const node of raw.filter(node => localName(node.tag) === 'mdElement' && node.filePartName && diagramByStream.has(node.filePartName))) {
    const children = childrenByParent.get(node.id) ?? [];
    const firstViewId = children.find(child => localName(child.tag) === 'linkFirstEndID')?.attrs['xmi:idref'];
    const secondViewId = children.find(child => localName(child.tag) === 'linkSecondEndID')?.attrs['xmi:idref'];
    if (!firstViewId || !secondViewId) continue;
    const sourceId = views.get(firstViewId)?.modelElementId;
    const targetId = views.get(secondViewId)?.modelElementId;
    if (!sourceId || !targetId) continue;
    const diagramId = diagramByStream.get(node.filePartName!);
    if (!diagramId) continue;
    const kind = attribute(node.attrs, 'elementClass') ?? 'DiagramLink';
    const relationId = `diagram-link:${node.id}`;
    relations.set(relationId, { id: relationId, metaClass: kind, kind, ownerId: diagramId, childrenIds: [], stereotypes: [], attributes: node.attrs, sourceXPath: node.path, sourceId, targetId, endIds: [] });
    const geometry = children.find(child => localName(child.tag) === 'geometry')?.text;
    views.set(node.id, { id: node.id, diagramId, modelElementId: relationId, kind, bounds: geometry, style: node.attrs, sourceXPath: node.path });
    allObjects.set(relationId, relations.get(relationId)!);
  }
  // SysML stereotypes are separate application nodes; attach them to their UML base element.
  for (const node of raw) {
    if (!node.tag.startsWith('sysml:')) continue;
    const stereotype = localName(node.tag); const base = Object.entries(node.attrs).find(([key]) => key.startsWith('base_'))?.[1];
    if (base && allObjects.has(base)) allObjects.get(base)!.stereotypes.push(stereotype);
  }
  for (const obj of allObjects.values()) {
    if (obj.ownerId && allObjects.has(obj.ownerId)) allObjects.get(obj.ownerId)!.childrenIds.push(obj.id);
    obj.qualifiedName = qualifiedName(obj, allObjects);
    if (!obj.name && !obj.id.startsWith('diagram-link:') && normalizedType(obj.metaClass) !== 'Model' && !nameOptionalMetaClasses.has(normalizedType(obj.metaClass))) issues.push({ stage: 'parse', code: 'MISSING_NAME', severity: 'warning', message: `${obj.metaClass} has no name`, xpath: obj.sourceXPath, elementId: obj.id });
  }
  for (const relation of relations.values()) for (const ref of [relation.sourceId, relation.targetId, ...relation.endIds]) if (ref && !allObjects.has(ref)) issues.push({ stage: 'parse', code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved ${relation.kind} reference: ${ref}`, xpath: relation.sourceXPath, elementId: relation.id, referenceId: ref });
  for (const view of views.values()) { const diagram = diagrams.get(view.diagramId); if (!diagram) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `View belongs to missing diagram: ${view.diagramId}`, xpath: view.sourceXPath, elementId: view.id, diagramId: view.diagramId, viewId: view.id }); else diagram.viewIds.push(view.id); if (view.modelElementId && !allObjects.has(view.modelElementId)) issues.push({ stage: 'parse', code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved view model element: ${view.modelElementId}`, xpath: view.sourceXPath, elementId: view.id, referenceId: view.modelElementId, viewId: view.id, diagramId: view.diagramId }); }
  const rootAttrs = raw.find(node => node.tag === rootTag)?.attrs ?? {};
  const exporterVersion = /<xmi:exporterVersion>([^<]+)<\/xmi:exporterVersion>/.exec(xml)?.[1];
  return { schemaVersion: '1.0.0', id: crypto.randomUUID(), source: { fileName, encoding: /^\s*<\?xml[^>]*encoding=["']([^"']+)/i.exec(xml)?.[1] ?? 'UTF-8', xmiVersion: attribute(rootAttrs, 'xmi:version', 'xmiVersion'), productVersion: attribute(rootAttrs, 'productVersion') ?? exporterVersion }, elements: [...elements.values()], relations: [...relations.values()], diagrams: [...diagrams.values()], views: [...views.values()], issues, statistics: { elements: elements.size, relations: relations.size, diagrams: diagrams.size, views: views.size, danglingReferences: issues.filter(x => x.code === 'DANGLING_REFERENCE').length, duplicateIds: duplicateIds.size } };
}
function qualifiedName(item: ModelElement, all: Map<string, ModelElement | Relation | Diagram>): string | undefined { const names: string[] = []; let current: ModelElement | Relation | Diagram | undefined = item; const seen = new Set<string>(); while (current && !seen.has(current.id)) { seen.add(current.id); if (current.name) names.unshift(current.name); current = current.ownerId ? all.get(current.ownerId) : undefined; } return names.length ? names.join('::') : undefined; }
