import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { attribute, isDiagram, isRelation, isView, localName, metaClass, normalizedType } from './adapter.js';
import { canonicalDiagramType, RULE_REQUIRED_METACLASSES } from './sysml-whitelist.js';
import type { Diagram, ExtensionNode, Issue, ModelElement, ParsedModel, Relation, View } from './types.js';
import { extractSemanticFeatures, referenceTokens } from './semantic-features.js';

type RawNode = { id: string; tag: string; attrs: Record<string, string>; path: string; parentId?: string; parent?: RawNode; children: RawNode[]; exportedId?: string; diagramId?: string; filePartName?: string; text?: string };
const idNames = ['xmi:id', 'id', 'ID'];
const referenceTags = new Set(['annotatedElement', 'client', 'supplier', 'source', 'target', 'memberEnd', 'constrainedElement', 'elementID', 'usedObjects']);
// Association ends are normally serialized as `ownedEnd` properties.  They
// must enter the semantic index as well, otherwise valid memberEnd references
// look dangling and their diagram views cannot be resolved.
const structuralTags = new Set(['packagedElement', 'ownedElement', 'ownedAttribute', 'ownedEnd', 'ownedRule', 'nestedClassifier', 'ownedBehavior', 'ownedParameter', 'region', 'subvertex', 'transition', 'ownedMember']);
const knownMetaClasses = new Set([...RULE_REQUIRED_METACLASSES, 'ActivityParameterNode', 'InputPin', 'OutputPin', 'ObjectNode', 'Region', 'ConstraintBlock', 'Constraint', 'ConstraintParameter', 'ConstraintProperty', 'ValueProperty', 'Node', 'Device', 'Artifact', 'NestedConnectorEnd', 'ProxyPort', 'PartProperty', 'InterfaceBlock', 'Deployment', 'ObjectFlow', 'BindingConnector', 'ItemFlow', 'Allocate', 'Flow', 'Realization', 'InterfaceRealization', 'Substitution', 'Abstraction', 'CommunicationPath', 'InterruptFlow', 'OpaqueExpression', 'LiteralString', 'LiteralInteger', 'LiteralUnlimitedNatural', 'Comment', 'DiagramInfo', 'ProfileApplication', 'CustomSort', 'additionalPackageImport', 'auxiliaryResource',
  // MagicDraw/SysML extensions observed in real exported models.
  'FlowPort', 'FlowProperty', 'FlowSpecification', 'ReferenceProperty', 'ValueType', 'QuantityKind', 'Unit',
  'ActivityPartition', 'AllocateActivityPartition', 'OpaqueBehavior', 'ForkNode', 'JoinNode', 'DecisionNode', 'MergeNode', 'CentralBufferNode',
  'InterruptibleActivityRegion', 'AcceptEventAction', 'InteractionOperand', 'InteractionConstraint',
  'Trigger', 'ChangeEvent', 'CombinedFragment', 'Image', 'Problem', 'DependencyMatrix', 'MatrixFilter',
  'DiagramTable', 'BlackBoxICDTable', 'WhiteBoxICDTable', 'HyperlinkOwner', 'Next', 'Previous', 'Continuous', 'virtual',
  'Rationale', 'useCaseModel', 'RequirementTable', 'CallEvent', 'SignalEvent', 'TimeEvent', 'FinalState',
  'ExtensionPoint', 'BehaviorExecutionSpecification', 'ActionExecutionSpecification', 'Parameter',
  'DataType', 'PrimitiveType', 'Enumeration', 'EnumerationLiteral', 'LiteralBoolean', 'LiteralReal', 'LiteralNull',
  'AssociationClass', 'InformationFlow', 'InstanceSpecification', 'Slot', 'InstanceValue', 'InteractionUse', 'TimeExpression',
  'ReadSelfAction', 'ReadStructuralFeatureAction', 'AddStructuralFeatureValueAction', 'ClearStructuralFeatureAction',
  'CallOperationAction', 'ValueSpecificationAction', 'CreateObjectAction', 'SendSignalAction']);
