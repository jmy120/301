export type Severity = 'error' | 'warning';

export interface Issue {
  stage: 'parse';
  code: 'INVALID_XML' | 'DUPLICATE_ID' | 'DANGLING_REFERENCE' | 'MISSING_NAME' | 'UNSUPPORTED_ROOT' | 'UNKNOWN_METACLASS' | 'INVALID_VIEW';
  severity: Severity;
  message: string;
  xpath: string;
  elementId?: string;
  referenceId?: string;
  diagramId?: string;
  viewId?: string;
}

export interface ModelElement {
  id: string;
  metaClass: string;
  name?: string;
  qualifiedName?: string;
  ownerId?: string;
  childrenIds: string[];
  stereotypes: string[];
  attributes: Record<string, string>;
  sourceXPath: string;
}

export interface Relation extends ModelElement {
  /** Whether this is a UML/SysML relation or an edge reconstructed from a diagram. */
  relationOrigin: 'semantic' | 'diagram';
  kind: string;
  sourceId?: string;
  targetId?: string;
  endIds: string[];
  sourceIds?: string[];
  targetIds?: string[];
  direction?: string;
}

export interface Diagram extends ModelElement {
  type: string;
  rootViewId?: string;
  imageRef?: string;
  viewIds: string[];
}

export interface View {
  id: string;
  diagramId: string;
  modelElementId?: string;
  /** Collection containing modelElementId when the reference is available. */
  modelElementScope?: 'element' | 'relation' | 'diagram' | 'external' | 'unresolved';
  /** A drawable node/edge, or a structural record describing the diagram itself. */
  presentationKind: 'graphic' | 'diagram-structure';
  kind: string;
  bounds?: string;
  waypoints?: string;
  label?: string;
  style: Record<string, string>;
  sourceXPath: string;
}

export interface ExtensionNode {
  id?: string;
  tag: string;
  metaClass: string;
  attributes: Record<string, string>;
  sourceXPath: string;
}

export interface ParsedModel {
  schemaVersion: '1.1.0';
  id: string;
  source: { fileName: string; encoding: string; xmiVersion?: string; productVersion?: string };
  elements: ModelElement[];
  relations: Relation[];
  diagrams: Diagram[];
  views: View[];
  extensions?: ExtensionNode[];
  indexes?: Indexes;
  issues: Issue[];
  statistics: { elements: number; relations: number; diagrams: number; views: number; danglingReferences: number; duplicateIds: number };
}

export interface Indexes {
  /** Exported XML IDs grouped by MagicDraw filePart name. */
  idsByFilePart: Record<string, string[]>;
  /** References outside the imported model; these are not local dangling references. */
  externalReferences: Array<{ href: string; file?: string; id: string }>;
}
