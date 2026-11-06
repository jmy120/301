"""Compare repaired model outputs with original XML and the pre-fix audit."""
import json
from pathlib import Path
from collections import Counter
from lxml import etree as ET
from jsonschema import Draft202012Validator

REPO = Path(__file__).parent
BASE = REPO.parent / '模型'
OUT = BASE / '解析修复验证_20261031'
BEFORE = BASE / '解析检查_20261031'
validator = Draft202012Validator(json.loads((REPO/'schema/parsed-model.schema.json').read_text(encoding='utf-8')))
X = '{http://www.omg.org/spec/XMI/20131001}'
features = {
    'AssociationClass': ['memberEnd', 'ownedEnd', 'ownedAttribute', 'ownedOperation', 'ownedConnector', 'ownedRule'],
    'InformationFlow': ['informationSource', 'informationTarget', 'conveyed', 'realizingConnector'],
    'InstanceSpecification': ['classifier', 'slot'], 'Slot': ['definingFeature', 'value'], 'InstanceValue': ['instance'],
    'InteractionUse': ['covered', 'refersTo'], 'TimeExpression': ['expr'],
    'ReadStructuralFeatureAction': ['structuralFeature', 'object', 'result'],
    'AddStructuralFeatureValueAction': ['structuralFeature', 'object', 'value', 'insertAt'],
    'ClearStructuralFeatureAction': ['structuralFeature', 'object'],
    'SendSignalAction': ['signal', 'target'], 'CallOperationAction': ['operation', 'target', 'argument', 'result'],
    'CreateObjectAction': ['classifier'], 'ValueSpecificationAction': ['value'],
}
summary=[]
for file in sorted(OUT.glob('*.parsed.json')):
    name=file.name.removesuffix('.parsed.json')
    model=json.loads(file.read_text(encoding='utf-8'))
    old=json.loads((BEFORE/file.name).read_text(encoding='utf-8'))
    validator.validate(model)
    objects={o['id']:o for k in ['elements','relations','diagrams'] for o in model[k]}
    old_objects={o['id']:o for k in ['elements','relations','diagrams'] for o in old[k]}
    assert old_objects.keys() <= objects.keys(), (name, 'lost objects')
    # Existing object fields and features must survive reclassification.
    for ident,o in old_objects.items():
        now=objects[ident]
        for key in ['attributes','stereotypes','ownerId','qualifiedName']:
            assert o.get(key)==now.get(key), (name,ident,key)
        assert set(o['childrenIds']) <= set(now['childrenIds'])
        for key,values in o.get('references',{}).items():
            assert set(values) <= set(now.get('references',{}).get(key,[])), (name,ident,key)
        for key,values in o.get('textValues',{}).items():
            assert values==now.get('textValues',{}).get(key), (name,ident,key)
    assert old['diagrams']==model['diagrams'], (name,'diagram regression')
    # A view can now bind to a relation instead of an element, but all other fields must survive.
    assert len(old['views'])==len(model['views'])
    for a,b in zip(old['views'],model['views']):
        assert {k:v for k,v in a.items() if k!='modelElementScope'}=={k:v for k,v in b.items() if k!='modelElementScope'}
    root=ET.parse(str(BASE/'export'/(name+'.xml'))).getroot()
    checked=0
    for n in root.iter():
        if not isinstance(n.tag,str):continue
        if any(ET.QName(a).localname=='filePart' for a in n.iterancestors()):continue
        ident=n.get(X+'id'); typ=n.get(X+'type','').split(':')[-1]
        if ident is None or typ not in features:continue
        o=objects[ident]
        if typ in ['AssociationClass','InformationFlow']:
            assert any(r['id']==ident for r in model['relations'])
        for key in features[typ]:
            expected=(n.get(key) or '').split()
            for c in n:
                if isinstance(c.tag,str) and ET.QName(c).localname==key:
                    ref=c.get(X+'id') or c.get(X+'idref') or c.get('href')
                    if ref:expected.extend(ref.split())
            for ref in expected:
                assert ref.lstrip('#') in o.get('references',{}).get(key,[]), (name,ident,key,ref)
                checked+=1
    issues=dict(Counter(i['code'] for i in model['issues']))
    assert not any(i['code']=='UNKNOWN_METACLASS' for i in model['issues'])
    if name!='hybrid sport utility vehicle':assert model['statistics']['danglingReferences']==0
    else:
        assert [i for i in old['issues'] if i['code']=='DANGLING_REFERENCE']==[i for i in model['issues'] if i['code']=='DANGLING_REFERENCE']
    entry=dict(model=name,checkedFeatureReferences=checked,addedObjects=sorted(objects.keys()-old_objects.keys()),issues=issues,schema='PASS',preservation='PASS')
    summary.append(entry)
    print(name, 'PASS',checked,'feature references;',len(entry['addedObjects']),'added objects;',issues)
(OUT/'verification.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2),encoding='utf-8')
