import assert from "node:assert/strict";

// Mock minimal Canvas and Window for headless node testing
class MockContext2D {
  save() {}
  restore() {}
  scale() {}
  translate() {}
  rotate() {}
  clearRect() {}
  fillRect() {}
  strokeRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  fill() {}
  stroke() {}
  clip() {}
  rect() {}
  setLineDash() {}
  fillText() {}
  createLinearGradient() {
    return { addColorStop: () => {} };
  }
}

class MockCanvas {
  constructor() {
    this.width = 800;
    this.height = 460;
    this.style = { width: "800px", height: "460px", cursor: "default" };
    this.parentElement = { clientWidth: 800, clientHeight: 460, getBoundingClientRect: () => ({ width: 800, height: 460 }) };
    this.listeners = {};
  }
  getContext(type) {
    return new MockContext2D();
  }
  addEventListener(event, fn) {
    this.listeners[event] = fn;
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 460 };
  }
}

globalThis.window = {
  devicePixelRatio: 1,
  addEventListener: () => {},
};

globalThis.document = {
  activeElement: { tagName: "BODY" },
};

const { RooftopCAD } = await import("../src/panelDiagram.js");

console.log("Running RooftopCAD tests...");

// Test 1: All panels are LATENT initially
{
  const canvas = new MockCanvas();
  const cad = new RooftopCAD(canvas, {
    roofLengthFt: 30,
    roofBreadthFt: 20,
    requiredPanels: 12,
  });

  assert.equal(cad.panels.length, 0, "Panels must be 0 initially (latent pool)");
  assert.equal(cad.requiredPanels, 12, "Required panels should be 12");
  const stats = cad.getAreaStats();
  assert.equal(stats.grossSqft, 600, "Gross area should be 30x20=600 sq ft");
  assert.equal(stats.cutoutSqft, 0, "Initial cutout area should be 0");
  assert.equal(stats.netUsableSqft, 600, "Initial net usable area should equal gross area");
  console.log("✓ Test 1 Passed: Initial latent panels pool & base area stats");
}

// Test 2: Multi-Shape Cutouts (Rectangle, Circle, L-Shape) & Area Deductions
{
  const canvas = new MockCanvas();
  const cad = new RooftopCAD(canvas, {
    roofLengthFt: 40,
    roofBreadthFt: 25,
    requiredPanels: 16,
  });

  // Gross: 40 x 25 = 1000 sq ft
  assert.equal(cad.getAreaStats().grossSqft, 1000);

  // Add rectangular cutout: 10 ft x 5 ft = 50 sq ft
  const rectW = 10 * cad.scalePxPerFt;
  const rectH = 5 * cad.scalePxPerFt;
  cad.addCutout(cad.roofX + 20, cad.roofY + 20, rectW, rectH, "rectangle", "HVAC Unit");

  // Add circular cutout: diameter 6 ft -> r = 3 ft -> area = pi * 3^2 ~= 28.27 sq ft
  const circleDia = 6 * cad.scalePxPerFt;
  cad.addCutout(cad.roofX + 200, cad.roofY + 100, circleDia, circleDia, "circle", "Water Tank");

  // Add L-shape cutout: 10 ft x 8 ft -> area = 10 * 8 * 0.75 = 60 sq ft
  const lW = 10 * cad.scalePxPerFt;
  const lH = 8 * cad.scalePxPerFt;
  cad.addCutout(cad.roofX + 100, cad.roofY + 180, lW, lH, "l_shape", "L-Chimney");

  // Add Walkway: 40 ft x 2.5 ft = 100 sq ft
  const walkW = 40 * cad.scalePxPerFt;
  const walkH = 2.5 * cad.scalePxPerFt;
  cad.addPathway(cad.roofX, cad.roofY + 150, walkW, walkH, "Central Walkway");

  const stats = cad.getAreaStats();
  const expectedCutouts = Math.round(50 + Math.PI * 3 * 3 + 60); // 50 + 28.27 + 60 = 138.27 => 138
  const expectedPathway = Math.round(40 * 2.5); // 100
  const expectedNet = Math.round(1000 - expectedCutouts - expectedPathway); // 1000 - 138 - 100 = 762

  assert.equal(stats.cutoutSqft, expectedCutouts, `Expected cutouts around ${expectedCutouts}`);
  assert.equal(stats.pathwaySqft, expectedPathway, `Expected pathway ${expectedPathway}`);
  assert.equal(stats.netUsableSqft, expectedNet, `Expected net usable area ${expectedNet}`);
  console.log("✓ Test 2 Passed: Multi-shape cutouts (Rect, Circle, L-Shape, Walkway) & Area deductions");
}

