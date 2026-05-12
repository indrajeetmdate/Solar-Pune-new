import assert from "node:assert/strict";
import { parseMsebBillText } from "../src/billParser.js";

const sampleText = `
Bill Units Bill AmountBill Demand
BILLING HISTORY
19Mar-2026 108 9165.69
19Feb-2026 262 10517.20
19Jan-2026 181 9807.50
19Dec-2025 164 16663.38
0Nov-2025 0
S.NO.2/1 SAMPLE ESTATE PUNE CITY PUNE Pune
50.00 47.00
170360888412
ABC ENGINEERING PROP SAMPLE OWNER
RASTAPETH (U) CIRCLE - 519 PARVATI DIVISION - 310 WADGAON SUB-DN. - 677 BU 4677
Apr-2026
Maharashtra State Electricity Distribution Co. Ltd.
BILL OF SUPPLY FOR THE MONTH
Bill No: 000003331446972
10360.00
10240.00
10530.00
Sanctioned Load :
BILLING DETAILS
30/04/2026
31/03/2026 602.822
476.00 505.00 48.00 12.00 12.00
1079.296
7980.00
TEN THOUSAND THREE HUNDRED SIXTY ONLY
Consumer No. : 170360888412
CURRENT CONSUMPTION DETAILS
`;

const result = parseMsebBillText(sampleText, { fileName: "170360888412.pdf" });

assert.equal(result.fields.fileName, "170360888412.pdf");
assert.equal(result.fields.consumerNo, "170360888412");
assert.equal(result.fields.name, "ABC ENGINEERING PROP SAMPLE OWNER");
assert.equal(result.fields.address, "S.NO.2/1 SAMPLE ESTATE PUNE CITY PUNE Pune");
assert.equal(result.fields.billMonth, "Apr-2026");
assert.equal(result.fields.sanctionedLoadKw, 50);
assert.equal(result.fields.billAmountRs, 10360);
assert.equal(result.fields.unitsConsumedKwh, 1079.296);
assert.equal(result.fields.yearlyAvgUnitsKwh, 178.75);
assert.ok(result.confidence >= 90);

console.log("bill parser tests passed");
