# Pune Rooftop Solar Calculator Blueprint

Last updated: 2026-05-12

This is the living blueprint for building the rooftop solar calculator and internal report workspace from scratch. Keep this file updated whenever product decisions, formulas, pricing defaults, policy assumptions, or implementation details change.

## 1. Product Summary

Build a Pune-focused rooftop solar calculator hosted as a separate section on the owner's website. The tool is primarily for internal consultation and report preparation, with a simplified customer-facing mode that can be used directly by customers when needed.

The application should make it easy to compare rooftop solar options for residential customers:

- On-grid solar system
- Hybrid grid-connected solar with LiFePO4 battery
- Off-grid solar with grid charging

The core value is speed plus depth: a simple experience for customers, and a comprehensive editable backend for the internal team.

## 2. Target Users

### Internal Team

Primary users. They need to:

- Enter customer bill and site details quickly.
- Override calculation assumptions during live discussion.
- Compare system options side by side.
- Explain ROI, savings, subsidy eligibility, and cost breakup.
- Prepare a clean customer-ready estimate on screen.

### Customers

Secondary users. They may:

- Use an easy calculator with fewer fields.
- See simple system recommendations.
- Understand estimated savings and payback.
- Avoid being exposed to formulas, policy complexity, or internal pricing knobs.

## 3. Product Modes

### Easy Mode

Customer-friendly interface with minimal inputs.

Inputs:

- Monthly electricity consumption or average monthly bill
- Bill upload, optional
- Available shadow-free rooftop area in square feet
- Sanctioned load, if known
- Preferred goal:
  - Maximum savings
  - Backup support
  - Lowest upfront cost
  - Best long-term ROI

Outputs:

- Recommended solar capacity
- Expected monthly generation
- Estimated monthly savings
- Approximate system cost
- Approximate subsidy, if eligible
- Payback period
- Simple comparison between on-grid, hybrid, and off-grid
- Clear eligibility notes

Easy mode should hide advanced editable assumptions.

### Developer / Internal Mode

Password-protected advanced mode for the internal team.

Inputs and controls:

- All Easy Mode inputs
- Editable monthly units
- Editable average tariff or slab-based tariff calculation
- Sanctioned load override
- Recommended DC capacity override
- Inverter capacity override
- DCR vs non-DCR panel selector
- Structure type selector
- Battery capacity and backup-hours controls
- System loss and shading assumptions
- Tilt, azimuth, mounting height, and cleaning assumptions
- Component rate overrides
- GST, liaisoning, net meter, consultancy, transport, wiring, earthing, and contingency inputs
- Subsidy eligibility override with reason
- Notes for internal team and customer-facing notes

Developer mode should expose formulas and assumptions clearly enough for the team to defend the calculation.

## 4. Version Scope

### V1 Scope

V1 should focus on the calculator and editable estimation workflow.

Included:

- Easy Mode and Developer Mode
- Manual monthly consumption entry
- Bill upload placeholder or basic bill data extraction path
- Rooftop area sizing
- Sanctioned load check
- On-grid, hybrid, and off-grid comparison
- PM Surya Ghar subsidy logic
- DCR and non-DCR panel pricing
- Structure material pricing
- Cost breakup
- ROI and payback outputs
- Customer-ready on-screen result
- Internal assumptions panel
- Versioned configuration for rates, tariffs, and policy assumptions
- Static local deployment with dependency-free ES modules

Deferred:

- Formal PDF generation
- Product SKU catalog
- Vendor quotation workflow
- CRM integration
- Payment workflow
- Full user account system
- Advanced shadow modeling from images
- Real authentication

### V2 Scope

Likely additions:

- PDF proposal generation
- Saved customer estimate records
- Product catalog integration
- Quote templates
- CRM or lead system integration
- Role-based internal logins
- Bill OCR improvements
- Admin panel for tariff and price updates
- Customer share links

## 5. Core Inputs

### Customer and Connection Inputs

