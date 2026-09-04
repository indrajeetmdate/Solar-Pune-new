// ================================================================
// DC Energy — Astronomical Sun Path Simulation & Shadow Analysis
// Includes:
// 1. High-Precision Solar Position (Declination, EoT, Altitude, Azimuth)
// 2. 2D Sun Path Curves across the Calendar Year (Summer/Winter Solstices, Equinoxes, Hourly analemma/grid)
// 3. 3D Extruded Shadow Geometry from External Obstacles (Trees, Poles, Buildings)
// 4. Panel Intersection Testing & Array Shading Loss Analytics
// ================================================================

// Default Coordinates: Pune, Maharashtra, India
export const PUNE_COORDINATES = {
  latitude: 18.5204, // degrees North
  longitude: 73.8567, // degrees East
  timezoneOffsetHours: 5.5, // IST UTC+05:30
};

// Standard Seasonal Day-of-Year Constants
export const SEASONAL_DAYS = {
  SUMMER_SOLSTICE: 172, // June 21 (~ +23.44° declination, highest sun path)
  SPRING_EQUINOX: 80,   // March 21 (~ 0° declination)
  AUTUMN_EQUINOX: 266,  // September 23 (~ 0° declination)
  WINTER_SOLSTICE: 355, // December 21 (~ -23.44° declination, lowest sun path, longest shadows)
};

const DEG_TO_RAD = Math.PI / 180;
const RAD_TO_DEG = 180 / Math.PI;

/**
 * Calculate Day of Year (1 - 366) from a Date object or Month/Day
 */
export function getDayOfYear(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start + (start.getTimezoneOffset() - d.getTimezoneOffset()) * 60 * 1000;
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.floor(diff / oneDay);
}

/**
 * Calculate solar declination (delta) in degrees for a given day of the year (n: 1-365)
 * Cooper (1969) / Spencer formula
 */
export function calculateSolarDeclination(dayOfYear) {
  const n = dayOfYear;
  // Cooper equation: delta = 23.45 * sin(360/365 * (284 + n) * DEG_TO_RAD)
  return 23.45 * Math.sin(((360 / 365) * (284 + n)) * DEG_TO_RAD);
}

/**
 * Calculate Equation of Time (EoT) in minutes
 * Accounts for Earth's orbital eccentricity and axial tilt
 */
export function calculateEquationOfTime(dayOfYear) {
  const B = ((360 / 365) * (dayOfYear - 81)) * DEG_TO_RAD;
  return 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
}

/**
 * Calculate instantaneous Solar Position (Altitude & Azimuth)
 * @param {number|Date} dateOrDayOfYear - Day of year (1-365) or Date
 * @param {number} hourDecimal - Local time in decimal hours (e.g. 10.5 = 10:30 AM)
 * @param {number} latitude - Latitude in degrees (+ for North)
 * @param {number} longitude - Longitude in degrees (+ for East)
 * @param {number} tzOffsetHours - Timezone offset in hours (default: +5.5 for IST)
 */
