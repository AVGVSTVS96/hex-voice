import assert from "node:assert/strict";

export const nth = <T>(items: readonly T[], at: number) => {
  const item = items[at];
  assert.ok(item !== undefined, `nothing at ${at} of ${items.length}`);

  return item;
};