- Customer name, optional in Easy Mode
- Location: Pune default, editable in Developer Mode
- DISCOM: MSEDCL default
- Consumer category: residential default
- Sanctioned load in kW
- Phase type, if known
- Existing monthly consumption in kWh
- Average monthly bill amount
- Bill upload file, optional

### Roof and Site Inputs

- Available rooftop area in square feet
- Shadow-free percentage
- Roof type
- Tilt angle
- Azimuth / orientation
- Mounting height
- Structure material
- Cleaning access quality
- Obstruction notes

### System Inputs

- System type:
  - On-grid
  - Hybrid grid-connected
  - Off-grid with grid charging
- Panel type:
  - DCR
  - Non-DCR
- Solar DC capacity in kWp
- Inverter size in kW
- Battery capacity in kWh
- Battery usable depth of discharge
- Backup load in kW
- Required backup hours

### Pricing Inputs

All pricing must be editable in Developer Mode.

Default rates:

| Item | Default Rate |
| --- | ---: |
| DCR solar panels | Rs 26 / Wp |
| Non-DCR solar panels | Rs 17 / Wp |
| LiFePO4 battery | Rs 17.5 / Wh |
| Off-grid MPPT inverter | Rs 15 / W |
| Hybrid inverter | Rs 23 / W |
| Hot-dip galvanized structure | Rs 6 / W |
| Galvalume structure | Rs 5.3 / W |
| GP purlin structure | Rs 4.8 / W |

Additional editable cost buckets:

- On-grid inverter cost
- DCDB / ACDB
- Wiring and conduits
- Earthing
- Lightning arrestor
- Net meter and testing
- Transport
- Installation labor
- Consultancy
- Liaisoning
- Civil or roof strengthening work
- Monitoring device
- O&M package
- GST
- Contingency

Open pricing decision:

- Default on-grid inverter rate is not finalized. V1 uses a clearly editable placeholder of Rs 8/W.

## 6. Policy and Subsidy Rules

Policy rules must be stored as versioned configuration, not hardcoded deep in calculation code.

### Current PM Surya Ghar Assumptions

As of 2026-05-12:

- PM Surya Ghar subsidy applies to eligible residential grid-connected rooftop solar systems.
- DCR modules are required for subsidized projects.
- Subsidy is based on solar module DC capacity, not inverter size.
- Subsidy is Rs 30,000/kWp for the first 2 kWp.
- Subsidy is Rs 18,000/kWp for additional capacity up to 3 kWp.
- Subsidy is capped at Rs 78,000 for systems larger than 3 kWp.
- No additional CFA applies beyond 3 kWp for individual residential systems.
- Battery cost should not be treated as subsidized.
- Non-DCR systems should be treated as no-subsidy options.
- Off-grid systems, including off-grid systems with grid charging, should be treated as no-subsidy options.

### System Eligibility Matrix

| System Type | Panel Type | Subsidy Treatment |
| --- | --- | --- |
| On-grid | DCR | Eligible if residential, grid-connected, and compliant |
| On-grid | Non-DCR | Not eligible |
| Hybrid grid-connected | DCR | Solar capacity may be eligible if compliant; battery is not subsidized |
| Hybrid grid-connected | Non-DCR | Not eligible |
| Off-grid with grid charging | DCR or non-DCR | Not eligible |

Hybrid eligibility should be shown carefully in the UI: "Subsidy considered only for the grid-connected solar portion, subject to DISCOM and scheme compliance."

### Official References

- MNRE Grid Connected Rooftop Solar Programme: https://mnre.gov.in/en/grid-connected-solar-rooftop-programme/
- PM Surya Ghar CFA Guidelines PDF: https://solarrooftop.pmsuryaghar.gov.in/notification/172_notification.pdf
- National Portal FAQ PDF: https://solarrooftop.pmsuryaghar.gov.in/pdf/faq_national_portal2024021301.pdf
- MSEDCL PM Surya Ghar page: https://www.mahadiscom.in/ismart/index.php/media/media/empanelled_agencies_national_portal.php
- MERC MSEDCL tariff order press note: https://merc.gov.in/wp-content/uploads/2025/03/Press-Note_MSEDCL-MYT-Order_English.pdf

