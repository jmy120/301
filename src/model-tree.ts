import type { Diagram, ModelElement, Relation } from './types.js';

type TreeItem = ModelElement | Relation | Diagram;
export type ModelTreeNode = TreeItem & { children: ModelTreeNode[]; cycle?: true };

export function buildModelTree(items: TreeItem[]): ModelTreeNode[] {
  const byId = new Map(items.map(item => [item.id, item]));
  const byOwner = new Map<string, TreeItem[]>();
  for (const item of items) {
    if (item.ownerId && byId.has(item.ownerId)) {
      (byOwner.get(item.ownerId) ?? byOwner.set(item.ownerId, []).get(item.ownerId)!).push(item);
    }
  }
  const tree = (item: TreeItem, path = new Set<string>()): ModelTreeNode => {
    if (path.has(item.id)) return { ...item, children: [], cycle: true };
    const next = new Set(path).add(item.id);
    return { ...item, children: (byOwner.get(item.id) ?? []).map(child => tree(child, next)) };
  };
  const roots = items.filter(item => !item.ownerId || !byId.has(item.ownerId));
  const reachable = new Set<string>();
  const collect = (node: ModelTreeNode): void => { if (reachable.has(node.id)) return; reachable.add(node.id); node.children.forEach(collect); };
  const result = roots.map(item => tree(item));
  result.forEach(collect);
  // An ownership cycle has no natural root. Expose one representative so it
  // remains discoverable while `cycle` prevents recursive rendering.
  for (const item of items) if (!reachable.has(item.id)) { const node = tree(item); result.push(node); collect(node); }
  return result;
}
