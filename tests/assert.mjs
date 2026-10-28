import assert from "node:assert/strict";
export function expect(actual) {
  return {
    toBe: (expected) => assert.strictEqual(actual, expected),
    toEqual: (expected) => assert.deepStrictEqual(actual, expected),
    toHaveLength: (expected) => assert.strictEqual(actual.length, expected),
    toContain: (expected) => assert.ok(actual.includes(expected)),
    toBeGreaterThan: (expected) => assert.ok(actual > expected),
    toHaveBeenCalledWith: (...args) =>
      assert.ok(
        actual.mock.calls.some((call) => {
          try {
            assert.deepStrictEqual(call, args);
            return true;
          } catch {
            return false;
          }
        }),
      ),
  };
}
const originals = new Map();
export const vi = {
  stubGlobal(key, value) {
    if (!originals.has(key))
      originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      writable: true,
      configurable: true,
    });
  },
  unstubAllGlobals() {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
    originals.clear();
  },
  fn() {
    const calls = [];
    const fn = (...args) => {
      calls.push(args);
    };
    fn.mock = { calls };
    return fn;
  },
};
