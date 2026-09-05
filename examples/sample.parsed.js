// Generated from sample.sysml.xml for JavaScript consumer smoke tests.
export const parsedModel = {
  schemaVersion: '1.0.0',
  id: 'sample-parsed-001',
  source: { fileName: 'sample.sysml.xml', encoding: 'UTF-8', xmiVersion: '2.5', productVersion: 'MagicDraw 2024x' },
  elements: [
    { id: 'model-1', metaClass: 'Model', name: 'VehicleModel', childrenIds: ['pkg-1', 'diagram-1'], stereotypes: [], attributes: { 'xmlns:uml': 'http://www.eclipse.org/uml2/5.0.0/UML', 'xmi:id': 'model-1', name: 'VehicleModel' }, sourceXPath: '/xmi:XMI/uml:Model', qualifiedName: 'VehicleModel' },
    { id: 'pkg-1', metaClass: 'Package', name: 'Structure', ownerId: 'model-1', childrenIds: ['block-1', 'port-1', 'connector-1'], stereotypes: [], attributes: { 'xmi:type': 'Package', 'xmi:id': 'pkg-1', name: 'Structure' }, sourceXPath: '/xmi:XMI/uml:Model/packagedElement', qualifiedName: 'VehicleModel::Structure' },
    { id: 'block-1', metaClass: 'Block', name: 'Vehicle', ownerId: 'pkg-1', childrenIds: [], stereotypes: [], attributes: { 'xmi:type': 'Block', 'xmi:id': 'block-1', name: 'Vehicle' }, sourceXPath: '/xmi:XMI/uml:Model/packagedElement/packagedElement', qualifiedName: 'VehicleModel::Structure::Vehicle' },
    { id: 'port-1', metaClass: 'Port', name: 'powerIn', ownerId: 'pkg-1', childrenIds: [], stereotypes: [], attributes: { 'xmi:type': 'Port', 'xmi:id': 'port-1', name: 'powerIn', type: 'block-1' }, sourceXPath: '/xmi:XMI/uml:Model/packagedElement/packagedElement', qualifiedName: 'VehicleModel::Structure::powerIn' }
  ],
  relations: [
    { id: 'connector-1', metaClass: 'Connector', kind: 'Connector', ownerId: 'pkg-1', childrenIds: [], stereotypes: [], attributes: { 'xmi:type': 'Connector', 'xmi:id': 'connector-1', source: 'port-1', target: 'block-1' }, sourceXPath: '/xmi:XMI/uml:Model/packagedElement/packagedElement', sourceId: 'port-1', targetId: 'block-1', sourceIds: ['port-1'], targetIds: ['block-1'], endIds: [], qualifiedName: 'VehicleModel::Structure' }
  ],
  diagrams: [
    { id: 'diagram-1', metaClass: 'Diagram', type: 'Block Definition Diagram', name: 'Vehicle BDD', ownerId: 'model-1', childrenIds: [], stereotypes: [], attributes: { 'xmi:type': 'Diagram', 'xmi:id': 'diagram-1', name: 'Vehicle BDD', diagramType: 'Block Definition Diagram' }, sourceXPath: '/xmi:XMI/uml:Model/ownedDiagram', viewIds: ['view-1'], qualifiedName: 'VehicleModel::Vehicle BDD' }
  ],
  views: [
    { id: 'view-1', diagramId: 'diagram-1', modelElementId: 'block-1', kind: 'Shape', bounds: '100,80,180,90', style: { 'xmi:type': 'Shape', 'xmi:id': 'view-1', modelElement: 'block-1', bounds: '100,80,180,90' }, sourceXPath: '/xmi:XMI/uml:Model/ownedDiagram/ownedDiagramElement' }
  ],
  issues: [],
  statistics: { elements: 4, relations: 1, diagrams: 1, views: 1, danglingReferences: 0, duplicateIds: 0 }
};

export default parsedModel;
