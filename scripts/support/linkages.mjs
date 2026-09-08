/** Replace descriptors in place: registry order is part of the model identity. */
export function replaceLinkages(existing, replacements) {
  const byId = new Map(replacements.map(item => [item.id, item]));
  const present = new Set(existing.map(item => item.id));
  return [...existing.map(item => byId.get(item.id) ?? item),
    ...replacements.filter(item => !present.has(item.id))];
}