// Test 3: Collision-Free Auto-Placement
{
  const canvas = new MockCanvas();
  const cad = new RooftopCAD(canvas, {
    roofLengthFt: 30,
    roofBreadthFt: 20,
    requiredPanels: 10,
  });

  // Add a large central obstacle
  const obsW = 12 * cad.scalePxPerFt;
  const obsH = 8 * cad.scalePxPerFt;
  cad.addCutout(cad.roofX + 50, cad.roofY + 50, obsW, obsH, "rectangle", "Skylight");

  // Place 1 panel manually
  const manualPanel = cad.placePanel("portrait");
  assert.ok(manualPanel, "Manual panel placed");
  assert.equal(cad.panels.length, 1);

  // Auto-place remaining panels
  cad.autoPlaceRemainingPanels("portrait");
  assert.ok(cad.panels.length <= 10, "Panels placed should not exceed required 10");

  // Check that NO TWO PANELS OVERLAP
  for (let i = 0; i < cad.panels.length; i++) {
    for (let j = i + 1; j < cad.panels.length; j++) {
      const p1 = cad.panels[i];
      const p2 = cad.panels[j];
      const overlap = cad.doRectanglesOverlap(p1.x, p1.y, p1.w, p1.h, p2.x, p2.y, p2.w, p2.h);
      assert.equal(overlap, false, `Panels ${p1.id} and ${p2.id} must not overlap!`);
    }
  }

  // Check that NO PANEL OVERLAPS THE CUTOUT
  const cutout = cad.cutouts[0];
  for (const p of cad.panels) {
    const collides = cad.doRectanglesOverlap(p.x, p.y, p.w, p.h, cutout.x, cutout.y, cutout.w, cutout.h);
    assert.equal(collides, false, `Panel ${p.id} must not overlap cutout!`);
  }

  // Check that ALL PANELS ARE INSIDE ROOF BOUNDARIES
  for (const p of cad.panels) {
    assert.ok(p.x >= cad.roofX - 1 && p.x + p.w <= cad.roofX + cad.roofW + 1, "Panel must be within horizontal roof bounds");
    assert.ok(p.y >= cad.roofY - 1 && p.y + p.h <= cad.roofY + cad.roofH + 1, "Panel must be within vertical roof bounds");
  }

  console.log("✓ Test 3 Passed: Strict collision-free auto-placement (zero panel overlap & zero obstacle overlap)");
}

// Test 4: Dynamic Inspector Updates & Resizing
{
  const canvas = new MockCanvas();
  const cad = new RooftopCAD(canvas, {
    roofLengthFt: 30,
    roofBreadthFt: 20,
    requiredPanels: 8,
  });

  // Add circle cutout
  const c = cad.addCutout(cad.roofX + 30, cad.roofY + 30, 40, 40, "circle", "Tank 1");
  assert.equal(cad.selectedItem.type, "cutout");

  // Update diameter via updateSelectedItem
  cad.updateSelectedItem({ diameterFt: 8, label: "Main Water Tank" });
  assert.equal(c.diameterFt, 8);
  assert.equal(c.label, "Main Water Tank");
  assert.equal(c.w, 8 * cad.scalePxPerFt);
  assert.equal(c.h, 8 * cad.scalePxPerFt);

  // Remove selected item
  cad.removeSelectedItem();
  assert.equal(cad.cutouts.length, 0, "Cutout should be removed");
  assert.equal(cad.selectedItem, null, "Selection should be cleared");

  console.log("✓ Test 4 Passed: Contextual inspector two-way updates & removal");
}

console.log("All RooftopCAD tests passed successfully!");