const graphicsExtensionTags = new Set(['diagramContents', 'binaryObject', 'image', 'imageData', 'shape', 'edge', 'path', 'geometry', 'presentationElement', 'mdElement', 'ContainmentLink', 'linkFirstEndID', 'linkSecondEndID', 'elementID']);
// These UML nodes carry values, endpoints, or relationship semantics and are
// valid without a user-visible name.  Reporting them as missing names makes
// the model-quality result unusably noisy.
const nameOptionalMetaClasses = new Set([
  'OpaqueExpression', 'LiteralString', 'LiteralInteger', 'LiteralUnlimitedNatural',
  'Constraint', 'ConnectorEnd', 'Extension', 'Region', 'CallBehaviorAction',
  'ProfileApplication', 'Association', 'Generalization', 'Connector',
  'PackageImport', 'Transition', 'ControlFlow', 'ObjectFlow',
  'Property', 'Parameter', 'Comment', 'PackageMerge', 'Include', 'Extend'
  , 'DiagramLink', 'ActivityParameterNode', 'ActivityPartition', 'AllocateActivityPartition',
  'ForkNode', 'JoinNode', 'DecisionNode', 'MergeNode', 'CentralBufferNode', 'InterruptibleActivityRegion', 'OpaqueBehavior',
  'AcceptEventAction', 'InteractionOperand', 'InteractionConstraint', 'Trigger', 'ChangeEvent',
  'CombinedFragment', 'Image', 'FlowPort', 'DependencyMatrix', 'Abstraction', 'Realization', 'Dependency', 'Usage', 'Lifeline',
  'MessageOccurrenceSpecification', 'Pseudostate', 'InitialNode', 'ActivityFinalNode', 'State', 'OutputPin',
  'CallEvent', 'SignalEvent', 'TimeEvent', 'FinalState', 'BehaviorExecutionSpecification', 'ActionExecutionSpecification',
  'OccurrenceSpecification', 'ExecutionOccurrenceSpecification', 'Gate', 'LiteralBoolean', 'LiteralReal', 'LiteralNull',
  'Slot', 'InstanceValue', 'InteractionUse', 'TimeExpression', 'InterfaceRealization', 'OpaqueAction',
  'ReadSelfAction', 'ReadStructuralFeatureAction', 'AddStructuralFeatureValueAction', 'ClearStructuralFeatureAction',
  'CallOperationAction', 'ValueSpecificationAction', 'CreateObjectAction', 'SendSignalAction', 'InputPin', 'Port'
]);
function exportedOwnerId(ownerId?: string): string | undefined {
  // XML wrappers such as xmi:Extension/modelExtension have no stable XMI ID.
  // They are parser-generated traversal nodes, never semantic owners.
  return ownerId && !ownerId.startsWith('generated-') ? ownerId : undefined;
}
function refId(value?: string): string | undefined {
  if (!value) return undefined;
  const token = value.trim().split(/\s+/)[0];
  if (!token) return undefined;
  const hash = token.lastIndexOf('#');
  const fragment = (hash >= 0 ? token.slice(hash + 1) : token).trim();
  if (!fragment) return undefined;
  try { return decodeURIComponent(fragment); } catch { return fragment; }
}
function refIds(value?: string): string[] {
  return (value ?? '').trim().split(/\s+/).map(refId).filter((x): x is string => Boolean(x));
}
function nodeRef(node: RawNode): string | undefined { return refId(attribute(node.attrs, 'xmi:idref', 'href') ?? node.text); }
function isExternalReference(value: string): boolean {
  return value.trim().lastIndexOf('#') > 0;
}
function endpointNames(type: string): { source: string[]; target: string[]; ends: string[]; roles: string[] } {
  const source = ['source', 'client', 'from', 'relatedElement'];
  const target = ['target', 'supplier', 'to'];
  switch (normalizedType(type)) {
    case 'Generalization': source.push('specific'); target.push('general'); break;
    case 'Include': source.push('includingCase'); target.push('addition'); break;
    case 'Extend': source.push('extension'); target.push('extendedCase'); break;
    case 'PackageImport': source.push('importingNamespace'); target.push('importedPackage'); break;
    case 'PackageMerge': source.push('receivingPackage'); target.push('mergedPackage'); break;
    // Message endpoints are occurrence/event IDs, not lifeline IDs.
    case 'Message': source.push('sendEvent'); target.push('receiveEvent'); break;
    case 'InformationFlow': source.push('informationSource'); target.push('informationTarget'); break;
  }
  return { source, target, ends: ['memberEnd', 'ownedEnd', 'ends', 'end'], roles: ['role', 'partWithPort', 'property', 'connectorEnd'] };
}
function descendantNodes(owner: RawNode, raw: RawNode[], rawById: Map<string, RawNode>, relationScope = false): RawNode[] {
  const result: RawNode[] = [];
  const pending = [...owner.children].reverse();
  while (pending.length) {
    const node = pending.pop()!;
    // Only an owned end belongs to the enclosing relation's endpoint record.
    // Guards, expressions and other nested semantic objects own their references.
    const tag = localName(node.tag);
    if (relationScope && !['end', 'ownedEnd'].includes(tag)
      && (node.exportedId || ['guard', 'effect', 'specification', 'defaultValue', 'lowerValue', 'upperValue', 'ownedRule', 'trigger'].includes(tag))) continue;
    result.push(node);
    pending.push(...[...node.children].reverse());
  }
  return result;
}

function isStereotypeApplication(node: RawNode, xmlChildren?: unknown[]): boolean {
  return node.tag.includes(':') && (
    Object.keys(node.attrs).some(key => localName(key).startsWith('base_'))
    || node.children.some(child => localName(child.tag).startsWith('base_'))
    || Boolean(xmlChildren?.some(child => child && typeof child === 'object' && Object.keys(child).some(key => localName(key).startsWith('base_'))))
  );
}

