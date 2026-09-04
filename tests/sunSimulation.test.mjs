import assert from "node:assert/strict";
import {
  PUNE_COORDINATES,
  SEASONAL_DAYS,
  calculateSolarPosition,
  calculateSolarDeclination,
  generate2DYearlySunPathData,
  calculateObstacleShadow,
  checkPanelShadowOverlap,
  calculateArrayShadingLoss,
  calculateDailyHourlyProfile,
} from "../src/sunSimulation.js";

console.log("Running Astronomical Sun Simulation tests...");

// Test 1: Solar Declination across seasons
{
  const declSummer = calculateSolarDeclination(SEASONAL_DAYS.SUMMER_SOLSTICE);
  const declWinter = calculateSolarDeclination(SEASONAL_DAYS.WINTER_SOLSTICE);
  const declEquinox = calculateSolarDeclination(SEASONAL_DAYS.SPRING_EQUINOX);

  assert.ok(Math.abs(declSummer - 23.45) < 0.5, `Summer declination should be ~+23.45°, got ${declSummer}`);
  assert.ok(Math.abs(declWinter - -23.45) < 0.5, `Winter declination should be ~-23.45°, got ${declWinter}`);
  assert.ok(Math.abs(declEquinox) < 1.0, `Equinox declination should be ~0°, got ${declEquinox}`);
  console.log("✓ Test 1 Passed: Solar declination seasonal bounds");
}

// Test 2: Solar Altitude and Azimuth for Pune (18.52° N, 73.86° E)
{
  // Solar noon on Summer Solstice (Jun 21) in Pune:
  // Sun reaches near zenith (latitude 18.5° N, declination ~23.4° N -> Sun is at ~85°-90° elevation!)
  const noonSummer = calculateSolarPosition(SEASONAL_DAYS.SUMMER_SOLSTICE, 12.5); // ~solar noon
  assert.ok(noonSummer.altitudeDeg > 80, `Summer solar noon altitude in Pune should be > 80°, got ${noonSummer.altitudeDeg}`);

  // Solar noon on Winter Solstice (Dec 21) in Pune:
  // Altitude = 90° - (Lat - Decl) = 90° - (18.5° - (-23.4°)) ≈ 48°
  const noonWinter = calculateSolarPosition(SEASONAL_DAYS.WINTER_SOLSTICE, 12.5);
  assert.ok(
    Math.abs(noonWinter.altitudeDeg - 48) < 3.0,
    `Winter solar noon altitude in Pune should be ~48°, got ${noonWinter.altitudeDeg}`
  );

  // Azimuth path: Morning (East, ~70°-110°), Noon (South, ~170°-190° or North in mid-summer), Afternoon (West, ~250°-290°)
  const morningWinter = calculateSolarPosition(SEASONAL_DAYS.WINTER_SOLSTICE, 8.5);
  const eveningWinter = calculateSolarPosition(SEASONAL_DAYS.WINTER_SOLSTICE, 16.5);
  assert.ok(morningWinter.azimuthDeg > 90 && morningWinter.azimuthDeg < 160, `Morning winter azimuth should be SE, got ${morningWinter.azimuthDeg}`);
  assert.ok(eveningWinter.azimuthDeg > 200 && eveningWinter.azimuthDeg < 270, `Evening winter azimuth should be SW, got ${eveningWinter.azimuthDeg}`);

  console.log("✓ Test 2 Passed: Solar altitude and azimuth physics for Pune region");
}

// Test 3: 2D Yearly & Daily Sun Path Data Generation
{
  const yearlyData = generate2DYearlySunPathData(PUNE_COORDINATES.latitude, PUNE_COORDINATES.longitude);
  assert.ok(yearlyData.seasonalArcs.length >= 3, "Must have seasonal curves for Solstices and Equinox");
  assert.ok(yearlyData.hourlyGrid.length >= 8, "Must have hourly analemma/time grid lines from morning to evening");

  // Summer arc should have higher maximum altitude than Winter arc
  const summerArc = yearlyData.seasonalArcs.find(a => a.day === SEASONAL_DAYS.SUMMER_SOLSTICE);
  const winterArc = yearlyData.seasonalArcs.find(a => a.day === SEASONAL_DAYS.WINTER_SOLSTICE);
  const maxSummerAlt = Math.max(...summerArc.points.map(p => p.altitude));
  const maxWinterAlt = Math.max(...winterArc.points.map(p => p.altitude));
  assert.ok(maxSummerAlt > maxWinterAlt + 30, `Summer max alt (${maxSummerAlt}°) must be >30° higher than Winter max alt (${maxWinterAlt}°)`);

  console.log("✓ Test 3 Passed: 2D yearly and daily sun path curves generated correctly");
}

// Test 4: Extruded Shadow Geometry from External Obstacles
{
  const obstacle = {
    id: "tree_1",
    type: "tree",
    shape: "circle",
    label: "Tall Tree",
    lengthFt: 15,
    breadthFt: 15,
    diameterFt: 15,
    heightFt: 30,
    distanceFromRoofX: -25, // 25 ft West of roof
    distanceFromRoofY: 10,
  };

  // Morning sun from East (azimuth ~120°, altitude 30°)
  // Shadow must cast towards West/NW (dx < 0)
  const solarPos = {
    altitudeDeg: 30,
    azimuthDeg: 120,
    isDaylight: true,
  };

  const shadow = calculateObstacleShadow(obstacle, 100, 100, 10, solarPos, 0); // 0° North
  assert.ok(shadow, "Shadow polygon should be generated");
  // L = 30 / tan(30°) = 30 / 0.577 ≈ 51.9 ft
  assert.ok(Math.abs(shadow.shadowLengthFt - 52) < 2, `Shadow length should be ~52 ft, got ${shadow.shadowLengthFt}`);
  assert.ok(shadow.dx < 0, `Morning shadow from East must cast Westward (dx < 0), got dx=${shadow.dx}`);
  assert.ok(shadow.polygon.length >= 4, "Shadow polygon must have >= 4 vertices");

  console.log("✓ Test 4 Passed: 3D extruded shadow geometry and directional projection");
}

// Test 5: Panel Intersection and Shading Loss Calculation
{
  const panels = [
    { id: "p1", x: 100, y: 100, w: 20, h: 40 },
    { id: "p2", x: 130, y: 100, w: 20, h: 40 },
    { id: "p3", x: 250, y: 100, w: 20, h: 40 }, // far away, unshaded
  ];

  const obstacles = [
    {
      id: "pole_1",
      type: "building",
      shape: "rectangle",
      label: "Neighbor House",
      lengthFt: 20,
      breadthFt: 10,
      heightFt: 40,
      distanceFromRoofX: -10, // directly beside panels
      distanceFromRoofY: 0,
    },
  ];

  const solarPos = {
    altitudeDeg: 25,
    azimuthDeg: 90, // direct East -> shadow casts direct West over panels at roofX=100
    isDaylight: true,
  };

  const stats = calculateArrayShadingLoss(panels, obstacles, 100, 100, 10, solarPos, 0);
  assert.ok(stats.shadedCount >= 1, "At least 1 panel must be shaded by adjacent tall building");
  assert.ok(stats.lossPercentage > 0, "Loss percentage should be > 0%");
  assert.ok(!stats.shadedPanelIds.has("p3"), "Far panel p3 should not be shaded");

  console.log("✓ Test 5 Passed: Solar panel shadow overlap and array shading loss percentage");
}

console.log("All Astronomical Sun Simulation tests passed successfully!");
