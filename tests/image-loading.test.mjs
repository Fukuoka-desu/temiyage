import { it } from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createImageGate, imageGateIsOpen, imageRetryDelay, priorityImageCount, snapshotImageFailures } from "../.test-build/imageLoading.js";
import { ItemImage } from "../.test-build/ItemImage.js";
import { ItemImage as ImageSource } from "../.test-build/ImageEvent.js";

it("初回幅700px未満は2枚、700px以上は6枚を優先する", () => {
  for (const width of [320, 699]) assert.equal(priorityImageCount(width), 2);
  for (const width of [700, 1280]) assert.equal(priorityImageCount(width), 6);
});
it("画像失敗だけでは並び替え用の集合を変えず、条件変更時に反映する", () => {
  const conditions = { q: "" };
  const previous = { conditions, failedImages: new Set() };
  const failures = new Set([12]);
  assert.equal(snapshotImageFailures(previous, conditions, failures), previous);
  const changed = snapshotImageFailures(previous, { q: "菓子" }, failures);
  assert.equal(changed.failedImages, failures);
  assert.equal(snapshotImageFailures(changed, changed.conditions, new Set([12, 34])), changed);
});
const item = { id: 1, n: "菓子", g: "和菓子", img: "https://example.com/a.jpg" };
it("優先画像はeager/high、通常画像はlazyで優先度属性なし", () => {
  const high = renderToStaticMarkup(createElement(ItemImage, { item, priority: true }));
  const lazy = renderToStaticMarkup(createElement(ItemImage, { item }));
  assert.ok(high.includes('loading="eager"'));
  assert.ok(high.includes('fetchpriority="high"'));
  assert.ok(lazy.includes('loading="lazy"'));
  assert.ok(!lazy.includes("fetchpriority"));
  assert.ok(lazy.includes("is-loading"));
});
it("ゲートは全優先画像の完了・2500ms・スクロールで開く", () => {
  assert.equal(imageGateIsOpen(new Set(), 0, false), true);
  assert.equal(imageGateIsOpen(new Set([1]), 2499, false), false);
  assert.equal(imageGateIsOpen(new Set([1]), 2500, false), true);
  assert.equal(imageGateIsOpen(new Set([1]), 0, true), true);
  const gate = createImageGate([1, 2]);
  let notifications = 0;
  const stop = gate.subscribe(() => notifications++);
  gate.settle(1);
  gate.settle(1);
  gate.settle(999);
  assert.equal(gate.getSnapshot(), false);
  gate.settle(2);
  gate.release();
  assert.equal(gate.getSnapshot(), true);
  assert.equal(notifications, 1);
  stop();
  const released = createImageGate([1]);
  const unsubscribe = released.subscribe(() => notifications++);
  unsubscribe();
  released.release();
  assert.equal(notifications, 1);
  assert.equal(released.getSnapshot(), true);
  assert.equal(createImageGate([]).getSnapshot(), true);
});
it("再試行は1200ms、3000msの2回だけ", () => {
  assert.deepEqual([0, 1, 2, 3].map(imageRetryDelay), [1200, 3000, null, null]);
});
it("閉じたゲートはsrcを付けず、priorityは直ちに読む", () => {
  const gate = createImageGate([1]);
  const lazy = renderToStaticMarkup(createElement(ItemImage, { item, gate }));
  assert.ok(!lazy.includes('src='));
  assert.ok(lazy.includes('is-loading'));
  const high = renderToStaticMarkup(createElement(ItemImage, { item, gate, priority: true }));
  assert.ok(high.includes(`src="${item.img}"`));
});
it("再試行中はスケルトンと同じURLを維持し、最終失敗だけ通知する", () => {
  const original = globalThis.setTimeout;
  let scheduled;
  const delays = [];
  globalThis.setTimeout = (callback, delay) => { scheduled = callback; delays.push(delay); return 1; };
  let states = [], refs = [], cursor, refCursor, failure;
  const gate = createImageGate([1]);
  globalThis.__imageState = initial => {
    const index = cursor++;
    if (!(index in states)) states[index] = initial;
    return [states[index], value => { states[index] = value; }];
  };
  globalThis.__imageRef = initial => refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial });
  const render = () => {
    cursor = refCursor = 0;
    return ImageSource({ item, priority: true, gate, onFailure: id => { failure = id; } });
  };
  try {
    for (let attempt = 0; attempt < 2; attempt++) {
      const view = render();
      const img = view.props.children[0];
      assert.equal(img.key, String(attempt));
      assert.equal(img.props.src, item.img);
      img.props.onError();
      assert.equal(failure, undefined);
      assert.equal(gate.getSnapshot(), false);
      assert.ok(render().props.className.includes("is-loading"));
      scheduled();
    }
    assert.deepEqual(delays, [1200, 3000]);
    render().props.children[0].props.onError();
    assert.equal(failure, 1);
    assert.equal(gate.getSnapshot(), true);
    assert.equal(render().props.className, "photo-placeholder");
    states = []; refs = [];
    render().props.children[0].props.onLoad();
    assert.ok(render().props.className.includes("is-loaded"));
    states = []; refs = [];
    globalThis.__imageRef = initial => ({ current: initial === null ? { complete: true, naturalWidth: 640 } : initial });
    render();
    assert.ok(render().props.className.includes("is-loaded"));
  } finally {
    globalThis.setTimeout = original;
    delete globalThis.__imageState;
    delete globalThis.__imageRef;
  }
});

