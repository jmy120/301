import { localName, normalizedType } from './adapter.js';

export interface FeatureNode {
  tag: string;
  attrs: Record<string, string>;
  text?: string;
  children: FeatureNode[];
  exportedId?: string;
}

export interface SemanticFeatures {
  /** Local IDs are normalized; external URI tokens retain their file part. */
  references?: Record<string, string[]>;
  /** Ordered lexical values. Keys are XML feature paths relative to this node. */
  textValues?: Record<string, string[]>;
}

const referenceFeatures: Record<string, string[]> = {
  Property: ['type', 'association', 'redefinedProperty', 'subsettedProperty'],
  Port: ['type', 'association', 'redefinedPort', 'redefinedProperty'],
  Parameter: ['type'], Operation: ['type', 'raisedException', 'redefinedOperation', 'method'],
  Association: ['memberEnd', 'navigableOwnedEnd'],
  AssociationClass: ['memberEnd', 'navigableOwnedEnd'],
  InformationFlow: ['informationSource', 'informationTarget', 'conveyed', 'realizingConnector', 'realization', 'realizingActivityEdge', 'realizingMessage'],
  InstanceSpecification: ['classifier', 'specification'], Slot: ['definingFeature'], InstanceValue: ['instance'],
  ConnectorEnd: ['role', 'partWithPort', 'definingEnd'], Connector: ['type', 'redefinedConnector'],
  Lifeline: ['represents', 'decomposedAs', 'coveredBy'],
  InteractionUse: ['covered', 'refersTo', 'returnValue', 'returnValueRecipient'], CombinedFragment: ['covered'],
  MessageOccurrenceSpecification: ['covered', 'message', 'event'],
  OccurrenceSpecification: ['covered'], ExecutionOccurrenceSpecification: ['covered', 'execution'],
  BehaviorExecutionSpecification: ['covered', 'start', 'finish', 'behavior'],
  ActionExecutionSpecification: ['covered', 'start', 'finish', 'action'],
  Message: ['sendEvent', 'receiveEvent', 'signature', 'connector'],
  Transition: ['source', 'target', 'guard', 'effect', 'trigger'], Trigger: ['event', 'port'],
  CallEvent: ['operation'], SignalEvent: ['signal'], ChangeEvent: ['changeExpression'],
  TimeEvent: ['when'], TimeExpression: ['expr', 'observation'], State: ['submachine', 'connection'],
  Constraint: ['constrainedElement', 'specification'], InteractionConstraint: ['constrainedElement', 'specification'],
  ControlFlow: ['source', 'target', 'guard'], ObjectFlow: ['source', 'target', 'guard', 'selection', 'transformation'],
  CallBehaviorAction: ['behavior'], CallOperationAction: ['operation'],
  ReadStructuralFeatureAction: ['structuralFeature'], AddStructuralFeatureValueAction: ['structuralFeature', 'insertAt'],
  ClearStructuralFeatureAction: ['structuralFeature'], CreateObjectAction: ['classifier'], SendSignalAction: ['signal'],
  Activity: ['partition'], ActivityPartition: ['represents', 'node', 'edge', 'subpartition', 'superPartition'],
  InterruptibleActivityRegion: ['node', 'interruptingEdge'],
  Include: ['includingCase', 'addition'], Extend: ['extension', 'extendedCase', 'extensionLocation'],
  Generalization: ['specific', 'general'],
  PackageImport: ['importingNamespace', 'importedPackage'], PackageMerge: ['receivingPackage', 'mergedPackage']
};
const typedClasses = new Set(['InputPin', 'OutputPin', 'ObjectNode', 'ActivityParameterNode', 'CentralBufferNode',
  'FlowPort', 'FlowProperty', 'PartProperty', 'ReferenceProperty', 'ValueProperty', 'ConstraintProperty', 'ConstraintParameter', 'ProxyPort']);
const ownedFeatures = new Set(['ownedAttribute', 'ownedEnd', 'ownedParameter', 'ownedOperation', 'ownedConnector',
  'end', 'lowerValue', 'upperValue', 'defaultValue', 'specification', 'guard', 'effect', 'trigger',
  'entry', 'exit', 'doActivity', 'region', 'transition', 'subvertex', 'node', 'edge', 'fragment',
  'lifeline', 'message', 'operand', 'interactionConstraint', 'extensionPoint', 'condition', 'when',
  'changeExpression', 'argument', 'result', 'inputValue', 'outputValue', 'minint', 'maxint',
  'slot', 'expr', 'weight', 'ownedRule', 'generalization', 'packageImport', 'packageMerge', 'include', 'extend',
  'profileApplication', 'ownedLiteral', 'nestedClassifier', 'group', 'interfaceRealization', 'formalGate']);