## 7. Tariff Assumptions

Tariffs should be stored in a dated configuration file by DISCOM, category, and financial year.

Default:

- DISCOM: MSEDCL
- Category: LT residential
- Region: Pune
- Financial year: current active tariff year

The calculator should support two savings methods:

### Simple Savings Method

Used in Easy Mode.

- Estimate average effective tariff from monthly bill and monthly units.
- Monthly savings = min(monthly solar generation, monthly consumption) * effective tariff
- Keep minimum fixed charges out of "zero bill" claims.

### Slab-Based Savings Method

Used in Developer Mode.

- Apply MSEDCL residential slab tariff.
- Calculate current bill.
- Calculate post-solar net import bill.
- Savings = current bill - post-solar bill.
- Include fixed charges, wheeling charges, electricity duty, and other charges when available.
- Allow manual override if bill data does not match estimated tariff.

Important UI note:

- Do not promise a zero bill. Even with high generation, fixed charges and minimum charges may remain.

## 8. Solar Sizing Logic

The system recommendation should be constrained by:

- Customer consumption
- Available roof area
- Sanctioned load
- Subsidy optimization
- Budget preference
- System type

### Roof Area Constraint

Official FAQ baseline:

- 1 kWp generally requires about 10 square meters of shadow-free area.
- 10 square meters is approximately 107.6 square feet.

Recommended configurable defaults:

- Ideal area per kWp: 108 sq ft
- Practical area per kWp with access gaps and spacing: 120 sq ft
- Easy Mode default should use practical area.
- Developer Mode should allow area-per-kWp override.

Formula:

```text
maxCapacityByAreaKw = usableRoofAreaSqft / sqftPerKw
```

### Consumption Constraint

Recommended capacity should not blindly maximize roof area. It should aim to offset meaningful consumption.

Formula:

```text
monthlyGenerationPerKw = dailyGenerationPerKw * 30
capacityByConsumptionKw = monthlyConsumptionKwh / monthlyGenerationPerKw
```

### Sanctioned Load Constraint

For grid-connected systems, the app must compare recommended system capacity with sanctioned load and show one of:

- Within sanctioned load
- Load enhancement may be required
- Manual review needed

Developer Mode should allow capacity overrides even when a warning is shown.

## 9. Generation Model

V1 should use a simple configurable generation model.

Default generation assumptions:

- Daily generation: 4.0 to 5.0 kWh per kWp per day
- Easy Mode default: 4.2 kWh per kWp per day unless refined
- Developer Mode default: editable
- Annual degradation: editable, default 0.5 percent per year

Formula:

```text
monthlyGenerationKwh = systemCapacityKw * dailyGenerationPerKw * 30 * performanceFactor
annualGenerationKwh = monthlyGenerationKwh * 12
```

Performance factor should combine:

- Shading loss
- Dirt loss
- Tilt/orientation loss
- Wiring/inverter loss
- Downtime or O&M loss

Developer Mode should expose these as separate sliders or numeric fields.

## 10. Cost Calculation

The calculator should build costs from component buckets.

### Solar Panel Cost

```text
panelCost = dcCapacityWp * panelRatePerWp
```

Panel rate depends on DCR or non-DCR selection.

### Structure Cost

```text
structureCost = dcCapacityWp * structureRatePerW
```

Structure rate depends on material:

- Hot-dip galvanized
- Galvalume
- GP purlin

### Inverter Cost

```text
inverterCost = inverterCapacityW * inverterRatePerW
```

Rate depends on system type:

- Hybrid inverter: Rs 23/W default
- Off-grid MPPT inverter: Rs 15/W default
- On-grid inverter: pending default, editable

### Battery Cost