export function calculateSolarPosition(
  dateOrDayOfYear,
  hourDecimal = 12.0,
  latitude = PUNE_COORDINATES.latitude,
  longitude = PUNE_COORDINATES.longitude,
  tzOffsetHours = PUNE_COORDINATES.timezoneOffsetHours
) {
  const dayOfYear = typeof dateOrDayOfYear === "number" ? dateOrDayOfYear : getDayOfYear(dateOrDayOfYear);
  const declinationDeg = calculateSolarDeclination(dayOfYear);
  const declinationRad = declinationDeg * DEG_TO_RAD;
  const latRad = latitude * DEG_TO_RAD;

  // Local Standard Time Meridian (e.g. 82.5° for IST)
  const lstm = 15 * tzOffsetHours;

  // Equation of Time (EoT) in minutes
  const eotMin = calculateEquationOfTime(dayOfYear);

  // Time Correction Factor in minutes
  const timeCorrectionMin = 4 * (longitude - lstm) + eotMin;

  // Local Solar Time (LST) in hours
  const lstHours = hourDecimal + timeCorrectionMin / 60;

  // Hour Angle (omega) in degrees: 0° at solar noon, negative in morning (East), positive in afternoon (West)
  const hourAngleDeg = (lstHours - 12) * 15;
  const hourAngleRad = hourAngleDeg * DEG_TO_RAD;

  // Solar Altitude / Elevation angle (alpha)
  // sin(alpha) = sin(lat) * sin(decl) + cos(lat) * cos(decl) * cos(omega)
  const sinAlpha =
    Math.sin(latRad) * Math.sin(declinationRad) +
    Math.cos(latRad) * Math.cos(declinationRad) * Math.cos(hourAngleRad);
  const altitudeRad = Math.asin(Math.max(-1, Math.min(1, sinAlpha)));
  const altitudeDeg = altitudeRad * RAD_TO_DEG;

  // Solar Azimuth angle (gamma_s) in degrees from True North clockwise (0°=N, 90°=E, 180°=S, 270°=W)
  let azimuthDeg = 180;
  const cosAlpha = Math.cos(altitudeRad);
  if (Math.abs(cosAlpha) > 0.001) {
    const cosFromSouth =
      (Math.sin(altitudeRad) * Math.sin(latRad) - Math.sin(declinationRad)) /
      (cosAlpha * Math.cos(latRad));
    const clampedCos = Math.max(-1, Math.min(1, cosFromSouth));
    const angleFromSouth = Math.acos(clampedCos) * RAD_TO_DEG;

    if (hourAngleDeg < 0) {
      // Morning (East of South)
      azimuthDeg = (180 - angleFromSouth + 360) % 360;
    } else {
      // Afternoon (West of South)
      azimuthDeg = (180 + angleFromSouth) % 360;
    }
  }

  // Sunrise and Sunset times (in local clock hours)
  // cos(omega_s) = -tan(lat) * tan(decl)
  const cosOmegaS = -Math.tan(latRad) * Math.tan(declinationRad);
  let sunriseHour = 6.0;
  let sunsetHour = 18.0;
  if (cosOmegaS >= -1 && cosOmegaS <= 1) {
    const omegaSDeg = Math.acos(cosOmegaS) * RAD_TO_DEG;
    const halfDayHours = omegaSDeg / 15;
    const solarNoonLocal = 12 - timeCorrectionMin / 60;
    sunriseHour = solarNoonLocal - halfDayHours;
    sunsetHour = solarNoonLocal + halfDayHours;
  }

  const isDaylight = altitudeDeg > 0.5;

  return {
    dayOfYear,
    hourDecimal,
    declinationDeg: Number(declinationDeg.toFixed(2)),
    altitudeDeg: Number(altitudeDeg.toFixed(2)),
    azimuthDeg: Number(azimuthDeg.toFixed(2)),
    isDaylight,
    sunriseHour: Number(sunriseHour.toFixed(2)),
    sunsetHour: Number(sunsetHour.toFixed(2)),
  };
}

/**
 * Generate full 2D Year & Day Sun Path Curves (Daily + Seasonal Components)
 * Returns curves for Summer Solstice, Equinox, Winter Solstice, intermediate months,
 * and hourly analemma / time lines connecting hours across the year.
 */
export function generate2DYearlySunPathData(
  latitude = PUNE_COORDINATES.latitude,
  longitude = PUNE_COORDINATES.longitude,
  tzOffsetHours = PUNE_COORDINATES.timezoneOffsetHours
) {
  // Key seasonal reference days:
  // 1. Summer Solstice (~Jun 21, day 172)
  // 2. Late Spring / Summer (~May 6 / Aug 8, day 126)
  // 3. Equinoxes (~Mar 21 / Sep 23, day 80)
  // 4. Autumn / Winter (~Feb 4 / Nov 7, day 35)
  // 5. Winter Solstice (~Dec 21, day 355)
  const keyDays = [
    { label: "Summer Solstice (Jun 21)", day: SEASONAL_DAYS.SUMMER_SOLSTICE, color: "#f59e0b", strokeWidth: 2.2 },
    { label: "May / August", day: 126, color: "rgba(245, 158, 11, 0.45)", strokeWidth: 1.2 },
    { label: "Equinox (Mar 21 / Sep 23)", day: SEASONAL_DAYS.SPRING_EQUINOX, color: "#38bdf8", strokeWidth: 2.0 },
    { label: "February / November", day: 35, color: "rgba(96, 165, 250, 0.45)", strokeWidth: 1.2 },
    { label: "Winter Solstice (Dec 21)", day: SEASONAL_DAYS.WINTER_SOLSTICE, color: "#60a5fa", strokeWidth: 2.2 },
  ];

  // For each seasonal curve, compute points from 05:30 to 18:30 at 15-minute steps
  const seasonalArcs = keyDays.map((kDay) => {
    const points = [];
    for (let h = 5.5; h <= 18.5; h += 0.25) {
      const pos = calculateSolarPosition(kDay.day, h, latitude, longitude, tzOffsetHours);
      if (pos.altitudeDeg > -2) {
        points.push({
          hour: h,
          altitude: pos.altitudeDeg,
          azimuth: pos.azimuthDeg,
          isDaylight: pos.isDaylight,
        });
      }
    }
    return {
      ...kDay,
      points,
    };
  });

  // Generate hourly lines (connecting same hour across seasons: 6 AM, 7 AM, ... 6 PM)
  const hourlyGrid = [];
  for (let hour = 6; hour <= 18; hour += 1) {
    const hourPoints = [];
    for (const kDay of keyDays) {
      const pos = calculateSolarPosition(kDay.day, hour, latitude, longitude, tzOffsetHours);
      if (pos.altitudeDeg > 0) {
        hourPoints.push({
          day: kDay.day,
          hour,
          altitude: pos.altitudeDeg,
          azimuth: pos.azimuthDeg,
        });
      }
    }
    if (hourPoints.length >= 2) {
      hourlyGrid.push({
        hour,
        label: `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`,
        points: hourPoints,
      });
    }
  }

  return {
    latitude,
    longitude,
    seasonalArcs,
    hourlyGrid,
  };
}

