import type { ParsedModel } from './types.js';

const models = new Map<string, ParsedModel>();
const timestamps = new Map<string, number>();
const MAX_MODELS = 20;
const TTL_MS = 30 * 60 * 1000;
function prune(now = Date.now()): void {
  for (const [id, time] of timestamps) if (now - time > TTL_MS) { timestamps.delete(id); models.delete(id); }
  while (models.size > MAX_MODELS) { const oldest = timestamps.entries().next().value as [string, number] | undefined; if (!oldest) break; timestamps.delete(oldest[0]); models.delete(oldest[0]); }
}
export const modelStore = {
  put(model: ParsedModel): ParsedModel { prune(); models.set(model.id, model); timestamps.set(model.id, Date.now()); prune(); return model; },
  get(id: string): ParsedModel | undefined { prune(); const model = models.get(id); if (model) timestamps.set(id, Date.now()); return model; },
  element(id: string, modelId?: string) { prune(); for (const model of models.values()) { if (modelId && model.id !== modelId) continue; const found = [...model.elements, ...model.relations, ...model.diagrams].find(x => x.id === id); if (found) return found; } },
  diagram(id: string, modelId?: string) { prune(); for (const model of models.values()) { if (modelId && model.id !== modelId) continue; const found = model.diagrams.find(x => x.id === id); if (found) return { ...found, views: model.views.filter(view => view.diagramId === id) }; } }
};