```text
batteryCost = batteryCapacityWh * batteryRatePerWh
```

Default battery rate:

- Rs 17.5/Wh

### Total Pre-Subsidy Cost

```text
totalPreSubsidy =
  panelCost +
  structureCost +
  inverterCost +
  batteryCost +
  wiringCost +
  protectionCost +
  installationCost +
  netMeterCost +
  consultancyCost +
  liaisoningCost +
  gst +
  contingency
```

### Subsidy

```text
subsidy =
  if eligible:
    min(dcCapacityKw, 2) * 30000
    + min(max(dcCapacityKw - 2, 0), 1) * 18000
  else:
    0

subsidy = min(subsidy, 78000)
```

### Net Cost

```text
netCustomerCost = totalPreSubsidy - subsidy
```

For hybrid systems, subsidy should apply only to the eligible solar portion. Battery cost remains unsubsidized.

## 11. ROI and Payback Logic

### Monthly Savings

Simple:

```text
monthlySavings = offsetUnits * effectiveTariff
```

Where:

```text
offsetUnits = min(monthlyGenerationKwh, monthlyConsumptionKwh)
```

Developer Mode:

- Calculate current bill using slabs.
- Calculate post-solar bill using net import.
- Savings are the difference.

### Annual Savings

```text
annualSavings = monthlySavings * 12
```

### Payback

```text
paybackYears = netCustomerCost / annualSavings
```

### ROI

```text
roiPercent = (annualSavings / netCustomerCost) * 100
```

### Lifetime Savings

V1 should estimate 25-year savings using:

- Annual generation degradation
- Optional electricity tariff escalation
- Optional battery replacement for hybrid/off-grid
- Optional inverter replacement
- O&M cost

Keep lifetime savings in Developer Mode initially. Easy Mode can show only a simple "25-year estimated savings" with assumptions hidden behind an expandable details section.

## 12. Battery and Backup Logic

Hybrid and off-grid systems need backup modeling.

Inputs:

- Battery capacity in kWh
- Usable DoD percentage
- Backup load in kW
- Inverter efficiency
- Desired backup hours

Formula:

```text
usableBatteryKwh = batteryCapacityKwh * depthOfDischarge * inverterEfficiency
backupHours = usableBatteryKwh / backupLoadKw
requiredBatteryKwh = desiredBackupHours * backupLoadKw / (depthOfDischarge * inverterEfficiency)
```

Default assumptions:

- LiFePO4 usable DoD: 90 percent
- Inverter efficiency: 92 percent
- Battery degradation: configurable

Off-grid with grid charging should show:

- Solar contribution
- Grid charging dependency
- Backup availability
- No subsidy
- Higher upfront cost compared with on-grid

## 13. Recommendation Engine

The app should produce a recommendation, not just raw numbers.

Decision factors:

- Consumption
- Roof area
- Sanctioned load
- Subsidy eligibility
- Customer goal
- Budget sensitivity
- Backup requirement
- Payback period

Example recommendation logic:

- If customer wants lowest cost and no backup: recommend on-grid DCR if subsidy eligible.
- If customer has frequent outages and can accept longer payback: recommend hybrid.
- If customer wants backup but no net metering/subsidy path: show off-grid with grid charging as a non-subsidy option.
- If non-DCR lowers cost but loses subsidy, show both net costs clearly.

The recommendation must explain why:

- "Best payback"
- "Best backup"
- "Lowest upfront cost"
- "Subsidy eligible"
- "Manual review needed due to sanctioned load"

## 14. User Interface Blueprint

### Easy Mode Screen

Recommended layout:

- Header with mode selector
- Input panel
- Result summary
- System comparison
- Recommendation card
- Expandable assumptions

Inputs should be simple:

- Monthly units or bill amount
- Roof area
- Sanctioned load
- Backup needed toggle
- Bill upload optional

Outputs should be visual:

- Recommended capacity
- Monthly savings
- Net system cost
- Subsidy
- Payback period
- Comparison table