/**
 * Calculate Extruded Shadow Polygon for an External Obstacle
 * @param {object} obstacle - { id, type, shape, lengthFt, breadthFt, diameterFt, heightFt, distanceFromRoofX, distanceFromRoofY }
 * @param {number} roofX - Canvas X position of roof top-left (px)
 * @param {number} roofY - Canvas Y position of roof top-left (px)
 * @param {number} scalePxPerFt - Scale factor (px per foot)
 * @param {object} solarPos - { altitudeDeg, azimuthDeg, isDaylight }
 * @param {number} northAngleDeg - True North orientation on canvas (0° = North is Up)
 */
export function calculateObstacleShadow(
  obstacle,
  roofX,
  roofY,
  scalePxPerFt,
  solarPos,
  northAngleDeg = 0
) {
  if (!solarPos || !solarPos.isDaylight || solarPos.altitudeDeg <= 1.0) {
    return null; // No shadow cast when sun is below or at the horizon
  }

  const heightFt = Math.max(1, Number(obstacle.heightFt) || 15);
  const altRad = solarPos.altitudeDeg * DEG_TO_RAD;

  // Shadow length in feet: L = H / tan(altitude)
  // Clamp maximum shadow length to 150 ft to avoid infinite projections at 1° sunrise
  const shadowLengthFt = Math.min(150, heightFt / Math.tan(altRad));
  const shadowLengthPx = shadowLengthFt * scalePxPerFt;

  // Shadow direction angle on canvas (adjusted for North rotation):
  // Solar azimuth points towards where sunlight comes from; shadow casts opposite (+180°)
  // Relative to North orientation:
  const shadowAngleDeg = (solarPos.azimuthDeg - northAngleDeg + 180) % 360;
  const shadowAngleRad = shadowAngleDeg * DEG_TO_RAD;

  // Shadow displacement vector in canvas pixels:
  // In canvas: 0° is North (Up = -Y), 90° is East (+X), 180° is South (+Y), 270° is West (-X)
  const dx = shadowLengthPx * Math.sin(shadowAngleRad);
  const dy = -shadowLengthPx * Math.cos(shadowAngleRad);

  // Obstacle Base Footprint on Canvas:
  // distanceFromRoofX / distanceFromRoofY are in feet relative to roof top-left corner
  const obsX = roofX + obstacle.distanceFromRoofX * scalePxPerFt;
  const obsY = roofY + obstacle.distanceFromRoofY * scalePxPerFt;
  const obsW = (obstacle.lengthFt || obstacle.diameterFt || 10) * scalePxPerFt;
  const obsH = (obstacle.breadthFt || obstacle.diameterFt || 10) * scalePxPerFt;

  let basePoints = [];
  let shadowPolygon = [];

  if (obstacle.shape === "circle" || obstacle.type === "tree") {
    // Circle / Tree canopy
    const cx = obsX + obsW / 2;
    const cy = obsY + obsH / 2;
    const r = obsW / 2;
    const segments = 16;
    const baseCircle = [];
    const castCircle = [];

    for (let i = 0; i < segments; i++) {
      const theta = ((i * 360) / segments) * DEG_TO_RAD;
      const bx = cx + r * Math.cos(theta);
      const by = cy + r * Math.sin(theta);
      baseCircle.push({ x: bx, y: by });
      castCircle.push({ x: bx + dx, y: by + dy });
    }

    basePoints = baseCircle;

    // Perpendicular angle to shadow vector
    const perpAngle = shadowAngleRad + Math.PI / 2;
    const t1x = cx + r * Math.sin(perpAngle);
    const t1y = cy - r * Math.cos(perpAngle);
    const t2x = cx - r * Math.sin(perpAngle);
    const t2y = cy + r * Math.cos(perpAngle);

    shadowPolygon = [
      { x: t1x, y: t1y },
      { x: t1x + dx, y: t1y + dy },
      ...castCircle.filter((pt) => {
        // Points on the cast circle facing outward along shadow vector
        const dot = (pt.x - cx) * dx + (pt.y - cy) * dy;
        return dot > 0;
      }),
      { x: t2x + dx, y: t2y + dy },
      { x: t2x, y: t2y },
    ];
  } else if (obstacle.type === "pole") {
    // Thin pole: shadow is a tapered line / narrow trapezoid
    const cx = obsX + obsW / 2;
    const cy = obsY + obsH / 2;
    const poleR = Math.max(2, obsW / 4);
    const perpAngle = shadowAngleRad + Math.PI / 2;
    const p1x = cx + poleR * Math.sin(perpAngle);
    const p1y = cy - poleR * Math.cos(perpAngle);
    const p2x = cx - poleR * Math.sin(perpAngle);
    const p2y = cy + poleR * Math.cos(perpAngle);

    basePoints = [
      { x: cx - poleR, y: cy - poleR },
      { x: cx + poleR, y: cy - poleR },
      { x: cx + poleR, y: cy + poleR },
      { x: cx - poleR, y: cy + poleR },
    ];

    shadowPolygon = [
      { x: p1x, y: p1y },
      { x: cx + dx + poleR * 0.5 * Math.sin(perpAngle), y: cy + dy - poleR * 0.5 * Math.cos(perpAngle) },
      { x: cx + dx - poleR * 0.5 * Math.sin(perpAngle), y: cy + dy + poleR * 0.5 * Math.cos(perpAngle) },
      { x: p2x, y: p2y },
    ];
  } else {
    // Rectangular building or wall
    basePoints = [
      { x: obsX, y: obsY },
      { x: obsX + obsW, y: obsY },
      { x: obsX + obsW, y: obsY + obsH },
      { x: obsX, y: obsY + obsH },
    ];

    // Extrude 4 vertices by (dx, dy)
    const castPoints = basePoints.map((p) => ({ x: p.x + dx, y: p.y + dy }));
    const allPoints = [...basePoints, ...castPoints];

    // Compute 2D convex hull of base and cast points for shadow polygon
    shadowPolygon = calculateConvexHull(allPoints);
  }

  return {
    obstacleId: obstacle.id,
    obstacleType: obstacle.type,
    obstacleLabel: obstacle.label,
    heightFt,
    shadowLengthFt: Number(shadowLengthFt.toFixed(1)),
    shadowAngleDeg: Number(shadowAngleDeg.toFixed(1)),
    dx,
    dy,
    basePoints,
    polygon: shadowPolygon,
    center: { x: obsX + obsW / 2, y: obsY + obsH / 2 },
  };
}

