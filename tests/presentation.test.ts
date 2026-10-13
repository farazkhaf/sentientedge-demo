import test from "node:test";
import assert from "node:assert/strict";
import { neighborhoodPreview } from "../lib/intelligence/presentation";

const city = { mode: "profile" as const, panelOpen: true, selectedArea: null, inspectingPlace: false, comparison: false };

test("hover previews follow the inspection surface and active map mode", () => {
  assert.equal(neighborhoodPreview(city, "brickell"), "full");
  const neighborhood = { ...city, selectedArea: "brickell" };
  assert.equal(neighborhoodPreview(neighborhood, "brickell"), "hidden");
  assert.equal(neighborhoodPreview(neighborhood, "allapattah"), "compact");
  for (const area of ["brickell", "allapattah"]) {
    assert.equal(neighborhoodPreview({ ...neighborhood, mode: "places", inspectingPlace: true }, area), "hidden");
    assert.equal(neighborhoodPreview({ ...neighborhood, mode: "permits" }, area), "hidden");
  }
  assert.equal(neighborhoodPreview({ ...city, mode: "permits" }, "brickell"), "compact");
  assert.equal(neighborhoodPreview({ ...neighborhood, panelOpen: false }, "brickell"), "full");
  assert.equal(neighborhoodPreview({ ...neighborhood, mode: "places", inspectingPlace: true, panelOpen: false }, "brickell"), "hidden");
  assert.equal(neighborhoodPreview({ ...city, mode: "places" }, "allapattah"), "hidden");
  assert.equal(neighborhoodPreview({ ...city, mode: "places", comparison: true }, "brickell"), "hidden");
  assert.equal(neighborhoodPreview({ ...neighborhood, mode: "permits", comparison: true }, "brickell"), "compact");
});
