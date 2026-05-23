# Comprehensive MSEDCL Rules, Regulations & Solar Calculator Reference Engine

This document serves as a master reference guide and core logic matrix for Large Language Models (LLMs) and systems analyzing Maharashtra State Electricity Distribution Co. Ltd. (MSEDCL) billing. It combines general tariff rules, consumer categorization, grievance redressal, and the computational logic for a Solar Savings Calculator.

---

## 1. Tariff Applicability and Categorization Rules

### 1.1 General Guidelines
* **Effective Dates:** Revised tariffs are implemented as per the specific Multi-Year Tariff (MYT) orders issued by the Maharashtra Electricity Regulatory Commission (MERC) (e.g., FY 2020-21 to FY 2024-25, FY 2025-26 to 2029-30).
* **Pro-Rata Billing:** Where the billing cycle of a consumer differs from the date of applicability of revised tariffs, the tariffs are applied for the consumption on a pro-rata basis.

### 1.2 Categorization Rules
MERC has laid out specific rules for consumer categorization to avoid ambiguity:
* **IT and ITeS Units:** The requirement of having a certification under the GoM Policy to claim Industrial Tariff has been removed following APTEL judgments. Tariff categorization is strictly based on criteria under Section 62(3) of the Electricity Act.
* **Hostels:** Student hostels are categorized under the **Public Service Category** (rather than Residential) to avoid subjecting them to the high telescopic tariff structure of the residential category.
* **Tabelas:** Dairy or cattle farming (Tabelas) dependent on the agricultural sector are classified appropriately to reflect their agricultural relation.
* **Professionals:** Lawyers, Doctors, Engineers, and Chartered Accountants occupying premises exclusively for conducting their profession are NOT eligible for Residential/LT-I tariffs and are charged under the respective commercial/non-residential categories.

---

## 2. Baseline Bill Computation (Pre-Solar Assessment)

Before calculating solar savings, the calculator must establish the consumer's current billing baseline.

### 2.1 Billing Units & Slabs
* **Low Tension (LT) $\le$ 20 kW:** Billed on **kWh (Active Energy)**. Categories include LT-I (Residential), LT-II (Commercial), LT-III (Industrial).
* **LT > 20 kW & High Tension (HT) Consumers:** Billed on **kVAh (Apparent Energy)**. This inherently penalizes poor power factor (reactive power) because any drop in Power Factor (PF) increases the kVAh recorded. For LT consumer categories below 20 kW, kVAh-based billing implementation requires comprehensive studies based on the experience of >20 kW categories and may be introduced in a phased manner.
* **Residential Slabs (Telescopic):** Per-unit prices increase progressively. As of FY 2024-25, base energy charges step up at 0-100 units (₹3.46), 101-300 units (₹6.21), 301-500 units (₹9.45), 501-1000 units (₹10.41), and >1000 units (₹11.21). *Solar aggressively offsets the highest, most expensive slabs first.*

### 2.2 Mandatory Fixed & Statutory Charges (Non-Offsettable by Solar)
Solar generation primarily offsets **Energy Charges**. The following charges typically remain on the bill even with 100% solar offset:
* **Fixed / Demand Charges:** Charged per connection, per kW, or per kVA of sanctioned load/contract demand. *(Note: EV charging stations now have a single-part tariff with 0 Fixed/Demand charges).*
* **Meter Rent:** Fixed monthly rental (e.g., ₹35 single-phase, ₹75 three-phase).
* **Electricity Duty & Tax on Sale:** Calculated as a percentage (typically 7%) of the remaining billed amount (Energy + Fixed + FAC) after solar offset.

---

## 3. Rooftop Solar Net Metering, Banking Rules & Subsidies

The calculator must apply the following MSEDCL grid-support rules to determine the net energy credited to the consumer's bill.

### 3.1 Grid Support / Banking Charges
MSEDCL deducts a percentage of the **energy injected into the grid** (not total generation) to recover grid balancing costs. The calculator must deduct this percentage before applying solar credits to the bill.
* **Exemption:** All consumer categories with a Sanctioned Load **up to 10 kW** are **100% exempted** from banking/grid support charges.
* **LT Networks (> 10 kW):** 12% deduction on injected energy.
* **HT Networks:** 7.5% deduction on injected energy.
* *Exceptions:* Systems under Net Billing or behind-the-meter setups not availing net metering are excluded from these specific banking deductions.

### 3.2 Banked Energy Utilization
* **Residential Consumers:** Can utilize banked solar energy without any time restrictions across all hours of the day.
* **Non-Residential / Open Access Consumers:** Banked energy can be utilized during all hours **except Peak Hours (17:00 Hrs to 24:00 Hrs)**.

### 3.3 Subsidies (PM Surya Ghar Muft Bijli Yojana)
For residential consumers, incorporating the national subsidy significantly improves the ROI:
* **Capacity up to 2 kW:** Subsidy of ₹30,000 per kW.
* **Capacity 2 kW to 3 kW:** Subsidy of ₹30,000 for the first 2 kW + ₹18,000 for the 3rd kW (Max ₹78,000).
* **Capacity > 3 kW:** Maximum subsidy is capped at **₹78,000**.

---

## 4. Time-of-Day (ToD) Optimization (The "Solar Advantage")

The Commission has redesigned ToD slabs to heavily promote consumption during daytime solar generation hours. This drastically changes the ROI calculations for C&I setups.

