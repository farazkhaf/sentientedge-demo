import test from "node:test";
import assert from "node:assert/strict";
import {
  detailHeights,
  nearestDetailAnchor,
} from "../lib/intelligence/mobile-layout";

test("sheet anchors retain usable map space from short landscape to tall phones", () => {
  for (const height of [240, 310, 520, 680, 780, 1024]) {
    for (const peekHeight of [60, 76]) {
      const anchors = detailHeights(height, peekHeight);
      assert.ok(
        anchors.map < anchors.balanced && anchors.balanced < anchors.reading,
      );
      assert.ok(
        height - anchors.reading >= Math.min(128, height * 0.27) - 0.001,
      );
      assert.equal(anchors.map, peekHeight);
      const midpoint = (anchors.map + anchors.balanced) / 2;
      assert.equal(
        nearestDetailAnchor(height, midpoint - 1, peekHeight),
        "map",
      );
      assert.equal(
        nearestDetailAnchor(height, midpoint + 1, peekHeight),
        "balanced",
      );
    }
  }
});

test("drag release settles at the nearest anchor and clamps overshoot", () => {
  const anchors = detailHeights(700);
  assert.equal(nearestDetailAnchor(700, -100), "map");
  assert.equal(nearestDetailAnchor(700, anchors.balanced + 25), "balanced");
  assert.equal(nearestDetailAnchor(700, anchors.reading - 10), "reading");
  assert.equal(nearestDetailAnchor(700, 1000), "reading");
});
