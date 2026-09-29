import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { attribute, isDiagram, isRelation, isView, localName, metaClass, normalizedType } from './adapter.js';
import { canonicalDiagramType, RULE_REQUIRED_METACLASSES } from './sysml-whitelist.js';
import type { Diagram, ExtensionNode, Issue, ModelElement, ParsedModel, Relation, View } from './types.js';

type RawNode = { id: string; tag: string; attrs: Record<string, string>; path: string; parentId?: string; diagramId?: string; filePartName?: string; text?: string };
const idNames = ['xmi:id', 'id', 'ID'];
const referenceTags = new Set(['annotatedElement', 'client', 'supplier', 'source', 'target', 'memberEnd', 'constrainedElement', 'elementID', 'usedObjects']);
// Association ends are normally serialized as `ownedEnd` properties.  They
// must enter the semantic index as well, otherwise valid memberEnd references
// look dangling and their diagram views cannot be resolved.
const structuralTags = new Set(['packagedElement', 'ownedElement', 'ownedAttribute', 'ownedEnd', 'ownedRule', 'nestedClassifier', 'ownedBehavior', 'ownedParameter', 'region', 'subvertex', 'transition', 'ownedMember']);
const knownMetaClasses = new Set([...RULE_REQUIRED_METACLASSES, 'ActivityParameterNode', 'InputPin', 'OutputPin', 'ObjectNode', 'Region', 'ConstraintBlock', 'Constraint', 'ConstraintParameter', 'ConstraintProperty', 'ValueProperty', 'Node', 'Device', 'Artifact', 'NestedConnectorEnd', 'ProxyPort', 'PartProperty', 'InterfaceBlock', 'Deployment', 'ObjectFlow', 'BindingConnector', 'ItemFlow', 'Allocate', 'Flow', 'Realization', 'InterfaceRealization', 'Substitution', 'Abstraction', 'CommunicationPath', 'InterruptFlow', 'OpaqueExpression', 'LiteralString', 'LiteralInteger', 'LiteralUnlimitedNatural', 'Comment', 'DiagramInfo', 'ProfileApplication', 'CustomSort', 'additionalPackageImport', 'auxiliaryResource']);
const graphicsExtensionTags = new Set(['diagramContents', 'binaryObject', 'image', 'imageData', 'shape', 'edge', 'path', 'geometry', 'presentationElement', 'mdElement', 'ContainmentLink', 'linkFirstEndID', 'linkSecondEndID', 'elementID']);
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
function descendantNodes(owner: RawNode, raw: RawNode[], rawById: Map<string, RawNode>): RawNode[] {
  return raw.filter(node => {
    let current = node;
    while (current.parentId) {
      if (current.parentId === owner.id) return true;
      const parent = rawById.get(current.parentId);
      if (!parent) break;
      current = parent;
    }
    return false;
  });
}

