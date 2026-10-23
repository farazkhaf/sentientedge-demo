import test from "node:test";
import assert from "node:assert/strict";
import {
  detailHeights,
  nearestDetailAnchor,
} from "../lib/intelligence/mobile-layout";

test("sheet anchors retain usable map space from short landscape to tall phones", () => {
  for (const height of [240, 310, 520, 680, 780, 1024]) {
    const anchors = detailHeights(height);
    assert.ok(
      anchors.map < anchors.balanced && anchors.balanced < anchors.reading,
    );
    assert.ok(height - anchors.reading >= Math.min(128, height * 0.27) - 0.001);
    assert.ok(anchors.map >= 60);
  }
});

test("drag release settles at the nearest anchor and clamps overshoot", () => {
  const anchors = detailHeights(700);
  assert.equal(nearestDetailAnchor(700, -100), "map");
  assert.equal(nearestDetailAnchor(700, anchors.balanced + 25), "balanced");
  assert.equal(nearestDetailAnchor(700, anchors.reading - 10), "reading");
  assert.equal(nearestDetailAnchor(700, 1000), "reading");
});
