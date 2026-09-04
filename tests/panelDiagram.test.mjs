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
  quadraticCurveTo() {}
  bezierCurveTo() {}
  createLinearGradient() {
    return { addColorStop: () => {} };
  }
  createRadialGradient() {
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

// Test 5: Layer Stack Reordering & Universal Layer Opacity
{
  const canvas = new MockCanvas();
  const cad = new RooftopCAD(canvas, {
    roofLengthFt: 30,
    roofBreadthFt: 20,
    requiredPanels: 6,
  });

  // Default layer order: ["image", "roof", "pathways", "cutouts", "panels"]
  assert.deepEqual(cad.layerOrder, ["image", "roof", "pathways", "cutouts", "panels"]);

  // Move "roof" down (swap with "image")
  cad.moveLayerDown("roof");
  assert.deepEqual(cad.layerOrder, ["roof", "image", "pathways", "cutouts", "panels"]);

  // Move "cutouts" up (swap with "panels") -> cutouts draw on top of panels
  cad.moveLayerUp("cutouts");
  assert.deepEqual(cad.layerOrder, ["roof", "image", "pathways", "panels", "cutouts"]);

  // Layer Opacity adjustments
  cad.setLayerOpacity("panels", 0.75);
  assert.equal(cad.layerOpacity.panels, 0.75);

  cad.setLayerOpacity("cutouts", 0.5);
  assert.equal(cad.layerOpacity.cutouts, 0.5);

  cad.setLayerOpacity("roof", 0.6);
  assert.equal(cad.layerOpacity.roof, 0.6);
  assert.equal(cad.roofOpacity, 0.6);

  // Layer Visibility
  cad.setLayerVisibility("image", false);
  assert.equal(cad.layerVisible.image, false);

  const layerState = cad.getLayerState();
  assert.deepEqual(layerState.order, ["roof", "image", "pathways", "panels", "cutouts"]);
  assert.equal(layerState.opacity.panels, 0.75);
  assert.equal(layerState.visible.image, false);

  console.log("✓ Test 5 Passed: Layer stack reordering (move up/down) & universal layer opacity");
}

// Test 6: Component Selection, Z-Ordering & Universal Solar Panel Opacity
{
  const canvas = new MockCanvas();
  const cad = new RooftopCAD(canvas, {
    roofLengthFt: 30,
    roofBreadthFt: 20,
    requiredPanels: 6,
  });

  // Place 3 panels
  const p1 = cad.placePanel("portrait");
  const p2 = cad.placePanel("portrait");
  const p3 = cad.placePanel("portrait");

  assert.equal(cad.panels.length, 3);
  assert.equal(cad.panels[0].id, p1.id);
  assert.equal(cad.panels[1].id, p2.id);
  assert.equal(cad.panels[2].id, p3.id);

  // Panels should have default opacity 1.0
  assert.equal(p1.opacity, 1.0);
  assert.equal(p2.opacity, 1.0);

  // Select panel 1 and adjust opacity to 0.4 (transparent)
  cad.selectItem("panel", p1);
  assert.equal(cad.selectedItem.item.id, p1.id);
  cad.updateSelectedItem({ opacity: 0.4 });
  assert.equal(p1.opacity, 0.4, "Panel 1 opacity should be adjusted to 0.4");

  // Reorder components: move p1 up in stack
  cad.moveSelectedItemUp();
  assert.equal(cad.panels[0].id, p2.id, "p2 should now be at index 0");
  assert.equal(cad.panels[1].id, p1.id, "p1 should now be at index 1");

  // Bring p1 to front
  cad.bringSelectedItemToFront();
  assert.equal(cad.panels[cad.panels.length - 1].id, p1.id, "p1 should now be at the front");

  // Send p1 to back
  cad.sendSelectedItemToBack();
  assert.equal(cad.panels[0].id, p1.id, "p1 should now be at the back");

  // Test selecting component by ID
  cad.selectComponent("panel", p3.id);
  assert.equal(cad.selectedItem.item.id, p3.id);

  // Test setting component opacity directly
  cad.setComponentOpacity("panel", p3.id, 0.55);
  assert.equal(p3.opacity, 0.55);

  // Test removing component by ID
  cad.removeComponent("panel", p2.id);
  assert.equal(cad.panels.length, 2);
  assert.equal(cad.panels.find((p) => p.id === p2.id), undefined);

  // Test cutouts z-ordering and opacity
  const c1 = cad.addCutout(cad.roofX + 10, cad.roofY + 10, 30, 30, "rectangle", "HVAC 1");
  const c2 = cad.addCutout(cad.roofX + 50, cad.roofY + 50, 40, 40, "circle", "Tank 1");
  assert.equal(cad.cutouts.length, 2);

  cad.selectComponent("cutout", c1.id);
  cad.updateSelectedItem({ opacity: 0.35 });
  assert.equal(c1.opacity, 0.35, "Cutout 1 opacity should be adjusted to 0.35");

  cad.moveComponent("cutout", c1.id, "up");
  assert.equal(cad.cutouts[1].id, c1.id, "Cutout 1 moved up");

  console.log("✓ Test 6 Passed: Component selection, z-ordering (move up/down/front/back) & universal component opacity (including solar panels)");
}

// Test 7: North Alignment, Multi-View Elevation, External Obstacles & Astronomical Sun Simulation
{
  const canvas = new MockCanvas();
  const cad = new RooftopCAD(canvas, {
    roofLengthFt: 35,
    roofBreadthFt: 25,
    requiredPanels: 12,
  });

  // 1. North Alignment & Rotation Wrapping
  assert.equal(cad.northAngleDeg, 0, "Default North orientation must be 0°");
  cad.setNorthAngle(60);
  assert.equal(cad.northAngleDeg, 60, "North angle should be 60°");
  cad.rotateNorth(-90);
  assert.equal(cad.northAngleDeg, 330, "North angle after -90° rotation should wrap to 330°");
  cad.setNorthAngle(0);

  // 2. Multi-View Elevation Switching
  assert.equal(cad.activeView, "top", "Default active view must be 'top'");
  let reportedView = null;
  cad.onViewChange = (v) => { reportedView = v; };

  cad.setActiveView("front");
  assert.equal(cad.activeView, "front");
  assert.equal(reportedView, "front");

  cad.setActiveView("side");
  assert.equal(cad.activeView, "side");
  assert.equal(reportedView, "side");

  cad.setActiveView("top");
  assert.equal(cad.activeView, "top");

  cad.setBuildingHeight(24);
  assert.equal(cad.buildingHeightFt, 24, "Building height should be updated to 24 ft");

  // 3. External Obstacles CRUD
  assert.equal(cad.externalObstacles.length, 0, "Initial external obstacles must be 0");

  const tree = cad.addExternalObstacle("tree", { label: "Neem Tree", heightFt: 25 });
  assert.equal(cad.externalObstacles.length, 1);
  assert.equal(tree.type, "tree");
  assert.equal(tree.heightFt, 25);
  assert.equal(tree.shape, "circle");

  const bldg = cad.addExternalObstacle("building", { label: "Neighbor House", heightFt: 32 });
  assert.equal(cad.externalObstacles.length, 2);
  assert.equal(bldg.type, "building");
  assert.equal(bldg.heightFt, 32);

  const pole = cad.addExternalObstacle("pole", { label: "Electric Pole", heightFt: 28 });
  const wall = cad.addExternalObstacle("wall", { label: "Boundary Wall", heightFt: 8 });
  assert.equal(cad.externalObstacles.length, 4);

  // Update obstacle properties
  cad.updateExternalObstacle(tree.id, { heightFt: 30, diameterFt: 14 });
  assert.equal(tree.heightFt, 30);
  assert.equal(tree.diameterFt, 14);

  // 4. Astronomical Sun Simulation & Shadow Engine
  assert.equal(cad.sunSim.enabled, false, "Sun simulation disabled initially");
  cad.toggleSunSimulation(true);
  assert.equal(cad.sunSim.enabled, true, "Sun simulation enabled");

  // Winter Solstice at 10:30 AM
  cad.setSunDate(355);
  cad.setSunTime(10.5);
  assert.equal(cad.sunSim.dayOfYear, 355);
  assert.equal(cad.sunSim.timeHour, 10.5);

  const solarPos = cad.getSolarPosition();
  assert.ok(solarPos.isDaylight, "Should be daylight at 10:30 AM in Pune");
  assert.ok(solarPos.altitudeDeg > 35 && solarPos.altitudeDeg < 55, "Solar altitude should be between 35° and 55°");

  // Place a panel on the roof
  const p1 = cad.placePanel("portrait", cad.roofX + 10, cad.roofY + 10);
  assert.ok(p1, "Panel should be placed");

  // Compute shadow loss stats
  const lossStats = cad.getShadingLossStats();
  assert.ok(lossStats.shadowPolygons.length > 0, "External obstacles should cast shadow polygons");
  assert.equal(lossStats.totalPanels, 1, "Total panels evaluated should be 1");

  // Remove obstacle
  cad.removeExternalObstacle(pole.id);
  assert.equal(cad.externalObstacles.length, 3, "External obstacles count should be 3 after removal");

  console.log("✓ Test 7 Passed: North Alignment, Multi-View Elevation, External Obstacles & Astronomical Sun Simulation");
}

console.log("All RooftopCAD tests passed successfully!");