export function parseSysmlXml(xml: string, fileName = 'model.xml'): ParsedModel {
  const issues: Issue[] = [];
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error(`INVALID_XML: ${validation.err.msg} at line ${validation.err.line}`);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false, parseTagValue: false });
  const doc = parser.parse(xml) as unknown[];
  const elements = new Map<string, ModelElement>(); const relations = new Map<string, Relation>();
  const diagrams = new Map<string, Diagram>(); const views = new Map<string, View>(); const raw: RawNode[] = [];
  const viewReferences = new Map<string, string>();
  const relationReferences = new Map<string, string[]>();
  const viewNodes = new Map<string, RawNode>();
  const objectNodes = new Map<string, RawNode>();
  const duplicateIds = new Set<string>(); const seenIds = new Set<string>(); let generated = 0; let rootTag = '';
  const collisionId = (id: string, collection: Map<string, unknown>, xpath: string): string => {
    if (!collection.has(id)) return id;
    let n = 2; while (collection.has(`${id}#duplicate-${n}`)) n++;
    duplicateIds.add(id);
    issues.push({ stage: 'parse', code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath, elementId: id });
    return `${id}#duplicate-${n}`;
  };

  const visit = (nodes: unknown[], path: string, parentId?: string, diagramId?: string, semanticAllowed = true, filePartName?: string, parent?: RawNode): void => {
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
        const textParts = Array.isArray(value) ? value.filter(x => x && typeof x === 'object' && '#text' in x).map(x => String((x as Record<string, unknown>)['#text'])) : [];
        const text = textParts.length ? textParts.join('') : undefined;
        const node: RawNode = { id, tag, attrs, path: nodePath, parentId, parent, children: [], diagramId, filePartName: currentFilePart, text };
        parent?.children.push(node);
        let currentDiagramId = diagramId;
        // A feature such as target can contain an owned InputPin definition.
        // Only ID-less feature wrappers are references by tag name alone.
        const isReference = Boolean(attribute(attrs, 'xmi:idref', 'href')) || (!explicitId && referenceTags.has(tagName));
        const normalized = normalizedType(type);
        const stereotypeApplication = isStereotypeApplication(node, Array.isArray(value) ? value : undefined);
        const isSemantic = semanticAllowed && Boolean(explicitId) && !isReference && !stereotypeApplication && !tag.startsWith('sysml:') && (type.startsWith('uml:') || structuralTags.has(tagName) || isRelation(type, tag) || ['Model', 'Package'].includes(normalized));
        // Only IDs participating in the exported semantic/diagram model are
        // subject to uniqueness; embedded MagicDraw profiles may legitimately
        // repeat IDs across separate fileParts.
        if (explicitId && semanticAllowed && (isSemantic || isDiagram(type, tag, attrs) || isView(type, tag, attrs))) { if (seenIds.has(id)) { duplicateIds.add(id); issues.push({ stage: 'parse', code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath: nodePath, elementId: id }); } seenIds.add(id); }
        if (isView(type, tag, attrs) && diagramId) {
          const viewId = collisionId(id, views, nodePath); views.set(viewId, { id: viewId, diagramId, modelElementId: refId(attribute(attrs, 'modelElement', 'modelElementId', 'subject')), presentationKind: 'graphic', kind: type, bounds: attribute(attrs, 'bounds'), waypoints: attribute(attrs, 'waypoints', 'points'), label: attribute(attrs, 'text', 'label'), style: attrs, sourceXPath: nodePath });
          const reference = attribute(attrs, 'modelElement', 'modelElementId', 'subject');
          if (reference) viewReferences.set(viewId, reference);
          viewNodes.set(viewId, node);
        } else if (isDiagram(type, tag, attrs)) {
          const diagramId = collisionId(id, diagrams, nodePath); diagrams.set(diagramId, { id: diagramId, metaClass: type, type: canonicalDiagramType(attribute(attrs, 'diagramType', 'humanType', 'type') ?? type)!, name: attribute(attrs, 'name'), ownerId: refId(attribute(attrs, 'ownerOfDiagram', 'owner', 'namespace')) ?? parentId, childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, rootViewId: refId(attribute(attrs, 'rootViewId', 'rootView')), imageRef: attribute(attrs, 'imageRef', 'image'), viewIds: [] });
          currentDiagramId = diagramId;
          node.exportedId = diagramId;
          objectNodes.set(diagramId, node);
        } else if (isSemantic && isRelation(type, tag)) {
          const sourceIds = refIds(attribute(attrs, 'source', 'client', 'from', 'relatedElement')); const targetIds = refIds(attribute(attrs, 'target', 'supplier', 'to', 'general'));
          const relationId = collisionId(id, relations, nodePath); relations.set(relationId, { id: relationId, metaClass: type, kind: type, relationOrigin: 'semantic', name: attribute(attrs, 'name'), ownerId: refId(attribute(attrs, 'owner', 'namespace')) ?? exportedOwnerId(parentId), childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, sourceId: sourceIds[0], targetId: targetIds[0], sourceIds, targetIds, endIds: refIds(attribute(attrs, 'memberEnd', 'ends', 'end')), direction: attribute(attrs, 'direction') });
          node.exportedId = relationId;
          objectNodes.set(relationId, node);
        } else if (isSemantic) {
          if (elements.has(id)) { duplicateIds.add(id); issues.push({ stage: 'parse', code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath: nodePath, elementId: id }); }
          else elements.set(id, { id, metaClass: type, name: attribute(attrs, 'name'), ownerId: normalized === 'Model' ? undefined : refId(attribute(attrs, 'owner', 'namespace')) ?? exportedOwnerId(parentId), childrenIds: [], stereotypes: (attribute(attrs, 'stereotype', 'appliedStereotype') ?? '').split(/\s+/).filter(Boolean), attributes: attrs, sourceXPath: nodePath });
          if (!objectNodes.has(id)) { node.exportedId = id; objectNodes.set(id, node); }
        }
        if (semanticAllowed && explicitId && !isReference && !stereotypeApplication && !isDiagram(type, tag, attrs) && !isView(type, tag, attrs) && !knownMetaClasses.has(normalized) && !structuralTags.has(tagName) && !graphicsExtensionTags.has(tagName)) issues.push({ stage: 'parse', code: 'UNKNOWN_METACLASS', severity: 'warning', message: `Unknown metaclass: ${type}`, xpath: nodePath, elementId: id });
        raw.push(node);
        const child = Array.isArray(value) ? value : [];
        // filePart may contain MagicDraw installation profiles/projects. They are not part of the exported user model.
        visit(child, nodePath, node.exportedId ?? id, currentDiagramId, semanticAllowed && tagName !== 'filePart', currentFilePart, node);
      }
    }
  };
  visit(doc, '');
  if (!/xmi|model/i.test(rootTag)) issues.push({ stage: 'parse', code: 'UNSUPPORTED_ROOT', severity: 'warning', message: `Root node ${rootTag} does not look like XMI/XML model input`, xpath: `/${rootTag}` });
  const allObjects = new Map<string, ModelElement | Relation | Diagram>([...elements, ...relations, ...diagrams]);
  // MagicDraw stores each diagram's drawing in a separate filePart whose name is streamContentID.
  const rawById = new Map(raw.map(node => [node.id, node]));
  const childrenByParent = new Map<string, RawNode[]>();
  for (const node of raw) if (node.parentId) (childrenByParent.get(node.parentId) ?? childrenByParent.set(node.parentId, []).get(node.parentId)!).push(node);
  // MagicDraw may wrap a semantic value in xmi:Extension/modelExtension
  // nodes. Those wrappers have generated traversal IDs, but the value still
  // belongs to the nearest exported semantic ancestor (for example ownedEnd).
  // Resolve that owner after all semantic collections have been populated.
  const rawByExportedId = new Map<string, RawNode>();
  for (const node of raw) if (!rawByExportedId.has(node.id)) rawByExportedId.set(node.id, node);
  const nearestExportedOwnerId = (id: string): string | undefined => {
    let parent = objectNodes.get(id)?.parent;
    while (parent) {
      if (parent.exportedId && allObjects.has(parent.exportedId)) return parent.exportedId;
      parent = parent.parent;
    }
  };
  for (const object of allObjects.values()) {
    if (!object.ownerId && normalizedType(object.metaClass) !== 'Model') {
      object.ownerId = nearestExportedOwnerId(object.id);
    }
    const node = objectNodes.get(object.id);
    if (node) Object.assign(object, extractSemanticFeatures(node, object.metaClass));
  }
  // MagicDraw stores the actual SysML diagram kind on an embedded
  // DiagramRepresentationObject, not on uml:Diagram itself. Recover it so
  // validator rules can select BDD/IBD/use-case/activity/etc. precisely.
  for (const node of raw) {
    if (localName(node.tag) !== 'DiagramRepresentationObject') continue;
    let ancestor = node;
    while (ancestor.parent) {
      const parent = ancestor.parent;
      if (!parent) break;
      if (parent.exportedId && diagrams.has(parent.exportedId)) {
        const diagramType = canonicalDiagramType(attribute(node.attrs, 'type', 'diagramType', 'humanType'));
        if (diagramType) diagrams.get(parent.exportedId)!.type = diagramType;
        break;
      }
      ancestor = parent;
    }
  }
  // Endpoint references are also commonly nested below wrapper nodes. Walk
  // descendants and merge them into the same normalized arrays.
  for (const relation of relations.values()) {
    const owner = objectNodes.get(relation.id);
    if (!owner) continue;
    const names = endpointNames(relation.kind);
    const tokens: string[] = [];
    const collect = (value: string | undefined): string[] => {
      const values = (value ?? '').trim().split(/\s+/).filter(Boolean);
      tokens.push(...values);
      return values.map(refId).filter((id): id is string => Boolean(id));
    };
    relation.sourceIds = names.source.flatMap(name => collect(owner.attrs[name]));
    relation.targetIds = names.target.flatMap(name => collect(owner.attrs[name]));
    relation.endIds = names.ends.flatMap(name => collect(owner.attrs[name]));
    relation.roleIds = names.roles.flatMap(name => collect(owner.attrs[name]));
    const endpointTags = [...names.source, ...names.target, ...names.ends, ...names.roles];
    const descendants = descendantNodes(owner, raw, rawById, true);
    for (const node of descendants) {
      // End definitions often store role/partWithPort directly as attributes.
      if (names.ends.includes(localName(node.tag))) {
        for (const name of names.roles) relation.roleIds!.push(...collect(node.attrs[name]));
      }
      const value = attribute(node.attrs, 'xmi:idref', 'href') ?? node.text;
      const directName = localName(node.tag);
      if (names.ends.includes(directName) && node.attrs['xmi:id']) relation.endIds.push(node.attrs['xmi:id']);
      if (!value) continue;
      let name = localName(node.tag);
      if (!endpointTags.includes(name)) {
        let parent = node.parent;
        while (parent && parent !== owner) {
          const parentName = localName(parent.tag);
          if (parent.exportedId) break;
          if (endpointTags.includes(parentName)) { name = parentName; break; }
          parent = parent.parent;
        }
      }
      if (names.source.includes(name)) relation.sourceIds.push(...collect(value));
      if (names.target.includes(name)) relation.targetIds.push(...collect(value));
      if (names.ends.includes(name)) relation.endIds.push(...collect(value));
      if (names.roles.includes(name)) relation.roleIds!.push(...collect(value));
    }
    // UML serializes these relationships under their source classifier/use case.
    if (!relation.sourceIds.length && ['Generalization', 'Include', 'Extend', 'PackageImport', 'PackageMerge'].includes(normalizedType(relation.kind)) && relation.ownerId) {
      relation.sourceIds.push(relation.ownerId);
      tokens.push(relation.ownerId);
    }
    relation.sourceIds = [...new Set(relation.sourceIds)];
    relation.targetIds = [...new Set(relation.targetIds)];
    relation.endIds = [...new Set(relation.endIds)];
    relation.roleIds = [...new Set(relation.roleIds)];
    relation.sourceId = relation.sourceIds[0];
    relation.targetId = relation.targetIds[0];
    relationReferences.set(relation.id, tokens);
  }
  // Some exporters encode a view's model reference as a nested elementID
  // node instead of a modelElement attribute. Normalize it the same way as
  // direct attributes (including external href/file#id references).
  for (const relation of relations.values()) {
    if (normalizedType(relation.kind) !== 'Message') continue;
    const externalEvents = new Set((relationReferences.get(relation.id) ?? []).filter(isExternalReference).map(refId));
    const lifelines = (eventIds: string[]): string[] => {
      const result = new Set<string>();
      for (const eventId of eventIds) {
        if (externalEvents.has(eventId)) continue;
        const event = elements.get(eventId);
        const node = objectNodes.get(eventId);
        if (!event || !node || !['MessageOccurrenceSpecification', 'OccurrenceSpecification', 'ExecutionOccurrenceSpecification'].includes(normalizedType(event.metaClass))) continue;
        const values = [node.attrs.covered, ...node.children.filter(child => localName(child.tag) === 'covered').flatMap(child =>
          [child, ...descendantNodes(child, raw, rawById)].map(ref => attribute(ref.attrs, 'xmi:idref', 'href') ?? ref.text))];
        for (const token of values.flatMap(value => (value ?? '').trim().split(/\s+/)).filter(Boolean)) {
          if (isExternalReference(token)) continue;
          const id = refId(token)!;
          const target = elements.get(id);
          if (target && normalizedType(target.metaClass) === 'Lifeline') result.add(id);
          else issues.push({ stage: 'parse', code: 'DANGLING_REFERENCE', severity: 'error', message: `Message occurrence does not reference a local Lifeline: ${id}`, xpath: node.path, elementId: eventId, referenceId: id });
        }
      }
      return [...result];
    };
    relation.sourceLifelineIds = lifelines(relation.sourceIds ?? []);
    relation.targetLifelineIds = lifelines(relation.targetIds ?? []);
  }
  for (const [viewId, view] of views) {
    if (view.modelElementId) continue;
    const child = viewNodes.get(viewId)?.children.find(x => localName(x.tag) === 'elementID');
    const ref = child ? nodeRef(child) : undefined;
    if (ref) view.modelElementId = ref;
    if (child && ref) viewReferences.set(viewId, attribute(child.attrs, 'xmi:idref', 'href') ?? child.text ?? '');
  }
  const diagramByStream = new Map<string, string>();
  for (const node of raw.filter(node => localName(node.tag) === 'binaryObject')) {
    let ancestor: RawNode | undefined = node;
    while (ancestor?.parent) {
      ancestor = ancestor.parent;
      if (ancestor.exportedId && diagrams.has(ancestor.exportedId)) { const stream = attribute(node.attrs, 'streamContentID'); if (stream) diagramByStream.set(stream, ancestor.exportedId); break; }
    }
  }
  const drawingNodes = raw.filter(node => localName(node.tag) === 'mdElement' && node.filePartName && diagramByStream.has(node.filePartName));
  const drawingViewIds = new Map<RawNode, string>();
  for (const node of drawingNodes) {
    const children = node.children;
    const referenceNode = children.find(child => localName(child.tag) === 'elementID');
    const modelRef = referenceNode ? nodeRef(referenceNode) : undefined;
    const hasEnds = children.some(child => ['linkFirstEndID', 'linkSecondEndID'].includes(localName(child.tag)));
    if (!modelRef && !hasEnds) continue;
    const geometry = children.find(child => localName(child.tag) === 'geometry')?.text;
    const diagramId = diagramByStream.get(node.filePartName!);
    if (!diagramId) continue;
    const viewId = collisionId(node.id, views, node.path);
    views.set(viewId, { id: viewId, diagramId, modelElementId: modelRef, presentationKind: 'graphic', kind: attribute(node.attrs, 'elementClass') ?? 'mdElement', bounds: geometry, style: node.attrs, sourceXPath: node.path });
    drawingViewIds.set(node, viewId);
    viewNodes.set(viewId, node);
    if (referenceNode) viewReferences.set(viewId, attribute(referenceNode.attrs, 'xmi:idref', 'href') ?? referenceNode.text ?? '');
  }
  const resolveViewId = (id: string, diagramId: string): string | undefined => {
    const candidates = [...views.values()].filter(view => view.diagramId === diagramId && viewNodes.get(view.id)?.id === id);
    return candidates.length === 1 ? candidates[0].id : undefined;
  };
  for (const diagram of diagrams.values()) {
    if (diagram.rootViewId) diagram.rootViewId = resolveViewId(diagram.rootViewId, diagram.id) ?? diagram.rootViewId;
  }
  // A MagicDraw requirement diagram can express hierarchy with presentation
  // links (for example ContainmentLink), rather than UML Dependency objects.
  // Their endpoints point to mdElement view IDs, so resolve the view endpoints
  // back to the represented semantic elements and retain both the relation and
  // its routed geometry for rendering.
  for (const node of drawingNodes) {
    const viewId = drawingViewIds.get(node);
    if (!viewId) continue;
    const view = views.get(viewId)!;
    const children = node.children;
    const first = children.find(child => localName(child.tag) === 'linkFirstEndID');
    const second = children.find(child => localName(child.tag) === 'linkSecondEndID');
    const firstRef = first ? nodeRef(first) : undefined;
    const secondRef = second ? nodeRef(second) : undefined;
    if (!firstRef && !secondRef) continue;
    const diagramId = view.diagramId;
    view.sourceViewId = firstRef ? resolveViewId(firstRef, diagramId) : undefined;
    view.targetViewId = secondRef ? resolveViewId(secondRef, diagramId) : undefined;
    for (const [ref, resolved] of [[firstRef, view.sourceViewId], [secondRef, view.targetViewId]]) {
      if (ref && !resolved) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `Missing or ambiguous endpoint view in diagram: ${ref}`, xpath: node.path, viewId, diagramId, referenceId: ref });
    }
    // Preserve every explicit model binding, including unresolved/external ones,
    // so synthesizing a drawing edge cannot hide a broken semantic reference.
    if (view.modelElementId) continue;
    const sourceId = view.sourceViewId ? views.get(view.sourceViewId)?.modelElementId : undefined;
    const targetId = view.targetViewId ? views.get(view.targetViewId)?.modelElementId : undefined;
    if (!sourceId || !targetId) continue;
    const kind = attribute(node.attrs, 'elementClass') ?? 'DiagramLink';
    const relationId = collisionId(`diagram-link:${viewId}`, relations, node.path);
    relations.set(relationId, { id: relationId, metaClass: kind, kind, relationOrigin: 'diagram', ownerId: diagramId, childrenIds: [], stereotypes: [], attributes: node.attrs, sourceXPath: node.path, sourceId, targetId, endIds: [] });
    view.modelElementId = relationId;
    allObjects.set(relationId, relations.get(relationId)!);
  }
  // A View may represent a semantic element, an explicit diagram edge, or the
  // diagram itself. MagicDraw emits three documented structural records:
  // diagramRepresentation, DiagramFrame, and a record named after its diagram
  // type. Keep the classification explicit instead of making consumers infer
  // it from a broad, tool-version-specific kind allowlist.
  const externalViewReferenceIds = new Set(
    raw.map(node => attribute(node.attrs, 'href'))
      .filter((href): href is string => Boolean(href && !href.trim().startsWith('#') && href.includes('#')))
      .map(refId)
      .filter((id): id is string => Boolean(id)),
  );
  for (const view of views.values()) {
    if (view.modelElementId) {
      const original = viewReferences.get(view.id);
      view.modelElementScope = original && isExternalReference(original) ? 'external'
        : elements.has(view.modelElementId) ? 'element'
        : relations.has(view.modelElementId) ? 'relation'
        : diagrams.has(view.modelElementId) ? 'diagram'
        : !original?.startsWith('#') && externalViewReferenceIds.has(view.modelElementId) ? 'external'
        : 'unresolved';
    }
    const diagram = diagrams.get(view.diagramId);
    const isDiagramTypeRecord = Boolean(diagram && !view.modelElementId && canonicalDiagramType(view.kind) === diagram.type);
    view.presentationKind = view.kind === 'diagramRepresentation'
      || view.kind === 'DiagramFrame'
      || isDiagramTypeRecord
      ? 'diagram-structure'
      : 'graphic';
  }
  // Namespace prefixes are exporter aliases, not fixed SysML identifiers.
  // Preserve stereotype payloads in extensions and attach all local base_* IDs.
  for (const node of raw) {
    if (node.filePartName || !isStereotypeApplication(node)) continue;
    const stereotype = localName(node.tag);
    const features = extractSemanticFeatures(node, metaClass(node.tag, node.attrs));
    for (const [key, values] of Object.entries(features.references ?? {})) {
      if (!key.startsWith('base_')) continue;
      for (const token of values) {
        if (isExternalReference(token)) continue;
        const base = allObjects.get(refId(token)!);
        if (base && !base.stereotypes.includes(stereotype)) base.stereotypes.push(stereotype);
      }
    }
  }
  for (const obj of allObjects.values()) {
    if (obj.ownerId && allObjects.has(obj.ownerId)) allObjects.get(obj.ownerId)!.childrenIds.push(obj.id);
    obj.qualifiedName = qualifiedName(obj, allObjects);
    if (!obj.name && !obj.id.startsWith('diagram-link:') && normalizedType(obj.metaClass) !== 'Model' && !nameOptionalMetaClasses.has(normalizedType(obj.metaClass))) issues.push({ stage: 'parse', code: 'MISSING_NAME', severity: 'warning', message: `${obj.metaClass} has no name`, xpath: obj.sourceXPath, elementId: obj.id });
  }
  // Profile/library href values can legitimately point outside the imported
  // model. Keep their normalized IDs, but do not diagnose them as local
  // dangling references.
  for (const relation of relations.values()) {
    const references = new Set((relationReferences.get(relation.id) ?? [])
      .filter(token => !isExternalReference(token)).map(refId).filter((id): id is string => Boolean(id)));
    for (const ref of references) {
      if (!allObjects.has(ref)) {
        issues.push({ stage: 'parse', code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved ${relation.kind} reference: ${ref}`, xpath: relation.sourceXPath, elementId: relation.id, referenceId: ref });
      }
    }
  }
  for (const view of views.values()) { const diagram = diagrams.get(view.diagramId); if (!diagram) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `View belongs to missing diagram: ${view.diagramId}`, xpath: view.sourceXPath, elementId: view.id, diagramId: view.diagramId, viewId: view.id }); else diagram.viewIds.push(view.id); if (view.modelElementScope === 'unresolved') issues.push({ stage: 'parse', code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved view model element: ${view.modelElementId}`, xpath: view.sourceXPath, elementId: view.id, referenceId: view.modelElementId, viewId: view.id, diagramId: view.diagramId }); }
  for (const diagram of diagrams.values()) {
    const declared = new Set(diagram.viewIds);
    for (const viewId of declared) if (!views.has(viewId)) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `Diagram references missing view: ${viewId}`, xpath: diagram.sourceXPath, elementId: diagram.id, diagramId: diagram.id, viewId });
    if (diagram.rootViewId && (!views.has(diagram.rootViewId) || views.get(diagram.rootViewId)!.diagramId !== diagram.id)) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `Diagram rootViewId is invalid: ${diagram.rootViewId}`, xpath: diagram.sourceXPath, elementId: diagram.id, diagramId: diagram.id, viewId: diagram.rootViewId });
  }
  for (const view of views.values()) {
    if (!/edge|link|path/i.test(view.kind)) continue;
    const sourceNames = ['source', 'sourceView', 'linkFirstEndID'];
    const targetNames = ['target', 'targetView', 'linkSecondEndID'];
    const sourceRefs = sourceNames.flatMap(name => refIds(view.style[name]));
    const targetRefs = targetNames.flatMap(name => refIds(view.style[name]));
    const rawView = viewNodes.get(view.id);
    if (rawView && drawingViewIds.has(rawView)) continue;
    if (rawView) {
      for (const node of descendantNodes(rawView, raw, rawById)) {
        const name = localName(node.tag);
        const refs = sourceNames.includes(name) ? sourceRefs : targetNames.includes(name) ? targetRefs : undefined;
        if (refs) refs.push(...refIds(attribute(node.attrs, 'xmi:idref', 'href') ?? node.text));
      }
    }
    const resolveEndpoint = (refs: string[]): string | undefined => {
      const unique = [...new Set(refs)];
      for (const ref of unique) if (!resolveViewId(ref, view.diagramId)) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `Edge endpoint view is missing or ambiguous in this diagram: ${ref}`, xpath: view.sourceXPath, elementId: view.id, referenceId: ref, viewId: view.id, diagramId: view.diagramId });
      if (unique.length > 1) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: 'Edge declares multiple views for one endpoint', xpath: view.sourceXPath, elementId: view.id, viewId: view.id, diagramId: view.diagramId });
      return unique.length === 1 ? resolveViewId(unique[0], view.diagramId) : undefined;
    };
    view.sourceViewId = resolveEndpoint(sourceRefs);
    view.targetViewId = resolveEndpoint(targetRefs);
  }
  const rootAttrs = raw.find(node => node.tag === rootTag)?.attrs ?? {};
  const idsByFilePart: Record<string, string[]> = {};
  for (const node of raw) if (node.filePartName && !node.id.startsWith('generated-') && !attribute(node.attrs, 'xmi:idref', 'href')) (idsByFilePart[node.filePartName] ??= []).push(node.id);
  for (const ids of Object.values(idsByFilePart)) { const unique = [...new Set(ids)]; ids.splice(0, ids.length, ...unique); }
  const featureReferences = [...allObjects.values()].flatMap(object => Object.values(object.references ?? {}).flat());
  const applicationReferences = raw.filter(node => !node.filePartName && isStereotypeApplication(node)).flatMap(node => Object.values(extractSemanticFeatures(node, metaClass(node.tag, node.attrs)).references ?? {}).flat());
  const externalReferences = [...raw.map(node => attribute(node.attrs, 'href')), ...viewReferences.values(), ...[...relationReferences.values()].flat(), ...featureReferences, ...applicationReferences].flatMap(value => referenceTokens(value)).flatMap(value => {
    const href = value?.trim(); if (!href || !isExternalReference(href)) return [];
    const id = refId(href); if (!id) return [];
    const hash = href.lastIndexOf('#');
    return [{ href, file: href.slice(0, hash) || undefined, id }];
  });
  const exporterVersion = /<xmi:exporterVersion>([^<]+)<\/xmi:exporterVersion>/.exec(xml)?.[1];
  const extensions: ExtensionNode[] = raw.filter(node => {
    const type = normalizedType(metaClass(node.tag, node.attrs));
    if (!node.filePartName && isStereotypeApplication(node)) return true;
    return !node.id.startsWith('generated-') && !node.filePartName && !attribute(node.attrs, 'xmi:idref', 'href') && !knownMetaClasses.has(type) && !structuralTags.has(localName(node.tag)) && !isDiagram(metaClass(node.tag, node.attrs), node.tag, node.attrs) && !isView(metaClass(node.tag, node.attrs), node.tag, node.attrs);
  }).map(node => ({ id: node.id, tag: node.tag, metaClass: metaClass(node.tag, node.attrs), attributes: node.attrs, sourceXPath: node.path, ...extractSemanticFeatures(node, metaClass(node.tag, node.attrs)) }));
  return { schemaVersion: '1.2.0', id: crypto.randomUUID(), source: { fileName, encoding: /^\s*<\?xml[^>]*encoding=["']([^"']+)/i.exec(xml)?.[1] ?? 'UTF-8', xmiVersion: attribute(rootAttrs, 'xmi:version', 'xmiVersion'), productVersion: attribute(rootAttrs, 'productVersion') ?? exporterVersion }, elements: [...elements.values()], relations: [...relations.values()], diagrams: [...diagrams.values()], views: [...views.values()], extensions: extensions.length ? extensions : undefined, indexes: { idsByFilePart, externalReferences }, issues, statistics: { elements: elements.size, relations: relations.size, diagrams: diagrams.size, views: views.size, danglingReferences: issues.filter(x => x.code === 'DANGLING_REFERENCE').length, duplicateIds: duplicateIds.size } };
}
function qualifiedName(item: ModelElement, all: Map<string, ModelElement | Relation | Diagram>): string | undefined { const names: string[] = []; let current: ModelElement | Relation | Diagram | undefined = item; const seen = new Set<string>(); while (current && !seen.has(current.id)) { seen.add(current.id); if (current.name) names.unshift(current.name); current = current.ownerId ? all.get(current.ownerId) : undefined; } return names.length ? names.join('::') : undefined; }