/**
 * 2D Convex Hull (Monotone Chain algorithm)
 */
function calculateConvexHull(points) {
  if (points.length <= 3) return points;

  const sorted = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));

  const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

  const lower = [];
  for (const p of sorted) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) {
      lower.pop();
    }
    lower.push(p);
  }

  const upper = [];
  for (let i = sorted.length - 1; i >= 0; i--) {
    const p = sorted[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) {
      upper.pop();
    }
    upper.push(p);
  }

  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

/**
 * Check if a Point is inside a Polygon (Ray casting method)
 */
export function isPointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect = yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Check if two line segments (p1-p2) and (q1-q2) intersect
 */
function doLinesIntersect(p1, p2, q1, q2) {
  const ccw = (a, b, c) => (c.y - a.y) * (b.x - a.x) > (b.y - a.y) * (c.x - a.x);
  return ccw(p1, q1, q2) !== ccw(p2, q1, q2) && ccw(p1, p2, q1) !== ccw(p1, p2, q2);
}

/**
 * Check if a Solar Panel Rectangle intersects an Obstacle Shadow Polygon
 */
export function checkPanelShadowOverlap(panel, shadowPolygon) {
  if (!panel || !shadowPolygon || shadowPolygon.length < 3) return false;

  const px = panel.x;
  const py = panel.y;
  const pw = panel.w;
  const ph = panel.h;

  // 1. Check if any of the panel's 4 corners or center are inside the shadow polygon
  const corners = [
    { x: px, y: py },
    { x: px + pw, y: py },
    { x: px + pw, y: py + ph },
    { x: px, y: py + ph },
    { x: px + pw / 2, y: py + ph / 2 },
  ];

  for (const pt of corners) {
    if (isPointInPolygon(pt.x, pt.y, shadowPolygon)) {
      return true;
    }
  }

  // 2. Check if any of the shadow polygon's vertices are inside the panel rect
  for (const spt of shadowPolygon) {
    if (spt.x >= px && spt.x <= px + pw && spt.y >= py && spt.y <= py + ph) {
      return true;
    }
  }

  // 3. Check edge intersections between panel bounding edges and polygon edges
  const panelEdges = [
    [corners[0], corners[1]],
    [corners[1], corners[2]],
    [corners[2], corners[3]],
    [corners[3], corners[0]],
  ];

  for (let i = 0; i < shadowPolygon.length; i++) {
    const nextIdx = (i + 1) % shadowPolygon.length;
    const polyEdge = [shadowPolygon[i], shadowPolygon[nextIdx]];

    for (const pEdge of panelEdges) {
      if (doLinesIntersect(pEdge[0], pEdge[1], polyEdge[0], polyEdge[1])) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate Total Array Shading Loss for Current Sun Position
 */
export function calculateArrayShadingLoss(
  panels = [],
  obstacles = [],
  roofX = 0,
  roofY = 0,
  scalePxPerFt = 15,
  solarPos = null,
  northAngleDeg = 0
) {
  if (!panels || panels.length === 0) {
    return {
      totalPanels: 0,
      shadedCount: 0,
      unshadedCount: 0,
      lossPercentage: 0,
      shadedPanelIds: new Set(),
      shadowPolygons: [],
    };
  }

  if (!solarPos || !solarPos.isDaylight) {
    return {
      totalPanels: panels.length,
      shadedCount: 0,
      unshadedCount: panels.length,
      lossPercentage: 0,
      shadedPanelIds: new Set(),
      shadowPolygons: [],
    };
  }

  // Calculate shadow polygons for all external obstacles
  const shadowPolygons = [];
  for (const obs of obstacles) {
    const shadow = calculateObstacleShadow(obs, roofX, roofY, scalePxPerFt, solarPos, northAngleDeg);
    if (shadow) {
      shadowPolygons.push(shadow);
    }
  }

  const shadedPanelIds = new Set();

  // Test each panel against all shadows
  for (const panel of panels) {
    for (const shadow of shadowPolygons) {
      if (checkPanelShadowOverlap(panel, shadow.polygon)) {
        shadedPanelIds.add(panel.id);
        break; // Once shaded by one obstacle, move to next panel
      }
    }
  }

  const shadedCount = shadedPanelIds.size;
  const unshadedCount = panels.length - shadedCount;
  const lossPercentage = Number(((shadedCount / panels.length) * 100).toFixed(1));

  return {
    totalPanels: panels.length,
    shadedCount,
    unshadedCount,
    lossPercentage,
    shadedPanelIds,
    shadowPolygons,
  };
}

/**
 * Calculate Daily Shading Profile across 13 Hours (06:00 to 18:00)
 */
export function calculateDailyHourlyProfile(
  panels = [],
  obstacles = [],
  roofX = 0,
  roofY = 0,
  scalePxPerFt = 15,
  dateOrDayOfYear = SEASONAL_DAYS.WINTER_SOLSTICE,
  latitude = PUNE_COORDINATES.latitude,
  longitude = PUNE_COORDINATES.longitude,
  northAngleDeg = 0
) {
  const hourlyProfile = [];

  for (let hour = 6; hour <= 18; hour += 1) {
    const solarPos = calculateSolarPosition(dateOrDayOfYear, hour, latitude, longitude);
    const lossStats = calculateArrayShadingLoss(
      panels,
      obstacles,
      roofX,
      roofY,
      scalePxPerFt,
      solarPos,
      northAngleDeg
    );

    hourlyProfile.push({
      hour,
      timeLabel: `${hour % 12 || 12} ${hour >= 12 ? "PM" : "AM"}`,
      altitudeDeg: solarPos.altitudeDeg,
      azimuthDeg: solarPos.azimuthDeg,
      isDaylight: solarPos.isDaylight,
      shadedCount: lossStats.shadedCount,
      totalPanels: panels.length,
      lossPercentage: lossStats.lossPercentage,
    });
  }

  return hourlyProfile;
}
