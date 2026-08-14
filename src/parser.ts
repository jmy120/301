import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { attribute, isDiagram, isRelation, isView, localName, metaClass, normalizedType } from './adapter.js';
import type { Diagram, Issue, ModelElement, ParsedModel, Relation, View } from './types.js';

type RawNode = { id: string; tag: string; attrs: Record<string, string>; path: string; parentId?: string; diagramId?: string };
const idNames = ['xmi:id', 'id', 'ID'];
const referenceTags = new Set(['annotatedElement', 'client', 'supplier', 'source', 'target', 'memberEnd', 'ownedEnd', 'constrainedElement', 'elementID', 'usedObjects']);
const structuralTags = new Set(['packagedElement', 'ownedElement', 'ownedAttribute', 'ownedRule', 'nestedClassifier', 'ownedBehavior', 'ownedParameter', 'region', 'subvertex', 'transition', 'ownedMember']);

export function parseSysmlXml(xml: string, fileName = 'model.xml'): ParsedModel {
  const issues: Issue[] = [];
  const validation = XMLValidator.validate(xml);
  if (validation !== true) throw new Error(`INVALID_XML: ${validation.err.msg} at line ${validation.err.line}`);
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_', preserveOrder: true, trimValues: false });
  const doc = parser.parse(xml) as unknown[];
  const elements = new Map<string, ModelElement>(); const relations = new Map<string, Relation>();
  const diagrams = new Map<string, Diagram>(); const views = new Map<string, View>(); const raw: RawNode[] = [];
  const duplicateIds = new Set<string>(); let generated = 0; let rootTag = '';

  const visit = (nodes: unknown[], path: string, parentId?: string, diagramId?: string, semanticAllowed = true): void => {
    for (const item of nodes) {
      if (!item || typeof item !== 'object') continue;
      for (const [tag, value] of Object.entries(item as Record<string, unknown>)) {
        if (tag === ':@') continue;
        const rawAttrs = ((item as Record<string, unknown>)[':@'] ?? {}) as Record<string, string>;
        const attrs = Object.fromEntries(Object.entries(rawAttrs).map(([key, value]) => [key.startsWith('@_') ? key.slice(2) : key, String(value)]));
        const nodePath = `${path}/${tag}`; if (!rootTag) rootTag = tag;
        const explicitId = attribute(attrs, ...idNames);
        const id = explicitId ?? `generated-${++generated}`;
        const type = metaClass(tag, attrs);
        const node: RawNode = { id, tag, attrs, path: nodePath, parentId, diagramId };
        const currentDiagramId = isDiagram(type, tag, attrs) ? id : diagramId;
        const tagName = localName(tag);
        const isReference = Boolean(attribute(attrs, 'xmi:idref', 'href')) || referenceTags.has(tagName);
        const normalized = normalizedType(type);
        const isSemantic = semanticAllowed && Boolean(explicitId) && !isReference && (type.startsWith('uml:') || type.startsWith('sysml:') || structuralTags.has(tagName) || isRelation(type, tag) || ['Model', 'Package'].includes(normalized));
        if (isView(type, tag, attrs) && diagramId) {
          views.set(id, { id, diagramId, modelElementId: attribute(attrs, 'modelElement', 'modelElementId', 'subject'), kind: type, bounds: attribute(attrs, 'bounds'), waypoints: attribute(attrs, 'waypoints', 'points'), label: attribute(attrs, 'text', 'label'), style: attrs, sourceXPath: nodePath });
        } else if (isDiagram(type, tag, attrs)) {
          diagrams.set(id, { id, metaClass: type, type: attribute(attrs, 'diagramType', 'humanType', 'type') ?? type, name: attribute(attrs, 'name'), ownerId: parentId, childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, imageRef: attribute(attrs, 'imageRef', 'image'), viewIds: [] });
        } else if (isSemantic && isRelation(type, tag)) {
          relations.set(id, { id, metaClass: type, kind: type, name: attribute(attrs, 'name'), ownerId: parentId, childrenIds: [], stereotypes: [], attributes: attrs, sourceXPath: nodePath, sourceId: attribute(attrs, 'source', 'client', 'from'), targetId: attribute(attrs, 'target', 'supplier', 'to'), endIds: (attribute(attrs, 'memberEnd', 'ends', 'end') ?? '').split(/\s+/).filter(Boolean), direction: attribute(attrs, 'direction') });
        } else if (isSemantic) {
          if (elements.has(id)) { duplicateIds.add(id); issues.push({ code: 'DUPLICATE_ID', severity: 'error', message: `Duplicate ID: ${id}`, xpath: nodePath, elementId: id }); }
          else elements.set(id, { id, metaClass: type, name: attribute(attrs, 'name'), ownerId: parentId, childrenIds: [], stereotypes: (attribute(attrs, 'stereotype', 'appliedStereotype') ?? '').split(/\s+/).filter(Boolean), attributes: attrs, sourceXPath: nodePath });
        }
        raw.push(node);
        const child = Array.isArray(value) ? value : [];
        // filePart may contain MagicDraw installation profiles/projects. They are not part of the exported user model.
        visit(child, nodePath, id, currentDiagramId, semanticAllowed && tagName !== 'filePart');
      }
    }
  };
  visit(doc, '');
  if (!/xmi|model/i.test(rootTag)) issues.push({ code: 'UNSUPPORTED_ROOT', severity: 'warning', message: `Root node ${rootTag} does not look like XMI/XML model input`, xpath: `/${rootTag}` });
  const allObjects = new Map<string, ModelElement | Relation | Diagram>([...elements, ...relations, ...diagrams]);
  // MagicDraw commonly puts Dependency client/supplier and Association memberEnd in child reference nodes.
  for (const node of raw) {
    if (!node.parentId || !relations.has(node.parentId)) continue;
    const ref = attribute(node.attrs, 'xmi:idref', 'href')?.replace(/^#/, '');
    if (!ref) continue;
    const relation = relations.get(node.parentId)!;
    switch (localName(node.tag)) {
      case 'client': case 'source': relation.sourceId ??= ref; break;
      case 'supplier': case 'target': relation.targetId ??= ref; break;
      case 'memberEnd': case 'ownedEnd': relation.endIds.push(ref); break;
    }
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
    if (!obj.name && normalizedType(obj.metaClass) !== 'Model' && !['Property', 'Parameter', 'Comment'].includes(normalizedType(obj.metaClass))) issues.push({ code: 'MISSING_NAME', severity: 'warning', message: `${obj.metaClass} has no name`, xpath: obj.sourceXPath, elementId: obj.id });
  }
  for (const relation of relations.values()) for (const ref of [relation.sourceId, relation.targetId, ...relation.endIds]) if (ref && !allObjects.has(ref)) issues.push({ code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved ${relation.kind} reference: ${ref}`, xpath: relation.sourceXPath, elementId: relation.id, referenceId: ref });
  for (const view of views.values()) { diagrams.get(view.diagramId)?.viewIds.push(view.id); if (view.modelElementId && !allObjects.has(view.modelElementId)) issues.push({ code: 'DANGLING_REFERENCE', severity: 'error', message: `Unresolved view model element: ${view.modelElementId}`, xpath: view.sourceXPath, elementId: view.id, referenceId: view.modelElementId }); }
  const rootAttrs = raw[0]?.attrs ?? {};
  const exporterVersion = /<xmi:exporterVersion>([^<]+)<\/xmi:exporterVersion>/.exec(xml)?.[1];
  return { id: crypto.randomUUID(), source: { fileName, encoding: /^\s*<\?xml[^>]*encoding=["']([^"']+)/i.exec(xml)?.[1] ?? 'UTF-8', xmiVersion: attribute(rootAttrs, 'xmi:version', 'xmiVersion'), productVersion: attribute(rootAttrs, 'productVersion') ?? exporterVersion }, elements: [...elements.values()], relations: [...relations.values()], diagrams: [...diagrams.values()], views: [...views.values()], issues, statistics: { elements: elements.size, relations: relations.size, diagrams: diagrams.size, views: views.size, danglingReferences: issues.filter(x => x.code === 'DANGLING_REFERENCE').length, duplicateIds: duplicateIds.size } };
}
function qualifiedName(item: ModelElement, all: Map<string, ModelElement | Relation | Diagram>): string | undefined { const names: string[] = []; let current: ModelElement | Relation | Diagram | undefined = item; const seen = new Set<string>(); while (current && !seen.has(current.id)) { seen.add(current.id); if (current.name) names.unshift(current.name); current = current.ownerId ? all.get(current.ownerId) : undefined; } return names.length ? names.join('::') : undefined; }