### 4.1 Daytime "Solar Hours" (09:00 Hrs to 17:00 Hrs)
* **LT-Domestic & HT-Group Housing:** A rebate of **Rs. -0.80/unit** (scaling up to Rs. -1.00/unit by FY30).
* **Commercial / Industrial (HT/LT):** A massive rebate of **-20% of the Energy Charge** (April to September) and **-30% of the Energy Charge** (October to March).
* *Calculator Logic:* Solar generated and consumed behind-the-meter during these hours directly offsets standard energy charges. If the customer shifts heavy loads to this window, their baseline bill drops significantly even before grid injection is calculated.

### 4.2 Evening Peak Hours (17:00 Hrs to 24:00 Hrs)
* **Penalty:** +25% of Energy Charge for HT/LT Industrial and Commercial categories; +20% for other non-residential categories.
* *Calculator Logic:* Solar does not generate during these hours. Non-residential customers cannot use banked solar units to offset consumption during this peak window. Recommending a **Solar + Battery Energy Storage System (BESS)** is highly viable here to discharge during the 17:00-24:00 window, avoiding the +25% penalty.

---

## 5. Billing Discounts, Incentives & Financial Triggers

### 5.1 Power Factor (PF) Penalty & Incentive
* **Applicability:** HT and LT categories > 20kW (billed in kVAh).
* **Incentive/Penalty:** Maintaining a PF between 0.95 and 1.00 yields a 0.5% to 3.5% discount on the energy bill. Penalties apply if PF drops below thresholds like 0.90 or 0.81.
* *Solar Impact:* Since they are billed in kVAh, solar inverters that provide reactive power compensation (smart inverters) can optimize grid kVAh drawn, lowering the apparent energy billed.

### 5.2 Payment & Consumption Rebates
* **Prompt Payment Discount:** 1% discount of the monthly bill (excluding taxes/duties) if paid within 7 days. *Apply this to the final post-solar bill estimate.*
* **Consistent Payment Rebate:** 1% rebate for LT-AG, LT-PWW, and LT-Streetlight if paid consistently within due dates (monitored quarterly).
* **Bulk Consumption Rebate:** HT-Industrial consumers $> 1$ lakh units (0.1 MU) per month get a reverse telescopic slab rebate.

### 5.3 Green Power Tariff
If a consumer wishes to be 100% green but lacks roof space, MSEDCL offers a Green Power Tariff at an additional premium of **Rs. 0.25/kWh**.

---

## 6. Consumer Grievance Redressal (CGRF) & Bill Correction

### 6.1 Grievance Redressal Mechanisms
Pursuant to MERC Regulations 2020, MSEDCL handles consumer grievances via the Internal Complaint Redressal System (ICRS) and CGRF.
* **Exclusions:** CGRF does *not* handle unauthorized use of electricity (Sec 126/127), offences/penalties (Sec 135-139), distribution accidents (Sec 161), active court/tribunal cases, or grievances older than **2 years**.
* **Appeals:** Aggrieved consumers can approach the Electricity Ombudsman and subsequently the High Court.

### 6.2 Online Bill Correction Procedure (Circular 305)
* **CRM Integration:** Complaints must be entered within **2 working days** and resolved within **7 working days**.
* **Slab Benefit Cases:** Auto-captures the date from which slab benefits apply based on $\ge$ 20% consumption reduction.
* **Tariff Change Cases:** Name/tariff category changes must be executed before the expiry of the second billing cycle post-application.

---

## 7. Composite Billing System for Corporate Users

A facility tailored for corporate consumers to manage multiple LT consumer numbers under a single umbrella:
* **Mechanism:** Corporate users register and are grouped by the MSEDCL team upon verification.
* **Features:** Group users can register consumers, set bill payment priorities (Prompt Pay Date vs. Bill Due Date), and recharge a consolidated wallet via RTGS/NEFT/Online payment to seamlessly pay multiple LT bills at once.

---

## 8. LLM Logic Flow: How to Process a User's Bill

When parsing a user's prompt or uploaded MSEDCL bill, the LLM should follow this sequence:

1. **Extract Bill Data:** Sanctioned Load (kW/kVA), Phase (1 or 3), Consumer Category (LT-I, LT-II, HT, etc.), Total Monthly Consumption (kWh/kVAh), and Current Bill Amount.
2. **Determine System Size:** Suggest a kW system size based on roof space or unit consumption (Rule of thumb: 1 kW generates ~120-140 units/month in Maharashtra).
3. **Assess Banking Charges:** * If Proposed System $\le$ 10 kW $ightarrow$ Banking Charge = 0%.
    * If Proposed System > 10 kW and LT $ightarrow$ Deduct 12% from units injected.
    * If Proposed System > 10 kW and HT $ightarrow$ Deduct 7.5% from units injected.
4. **Calculate Offset & Slab Drop (Residential):** Subtract usable solar units from the total consumption. Re-calculate the bill using the lowest telescopic slabs (e.g., pulling consumption out of the ₹11.21/unit slab down into the ₹3.46/unit slab).
5. **Evaluate ToD Limitations (Commercial/Industrial):** Ensure the model does not offset evening peak consumption (17:00-24:00) with banked solar units. Flag this as a constraint and pitch a battery storage add-on if evening usage is high.
6. **Calculate Final Savings:** *Pre-Solar Bill* minus *Post-Solar Bill (Residual Energy Charges + Fixed Charges + Duties on residual)* = **Monthly Savings**.
7. **Apply Subsidies (If Residential):** Apply the ₹78,000 PM Surya Ghar subsidy to the gross system cost before calculating payback period.
8. **Generate Recommendations:** Provide actionable tips, such as shifting heavy appliance usage (e.g., water pumps, ACs) to the 09:00-17:00 solar window to maximize behind-the-meter consumption and avoid banking losses.