it("ゲートのタイマー・スクロール購読を解除できる", () => {
  const previous = globalThis.window;
  let timeout, scroll, cleared, removed;
  globalThis.window = {
    setTimeout: (callback, delay) => { timeout = callback; assert.equal(delay, 2500); return 7; },
    clearTimeout: id => { cleared = id; },
    addEventListener: (name, callback) => { assert.equal(name, "scroll"); scroll = callback; },
    removeEventListener: (name, callback) => { removed = callback; },
  };
  try {
    const gate = createImageGate([1]);
    const cleanup = gate.start();
    scroll();
    assert.equal(gate.getSnapshot(), true);
    cleanup();
    assert.equal(cleared, 7);
    assert.equal(removed, scroll);
    const timed = createImageGate([2]);
    timed.start();
    timeout();
    assert.equal(timed.getSnapshot(), true);
  } finally { globalThis.window = previous; }
});
it("アンマウントで再試行タイマーを解除する", () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let cleared;
  globalThis.setTimeout = () => 42;
  globalThis.clearTimeout = id => { cleared = id; };
  globalThis.__imageCleanups = [];
  globalThis.__imageState = initial => [initial, () => {}];
  try {
    ImageSource({ item }).props.children[0].props.onError();
    globalThis.__imageCleanups.forEach(cleanup => cleanup());
    assert.equal(cleared, 42);
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
    delete globalThis.__imageCleanups;
    delete globalThis.__imageState;
  }
});

it("再試行待ちの途中で成功したらタイマーを解除してゲートを開く", () => {
  const originalSet = globalThis.setTimeout, originalClear = globalThis.clearTimeout;
  let cleared;
  globalThis.setTimeout = () => 43;
  globalThis.clearTimeout = id => { cleared = id; };
  globalThis.__imageState = initial => [initial, () => {}];
  const refs = [];
  let cursor = 0;
  globalThis.__imageRef = initial => refs[cursor++] ?? (refs[cursor - 1] = { current: initial });
  try {
    const gate = createImageGate([1]);
    const image = ImageSource({ item, priority: true, gate }).props.children[0];
    image.props.onError();
    image.props.onLoad();
    assert.equal(cleared, 43);
    assert.equal(gate.getSnapshot(), true);
  } finally {
    globalThis.setTimeout = originalSet;
    globalThis.clearTimeout = originalClear;
    delete globalThis.__imageState;
    delete globalThis.__imageRef;
  }
});