export function parseSysmlXml(xml: string, fileName = 'model.xml'): ParsedModel {
  const issues: Issue[] = [];
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error(`INVALID_XML: ${validation.err.msg} at line ${validation.err.line}`);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false });
  const doc = parser.parse(xml) as unknown[];
  const elements = new Map<string, ModelElement>(); const relations = new Map<string, Relation>();
  const diagrams = new Map<string, Diagram>(); const views = new Map<string, View>(); const raw: RawNode[] = [];
  const duplicateIds = new Set<string>(); const seenIds = new Set<string>(); let generated = 0; let rootTag = '';
  const collisionId = (id: string, collection: Map<string, unknown>, xpath: string): string => {
    if (!collection.has(id)) return id;
    let n = 2; while (collection.has(`${id}#duplicate-${n}`)) n++;
    duplicateIds.add(id);
    issues.push({ stage: 'parse', code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath, elementId: id });
    return `${id}#duplicate-${n}`;
  };

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
          const viewId = collisionId(id, views, nodePath); views.set(viewId, { id: viewId, diagramId, modelElementId: refId(attribute(attrs, 'modelElement', 'modelElementId', 'subject')), presentationKind: 'graphic', kind: type, bounds: attribute(attrs, 'bounds'), waypoints: attribute(attrs, 'waypoints', 'points'), label: attribute(attrs, 'text', 'label'), style: attrs, sourceXPath: nodePath });
        } else if (isDiagram(type, tag, attrs)) {
          const diagramId = collisionId(id, diagrams, nodePath); diagrams.set(diagramId, { id: diagramId, metaClass: type, type: attribute(attrs, 'diagramType', 'humanType', 'type') ?? type, name: attribute(attrs, 'name'), ownerId: refId(attribute(attrs, 'ownerOfDiagram', 'owner', 'namespace')) ?? parentId, childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, rootViewId: refId(attribute(attrs, 'rootViewId', 'rootView')), imageRef: attribute(attrs, 'imageRef', 'image'), viewIds: [] });
        } else if (isSemantic && isRelation(type, tag)) {
          const sourceIds = refIds(attribute(attrs, 'source', 'client', 'from', 'relatedElement')); const targetIds = refIds(attribute(attrs, 'target', 'supplier', 'to', 'general'));
          const relationId = collisionId(id, relations, nodePath); relations.set(relationId, { id: relationId, metaClass: type, kind: type, relationOrigin: 'semantic', name: attribute(attrs, 'name'), ownerId: refId(attribute(attrs, 'owner', 'namespace')) ?? exportedOwnerId(parentId), childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, sourceId: sourceIds[0], targetId: targetIds[0], sourceIds, targetIds, endIds: refIds(attribute(attrs, 'memberEnd', 'ends', 'end')), direction: attribute(attrs, 'direction') });
        } else if (isSemantic) {
          if (elements.has(id)) { duplicateIds.add(id); issues.push({ stage: 'parse', code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath: nodePath, elementId: id }); }
          else elements.set(id, { id, metaClass: type, name: attribute(attrs, 'name'), ownerId: normalized === 'Model' ? undefined : refId(attribute(attrs, 'owner', 'namespace')) ?? exportedOwnerId(parentId), childrenIds: [], stereotypes: (attribute(attrs, 'stereotype', 'appliedStereotype') ?? '').split(/\s+/).filter(Boolean), attributes: attrs, sourceXPath: nodePath });
        }
        if (semanticAllowed && explicitId && !isReference && !isDiagram(type, tag, attrs) && !isView(type, tag, attrs) && !knownMetaClasses.has(normalized) && !structuralTags.has(tagName) && !graphicsExtensionTags.has(tagName)) issues.push({ stage: 'parse', code: 'UNKNOWN_METACLASS', severity: 'warning', message: `Unknown metaclass: ${type}`, xpath: nodePath, elementId: id });
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
      case 'client': case 'source': case 'relatedElement': relation.sourceId ??= ref; (relation.sourceIds ??= []).push(ref); break;
      case 'supplier': case 'target': case 'general': relation.targetId ??= ref; (relation.targetIds ??= []).push(ref); break;
      case 'memberEnd': case 'ownedEnd': relation.endIds.push(ref); break;
    }
  }
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
    let parentId = rawByExportedId.get(id)?.parentId;
    while (parentId) {
      if (allObjects.has(parentId)) return parentId;
      parentId = rawById.get(parentId)?.parentId;
    }
  };
  for (const object of allObjects.values()) {
    if (!object.ownerId && normalizedType(object.metaClass) !== 'Model') {
      object.ownerId = nearestExportedOwnerId(object.id);
    }
  }
  // MagicDraw stores the actual SysML diagram kind on an embedded
  // DiagramRepresentationObject, not on uml:Diagram itself. Recover it so
  // validator rules can select BDD/IBD/use-case/activity/etc. precisely.
  for (const node of raw) {
    if (localName(node.tag) !== 'DiagramRepresentationObject') continue;
    let ancestor = node;
    while (ancestor.parentId) {
      const parent = rawById.get(ancestor.parentId);
      if (!parent) break;
      if (diagrams.has(parent.id)) {
        const diagramType = canonicalDiagramType(attribute(node.attrs, 'type', 'diagramType', 'humanType'));
        if (diagramType) diagrams.get(parent.id)!.type = diagramType;
        break;
      }
      ancestor = parent;
    }
  }
  // Endpoint references are also commonly nested below wrapper nodes. Walk
  // descendants and merge them into the same normalized arrays.
  for (const relation of relations.values()) {
    const owner = raw.find(node => node.id === relation.id);
    if (!owner) continue;
    const descendants = descendantNodes(owner, raw, rawById);
    for (const node of descendants) {
      const ref = nodeRef(node); if (!ref) continue;
      let name = localName(node.tag);
      if (!['client', 'source', 'relatedElement', 'supplier', 'target', 'general', 'memberEnd', 'ownedEnd'].includes(name)) {
        let parentId = node.parentId;
        while (parentId && parentId !== owner.id) {
          const parent = rawById.get(parentId); if (!parent) break;
          const parentName = localName(parent.tag);
          if (['client', 'source', 'relatedElement', 'supplier', 'target', 'general', 'memberEnd', 'ownedEnd'].includes(parentName)) { name = parentName; break; }
          parentId = parent.parentId;
        }
      }
      if (name === 'client' || name === 'source' || name === 'relatedElement') { relation.sourceIds ??= []; if (!relation.sourceIds.includes(ref)) relation.sourceIds.push(ref); relation.sourceId ??= ref; }
      if (name === 'supplier' || name === 'target' || name === 'general') { relation.targetIds ??= []; if (!relation.targetIds.includes(ref)) relation.targetIds.push(ref); relation.targetId ??= ref; }
      if (name === 'memberEnd' || name === 'ownedEnd') if (!relation.endIds.includes(ref)) relation.endIds.push(ref);
    }
  }
  // Some exporters encode a view's model reference as a nested elementID
  // node instead of a modelElement attribute. Normalize it the same way as
  // direct attributes (including external href/file#id references).
  for (const [viewId, view] of views) {
    if (view.modelElementId) continue;
    const child = (childrenByParent.get(viewId) ?? []).find(x => localName(x.tag) === 'elementID');
    const ref = child ? nodeRef(child) : undefined;
    if (ref) view.modelElementId = ref;
  }
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
    views.set(node.id, { id: node.id, diagramId, modelElementId: modelRef, presentationKind: 'graphic', kind: attribute(node.attrs, 'elementClass') ?? 'mdElement', bounds: geometry, style: node.attrs, sourceXPath: node.path });
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
    relations.set(relationId, { id: relationId, metaClass: kind, kind, relationOrigin: 'diagram', ownerId: diagramId, childrenIds: [], stereotypes: [], attributes: node.attrs, sourceXPath: node.path, sourceId, targetId, endIds: [] });
    const geometry = children.find(child => localName(child.tag) === 'geometry')?.text;
    views.set(node.id, { id: node.id, diagramId, modelElementId: relationId, presentationKind: 'graphic', kind, bounds: geometry, style: node.attrs, sourceXPath: node.path });
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
      view.modelElementScope = elements.has(view.modelElementId) ? 'element'
        : relations.has(view.modelElementId) ? 'relation'
        : diagrams.has(view.modelElementId) ? 'diagram'
        : externalViewReferenceIds.has(view.modelElementId) ? 'external'
        : 'unresolved';
    }
    const diagram = diagrams.get(view.diagramId);
    const isDiagramTypeRecord = Boolean(diagram && !view.modelElementId && view.kind === diagram.type);
    view.presentationKind = view.kind === 'diagramRepresentation'
      || view.kind === 'DiagramFrame'
      || isDiagramTypeRecord
      ? 'diagram-structure'
      : 'graphic';
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
  // Profile/library href values can legitimately point outside the imported
  // model. Keep their normalized IDs, but do not diagnose them as local
  // dangling references.
  const externalHrefIds = new Set(raw.map(node => attribute(node.attrs, 'href')).filter((href): href is string => Boolean(href && !href.trim().startsWith('#') && href.includes('#'))).map(refId).filter((id): id is string => Boolean(id)));
  for (const relation of relations.values()) {
    const references = new Set([relation.sourceId, relation.targetId, ...(relation.sourceIds ?? []), ...(relation.targetIds ?? []), ...relation.endIds].filter((ref): ref is string => Boolean(ref)));
    for (const ref of references) {
      if (!allObjects.has(ref) && !externalHrefIds.has(ref) && !relation.id.startsWith('diagram-link:')) {
        issues.push({ stage: 'parse', code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved ${relation.kind} reference: ${ref}`, xpath: relation.sourceXPath, elementId: relation.id, referenceId: ref });
      }
    }
  }
  for (const view of views.values()) { const diagram = diagrams.get(view.diagramId); if (!diagram) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `View belongs to missing diagram: ${view.diagramId}`, xpath: view.sourceXPath, elementId: view.id, diagramId: view.diagramId, viewId: view.id }); else diagram.viewIds.push(view.id); if (view.modelElementId && !allObjects.has(view.modelElementId) && !view.sourceXPath.includes('/filePart/')) issues.push({ stage: 'parse', code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved view model element: ${view.modelElementId}`, xpath: view.sourceXPath, elementId: view.id, referenceId: view.modelElementId, viewId: view.id, diagramId: view.diagramId }); }
  for (const diagram of diagrams.values()) {
    const declared = new Set(diagram.viewIds);
    for (const viewId of declared) if (!views.has(viewId)) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `Diagram references missing view: ${viewId}`, xpath: diagram.sourceXPath, elementId: diagram.id, diagramId: diagram.id, viewId });
    if (diagram.rootViewId && (!views.has(diagram.rootViewId) || views.get(diagram.rootViewId)!.diagramId !== diagram.id)) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `Diagram rootViewId is invalid: ${diagram.rootViewId}`, xpath: diagram.sourceXPath, elementId: diagram.id, diagramId: diagram.id, viewId: diagram.rootViewId });
  }
  for (const view of views.values()) {
    if (!/edge|link|path/i.test(view.kind)) continue;
    const refs = [view.style['source'], view.style['target'], view.style['sourceView'], view.style['targetView'], view.style['linkFirstEndID'], view.style['linkSecondEndID']].flatMap(value => refIds(value));
    const rawView = raw.find(node => node.id === view.id);
    if (rawView) {
      for (const node of descendantNodes(rawView, raw, rawById)) {
        const name = localName(node.tag);
        if (['source', 'target', 'sourceView', 'targetView', 'linkFirstEndID', 'linkSecondEndID'].includes(name)) {
          const ref = nodeRef(node);
          if (ref) refs.push(ref);
        }
      }
    }
    for (const ref of refs) if (!views.has(ref) && !allObjects.has(ref)) issues.push({ stage: 'parse', code: 'INVALID_VIEW', severity: 'error', message: `Edge endpoint view does not exist: ${ref}`, xpath: view.sourceXPath, elementId: view.id, referenceId: ref, viewId: view.id, diagramId: view.diagramId });
  }
  const rootAttrs = raw.find(node => node.tag === rootTag)?.attrs ?? {};
  const idsByFilePart: Record<string, string[]> = {};
  for (const node of raw) if (node.filePartName && !node.id.startsWith('generated-') && !attribute(node.attrs, 'xmi:idref', 'href')) (idsByFilePart[node.filePartName] ??= []).push(node.id);
  for (const ids of Object.values(idsByFilePart)) { const unique = [...new Set(ids)]; ids.splice(0, ids.length, ...unique); }
  const externalReferences = raw.flatMap(node => {
    const href = attribute(node.attrs, 'href'); if (!href || !href.includes('#')) return [];
    const id = refId(href); if (!id) return [];
    const hash = href.lastIndexOf('#');
    return [{ href, file: href.slice(0, hash) || undefined, id }];
  });
  const exporterVersion = /<xmi:exporterVersion>([^<]+)<\/xmi:exporterVersion>/.exec(xml)?.[1];
  const extensions: ExtensionNode[] = raw.filter(node => {
    const type = normalizedType(metaClass(node.tag, node.attrs));
    return !node.id.startsWith('generated-') && !node.filePartName && !attribute(node.attrs, 'xmi:idref', 'href') && !knownMetaClasses.has(type) && !structuralTags.has(localName(node.tag)) && !isDiagram(metaClass(node.tag, node.attrs), node.tag, node.attrs) && !isView(metaClass(node.tag, node.attrs), node.tag, node.attrs);
  }).map(node => ({ id: node.id, tag: node.tag, metaClass: metaClass(node.tag, node.attrs), attributes: node.attrs, sourceXPath: node.path }));
  return { schemaVersion: '1.1.0', id: crypto.randomUUID(), source: { fileName, encoding: /^\s*<\?xml[^>]*encoding=["']([^"']+)/i.exec(xml)?.[1] ?? 'UTF-8', xmiVersion: attribute(rootAttrs, 'xmi:version', 'xmiVersion'), productVersion: attribute(rootAttrs, 'productVersion') ?? exporterVersion }, elements: [...elements.values()], relations: [...relations.values()], diagrams: [...diagrams.values()], views: [...views.values()], extensions: extensions.length ? extensions : undefined, indexes: { idsByFilePart, externalReferences }, issues, statistics: { elements: elements.size, relations: relations.size, diagrams: diagrams.size, views: views.size, danglingReferences: issues.filter(x => x.code === 'DANGLING_REFERENCE').length, duplicateIds: duplicateIds.size } };
}
function qualifiedName(item: ModelElement, all: Map<string, ModelElement | Relation | Diagram>): string | undefined { const names: string[] = []; let current: ModelElement | Relation | Diagram | undefined = item; const seen = new Set<string>(); while (current && !seen.has(current.id)) { seen.add(current.id); if (current.name) names.unshift(current.name); current = current.ownerId ? all.get(current.ownerId) : undefined; } return names.length ? names.join('::') : undefined; }
