import type { ParsedModel } from './types.js';

const models = new Map<string, ParsedModel>();
export const modelStore = {
  put(model: ParsedModel): ParsedModel { models.set(model.id, model); return model; },
  get(id: string): ParsedModel | undefined { return models.get(id); },
  element(id: string) { for (const model of models.values()) { const found = [...model.elements, ...model.relations, ...model.diagrams].find(x => x.id === id); if (found) return found; } },
  diagram(id: string) { for (const model of models.values()) { const found = model.diagrams.find(x => x.id === id); if (found) return { ...found, views: model.views.filter(view => view.diagramId === id) }; } }
};
