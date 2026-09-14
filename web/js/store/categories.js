import { getState, persist } from "./state.js";
import { uid } from "./utils.js";

export function getCategories() {
  return getState().categories;
}

export function getCategory(id) {
  return getState().categories.find((c) => c.id === id);
}

export function addCategory({ name, icon, color }) {
  const cat = { id: uid(), name, icon: icon || "🏷️", color: color || "#8a94a6" };
  getState().categories.push(cat);
  persist();
  return cat;
}

export function updateCategory(id, patch) {
  const cat = getCategory(id);
  if (!cat) return;
  Object.assign(cat, patch);
  persist();
}

export function deleteCategory(id) {
  const state = getState();
  state.categories = state.categories.filter((c) => c.id !== id);
  state.movements.forEach((m) => {
    if (m.categoryId === id) m.categoryId = null;
  });
  persist();
}