const actionClasses = new Set(['Action', 'OpaqueAction', 'CallBehaviorAction', 'CallOperationAction', 'ReadSelfAction',
  'ReadStructuralFeatureAction', 'AddStructuralFeatureValueAction', 'ClearStructuralFeatureAction',
  'ValueSpecificationAction', 'CreateObjectAction', 'SendSignalAction', 'AcceptEventAction']);
const actionOwnedFeatures = new Set(['object', 'target', 'value', 'insertAt']);
const activityMemberClasses = new Set([...actionClasses, 'ControlFlow', 'ObjectFlow', 'ActivityParameterNode',
  'ObjectNode', 'CentralBufferNode', 'InitialNode', 'ActivityFinalNode', 'FlowFinalNode', 'ForkNode', 'JoinNode', 'DecisionNode', 'MergeNode']);
const scalarFeatures = new Set(['body', 'language', 'Text', 'Id', 'value']);
const wrappers = new Set(['Extension', 'modelExtension']);

export function referenceTokens(value?: string): string[] {
  return (value ?? '').trim().split(/\s+/).filter(Boolean);
}

export function normalizedReference(value: string): string {
  // Never discard the file part: library.uml#x must remain distinct from x.
  if (value.lastIndexOf('#') > 0) return value;
  const id = value.startsWith('#') ? value.slice(1) : value;
  try { return decodeURIComponent(id); } catch { return id; }
}

function nestedReferenceTokens(node: FeatureNode): string[] {
  if (node.exportedId) return [node.exportedId];
  const direct = node.attrs['xmi:idref'] ?? node.attrs.href;
  if (direct !== undefined) return referenceTokens(direct);
  return [...referenceTokens(node.text), ...node.children.flatMap(child => nestedReferenceTokens(child))];
}

export function extractSemanticFeatures(node: FeatureNode, metaClass: string): SemanticFeatures {
  const references: Record<string, string[]> = {};
  const textValues: Record<string, string[]> = {};
  const type = normalizedType(metaClass);
  const names = new Set(referenceFeatures[type] ?? (typedClasses.has(type) ? ['type'] : []));
  if (activityMemberClasses.has(type)) for (const name of ['inPartition', 'inInterruptibleRegion']) names.add(name);
  const isOwned = (name: string): boolean => ownedFeatures.has(name)
    || (actionClasses.has(type) && actionOwnedFeatures.has(name))
    || (type === 'Slot' && name === 'value');
  const isReference = (name: string): boolean => names.has(name) || name.startsWith('base_');
  const addReference = (key: string, tokens: string[]): void => {
    if (tokens.length) references[key] = [...new Set([...(references[key] ?? []), ...tokens.map(normalizedReference).filter(Boolean)])];
  };
  const addText = (key: string, value: string): void => { (textValues[key] ??= []).push(value); };
  const walk = (current: FeatureNode, prefix: string): void => {
    for (const [key, value] of Object.entries(current.attrs)) {
      const name = localName(key);
      // xmi:type describes the metaclass, not a classifier reference.
      if ((!key.includes(':') || name.startsWith('base_')) && isReference(name)) addReference(`${prefix}${name}`, referenceTokens(value));
      else if (!key.includes(':') && scalarFeatures.has(name)) addText(`${prefix}${name}`, value);
    }
    for (const child of current.children) {
      const name = localName(child.tag);
      if (name === '#text') continue;
      const key = `${prefix}${name}`;
      if (isReference(name)) {
        const inlineDefinition = isOwned(name) && !child.exportedId
          && child.attrs['xmi:idref'] === undefined && child.attrs.href === undefined
          && (child.attrs['xmi:type'] !== undefined || child.attrs.value !== undefined
            || child.children.some(n => scalarFeatures.has(localName(n.tag)) || isOwned(localName(n.tag))));
        if (inlineDefinition) walk(child, `${key}.`);
        else addReference(key, nestedReferenceTokens(child));
      } else if (isOwned(name) && (child.attrs['xmi:idref'] !== undefined || child.attrs.href !== undefined)) {
        addReference(key, nestedReferenceTokens(child));
      } else if (child.exportedId) {
        // An owned object's features belong to that object, not this owner.
        if (isOwned(name)) addReference(key, [child.exportedId]);
      } else if (isOwned(name) && (child.attrs['xmi:type'] !== undefined || child.attrs.value !== undefined || child.children.some(n => localName(n.tag) !== '#text'))) {
        // Inline Slot/action values may use the same tag as scalar <value>.
        walk(child, `${key}.`);
      } else if (scalarFeatures.has(name)) {
        addText(key, child.text ?? '');
      } else if (wrappers.has(name)) {
        walk(child, prefix);
      } else if (isOwned(name)) {
        // Anonymous inline ValueSpecifications have no ID to link to.
        walk(child, `${key}.`);
      }
    }
  };
  walk(node, '');
  return {
    ...(Object.keys(references).length ? { references } : {}),
    ...(Object.keys(textValues).length ? { textValues } : {})
  };
}
