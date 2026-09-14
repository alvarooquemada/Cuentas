import { getState, persist } from "./state.js";
import { uid, todayISO } from "./utils.js";

export function getIdeas() {
  return getState().ideas.slice().sort((a, b) => b.createdAt - a.createdAt);
}

export function getIdea(id) {
  return getState().ideas.find((i) => i.id === id);
}

export function addIdea({ title, note }) {
  const idea = { id: uid(), title, note: note || "", date: todayISO(), createdAt: Date.now() };
  getState().ideas.push(idea);
  persist();
  return idea;
}

export function updateIdea(id, patch) {
  const idea = getIdea(id);
  if (!idea) return;
  Object.assign(idea, patch);
  persist();
}

export function deleteIdea(id) {
  const state = getState();
  state.ideas = state.ideas.filter((i) => i.id !== id);
  persist();
}