### Developer Mode Screen

Recommended layout:

- Password gate
- Customer/site inputs
- System configuration
- Pricing assumptions
- Subsidy assumptions
- Tariff assumptions
- Loss assumptions
- Cost breakup
- Output comparison
- Internal notes

Developer Mode should make recalculation instant as values change.

### Mode Switching

- Easy Mode should be default.
- Developer Mode should require a password.
- Developer Mode should have an obvious "customer view" toggle to hide internal pricing and formulas while keeping selected assumptions.

## 15. Data Model Draft

### Estimate

```text
Estimate
  id
  createdAt
  updatedAt
  mode
  customer
  site
  consumption
  selectedSystems[]
  assumptions
  results
  notes
```

### Customer

```text
Customer
  name
  phone
  email
  address
  city
  discom
  consumerCategory
```

### Site

```text
Site
  roofAreaSqft
  usableRoofAreaSqft
  sanctionedLoadKw
  phaseType
  tiltDeg
  azimuthDeg
  mountingHeightFt
  shadingPercent
  structureType
```

### SystemOption

```text
SystemOption
  type
  panelType
  dcCapacityKw
  inverterCapacityKw
  batteryCapacityKwh
  subsidyEligible
```

### PricingConfig

```text
PricingConfig
  panelDcrRatePerWp
  panelNonDcrRatePerWp
  batteryRatePerWh
  hybridInverterRatePerW
  offgridMpptInverterRatePerW
  ongridInverterRatePerW
  structureRates
  wiringRate
  consultancyFee
  liaisoningFee
  gstRate
  contingencyRate
```

### TariffConfig

```text
TariffConfig
  discom
  category
  financialYear
  fixedCharges
  slabs[]
  wheelingCharges
  duties
  minimumCharges
```

## 16. Backend Architecture

The backend should be simple but comprehensive.

### V1 Implementation Note

The first local version is implemented as a dependency-free static ES-module app:

- `index.html`
- `src/config.js`
- `src/calculator.js`
- `src/app.js`
- `src/styles.css`
- `tests/calculator.test.mjs`

This keeps the app easy to run locally and makes the calculation core portable to a future React, Next.js, Astro, or backend-backed implementation.

Recommended modules:

- `calculator-core`
  - Pure calculation functions
  - No UI dependencies
  - Unit tested

- `policy-config`
  - Subsidy rules
  - Eligibility logic
  - Versioned references

- `pricing-config`
  - Component rates
  - Structure rates
  - Future product catalog adapter

- `tariff-engine`
  - Simple effective tariff method
  - Slab-based method
  - Future tariff update support

- `bill-parser`
  - V1 placeholder or basic parser
  - V2 OCR extraction

- `report-state`
  - Captures selected assumptions and final numbers
  - Future PDF generator uses this snapshot

Important principle:

- All calculations should be deterministic from an input snapshot and versioned config.

## 17. Testing Strategy

V1 test coverage should focus on calculation correctness.

Test areas:

- Subsidy calculation at 1 kW, 2 kW, 2.5 kW, 3 kW, and 6 kW
- DCR vs non-DCR eligibility
- Off-grid no-subsidy logic
- Hybrid battery cost excluded from subsidy
- Roof area capacity limit
- Sanctioned load warning
- Payback formula
- Battery backup formula
- Cost breakup totals
- Slab-based tariff calculations

Golden test cases should be maintained in the blueprint or a separate test fixtures file once implementation begins.

## 18. Security and Privacy

Because bills may contain private data:

- Do not store uploaded bill files by default.
- If stored, require explicit internal action.
- Avoid exposing internal mode publicly.
- Use password protection for Developer Mode in V1.
- Keep admin rates and internal notes hidden from Easy Mode.
- Add audit trail in future if estimates are saved.

V1 password gate can be simple, but V2 should consider proper authentication and roles.

Current local V1 behavior:

