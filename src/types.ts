export type Severity = 'error' | 'warning';

export interface Issue {
  stage: 'parse';
  code: 'INVALID_XML' | 'DUPLICATE_ID' | 'DANGLING_REFERENCE' | 'MISSING_NAME' | 'UNSUPPORTED_ROOT';
  severity: Severity;
  message: string;
  xpath: string;
  elementId?: string;
  referenceId?: string;
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
  kind: string;
  sourceId?: string;
  targetId?: string;
  endIds: string[];
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
  kind: string;
  bounds?: string;
  waypoints?: string;
  label?: string;
  style: Record<string, string>;
  sourceXPath: string;
}

export interface ParsedModel {
  schemaVersion: '1.0.0';
  id: string;
  source: { fileName: string; encoding: string; xmiVersion?: string; productVersion?: string };
  elements: ModelElement[];
  relations: Relation[];
  diagrams: Diagram[];
  views: View[];
  issues: Issue[];
  statistics: { elements: number; relations: number; diagrams: number; views: number; danglingReferences: number; duplicateIds: number };
}
