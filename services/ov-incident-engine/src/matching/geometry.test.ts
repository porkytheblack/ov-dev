import { describe, expect, it } from "vitest";
import { centroid, matchesRoi, isWithinDetectionWindow, normalizePolygon } from "./geometry.js";

describe("normalizePolygon", () => {
  it("handles array-of-arrays", () => {
    expect(normalizePolygon([[0, 0], [1, 0], [1, 1], [0, 1]])).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 },
    ]);
  });
  it("handles array-of-objects", () => {
    expect(normalizePolygon([{ x: 0, y: 0 }, { x: 1, y: 1 }])).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 1 },
    ]);
  });
});

describe("centroid + matchesRoi", () => {
  const square = [
    { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 },
  ];
  it("centroid mode matches a bbox inside the polygon", () => {
    expect(matchesRoi({ x: 0.4, y: 0.4, w: 0.1, h: 0.1 }, square, "centroid")).toBe(true);
  });
  it("centroid mode rejects a bbox outside", () => {
    expect(matchesRoi({ x: 0.0, y: 0.0, w: 0.05, h: 0.05 }, square, "centroid")).toBe(false);
  });
  it("iou mode matches an overlapping bbox", () => {
    expect(matchesRoi({ x: 0.3, y: 0.3, w: 0.4, h: 0.4 }, square, "iou")).toBe(true);
  });
});

describe("isWithinDetectionWindow", () => {
  it("always windows pass", () => {
    expect(isWithinDetectionWindow({ type: "always" }, new Date())).toBe(true);
  });
  it("returns true when no window provided", () => {
    expect(isWithinDetectionWindow(undefined, new Date())).toBe(true);
  });
});