- Internal Mode asks the user to set a browser-local passphrase on first use.
- The passphrase is stored in local browser storage for that device.
- This is not production authentication. Static hosting cannot protect internal features with real secrecy.

## 19. Performance Expectations

Targets:

- Manual estimate recalculation: instant or under 1 second
- Easy Mode initial result: under 3 seconds
- Bill upload parsing: under 30 seconds in V1/V2 depending on OCR
- Calculator should work smoothly during live customer consultation

## 20. Reliability and Maintenance

The app should be maintainable by updating configuration rather than code whenever possible.

Config to keep editable:

- Tariff slabs
- Subsidy rates
- Component rates
- Structure rates
- Loss assumptions
- Generation assumptions
- GST and extra charges
- Report text

When policy changes, update:

- Policy config
- This blueprint
- UI eligibility notes
- Tests

## 21. Open Decisions

- Default wiring and protection cost model
- Default consultancy and liaisoning charges
- Whether V1 stores estimates or only calculates in-browser/session
- Production authentication approach for Developer Mode
- Whether bill upload graduates from V1 attachment/manual entry to real OCR/parser in V2
- Preferred future framework if the website section is integrated into a larger site
- Whether customer mode should be publicly indexed or hidden behind a direct link
- Whether hybrid systems will be offered as subsidy-assisted grid-connected systems only after manual compliance review

## 22. Decision Log

| Date | Decision | Alternatives | Reason |
| --- | --- | --- | --- |
| 2026-05-12 | Build as an internal-first calculator | Public-only calculator | Internal team needs live editing, formulas, and flexible assumptions |
| 2026-05-12 | Add Easy Mode and Developer Mode | One universal interface | Customers need simplicity; internal users need full controls |
| 2026-05-12 | Defer PDF generation to V2 | Build PDF in V1 | V1 should polish calculation and on-screen outputs first |
| 2026-05-12 | Include on-grid, hybrid, and off-grid with grid charging | Only on-grid and hybrid | Internal team needs to compare realistic backup options |
| 2026-05-12 | Treat off-grid systems as no-subsidy | Apply subsidy to all solar | Official sources limit subsidy to grid-connected residential RTS |
| 2026-05-12 | Add DCR and non-DCR panel pricing | Single panel price | DCR affects subsidy eligibility and cost |
| 2026-05-12 | Use versioned config for policy and tariffs | Hardcode rules | Solar policy and tariffs change over time |
| 2026-05-12 | Use editable rough pricing before product catalog | Product-level pricing immediately | Keeps V1 simple while allowing future catalog integration |
| 2026-05-12 | Build V1 as a dependency-free static ES-module app | Start with a framework scaffold | Fast local deployment and portable calculation core |
| 2026-05-12 | Use Rs 8/W as editable placeholder for on-grid inverter | Block implementation until final rate | Allows comparisons to work while keeping the assumption visible |
| 2026-05-12 | Use a browser-local Internal Mode passphrase | Hardcoded static password | Avoids publishing a shared password while keeping a simple V1 gate |
| 2026-05-12 | Treat bill upload as attachment/manual-entry helper in V1 | Attempt PDF OCR immediately | Avoids fragile bill parsing before the calculator is validated |

## 23. Implementation Handoff Checklist

Before implementation starts:

- Choose tech stack.
- Decide whether the calculator runs mostly client-side, server-side, or hybrid.
- Decide where pricing and policy config lives.
- Define the first golden calculation examples.
- Decide Developer Mode password approach.
- Decide whether to build bill parsing in V1.
- Confirm default on-grid inverter, wiring, consultancy, liaisoning, GST, and contingency assumptions.

## 24. Update Rules for This File

Whenever development changes the app behavior:

- Update relevant sections in this blueprint.
- Add a row to the Decision Log for meaningful product or technical decisions.
- Mark old assumptions as replaced instead of silently deleting important context.
- Keep official source links current when policy or tariff assumptions change.
- If formulas change, update both formulas and testing notes.
