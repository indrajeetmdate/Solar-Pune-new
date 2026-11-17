import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

test("Solar Calculator - Cloned User Authentication, Customer Mode & Solar CRM Suite", async (t) => {
  const htmlPath = path.join(projectRoot, "index.html");
  const htmlContent = fs.readFileSync(htmlPath, "utf-8");

  // Create isolated DOM environment
  const dom = new JSDOM(htmlContent, {
    url: "http://localhost:5173",
    runScripts: "dangerously",
    resources: "usable",
    pretendToBeVisual: true
  });

  const { window } = dom;
  const { document, localStorage } = window;

  // Mock essential canvas and layout methods for JSDOM
  if (!window.HTMLCanvasElement.prototype.getContext) {
    window.HTMLCanvasElement.prototype.getContext = () => ({
      clearRect: () => {},
      beginPath: () => {},
      rect: () => {},
      arc: () => {},
      fill: () => {},
      stroke: () => {},
      drawImage: () => {},
      save: () => {},
      restore: () => {},
      translate: () => {},
      rotate: () => {},
      scale: () => {},
      setLineDash: () => {},
      measureText: () => ({ width: 50 }),
      fillText: () => {},
      strokeText: () => {}
    });
  }

  // Setup globals for module loading
  global.window = window;
  global.document = document;
  global.localStorage = localStorage;
  global.alert = () => {};
  window.alert = () => {};

  // Import CRM module
  const crmModule = await import("../src/crm.js");
  const {
    CLONED_APP_USERS,
    CRM_STATUS_MAP,
    authenticateInternalUser,
    fetchCrmLeads,
    saveCrmLeadLocallyAndRemote,
    addNoteToLead,
    deleteCrmLeadById
  } = crmModule;

  // Import main app module
  const appModule = await import("../src/app.js");

  await t.test("1. Enterprise Cloned User Authentication", async () => {
    // Verify cloned users list
    assert.equal(CLONED_APP_USERS.length, 13, "Must clone all 13 enterprise users from database");
    
    const adminUser = CLONED_APP_USERS.find(u => u.username === "indrajeet.date@cnergy.co.in");
    assert.ok(adminUser, "Indrajeet Date must exist in cloned users");
    assert.equal(adminUser.role, "admin");

    const billingUser = CLONED_APP_USERS.find(u => u.username === "anujmagdum@cnergy.co.in");
    assert.ok(billingUser, "Anuj Magdum must exist in cloned users");
    assert.equal(billingUser.role, "billing");

    // Test valid credentials for admin
    const auth1 = await authenticateInternalUser("indrajeet.date@cnergy.co.in", "thisisbusiness");
    assert.equal(auth1.success, true, "Valid admin credentials must authenticate successfully");
    assert.equal(auth1.user.username, "indrajeet.date@cnergy.co.in");
    assert.equal(auth1.user.name, "Indrajeet Date");
    assert.equal(auth1.user.password, undefined, "Password must not be returned in user session");

    // Test valid credentials for billing
    const auth2 = await authenticateInternalUser("anujmagdum@cnergy.co.in", "anujmagdum2744");
    assert.equal(auth2.success, true, "Valid billing user credentials must authenticate successfully");
    assert.equal(auth2.user.role, "billing");

    // Test valid credentials for sales/user
    const auth3 = await authenticateInternalUser("santosh@cnergy.co.in", "12345678");
    assert.equal(auth3.success, true, "Valid sales user credentials must authenticate successfully");

    // Test invalid password
    const authInvalid = await authenticateInternalUser("indrajeet.date@cnergy.co.in", "wrongPassword");
    assert.equal(authInvalid.success, false, "Invalid password must be rejected");

    // Test legacy passphrase shortcut for backward compatibility
    const authLegacy = await authenticateInternalUser("solar2026", "solar2026");
    assert.equal(authLegacy.success, true, "Legacy passphrase 'solar2026' must unlock session");
  });

  await t.test("2. Customer Mode ('Make Your Own Estimate') Isolation & Local-Only Persistence", async () => {
    // Switch to customer mode
    window.setCustomerMode();

    const easyBtn = document.getElementById("easyModeButton");
    const intBtn = document.getElementById("internalModeButton");
    const userBadge = document.getElementById("loggedInUserBadge");

    assert.ok(easyBtn.classList.contains("active"), "Customer mode button must be active");
    assert.ok(!intBtn.classList.contains("active"), "Internal mode button must NOT be active in customer mode");
    assert.equal(userBadge.style.display, "none", "User session badge must be hidden in customer mode");

    // Verify Engineering Suite tabs are strictly hidden from customers
    const cadTabBtn = document.getElementById("workspaceTabCadBtn");
    const propTabBtn = document.getElementById("workspaceTabProposalBtn");
    const bldgTabBtn = document.getElementById("workspaceTabBuildingBtn");
    const crmTabBtn = document.getElementById("workspaceTabCrmBtn");

    assert.equal(cadTabBtn.style.display, "none", "Rooftop CAD tab MUST be hidden in Customer Mode");
    assert.equal(propTabBtn.style.display, "none", "Proposal & Export customization MUST be hidden in Customer Mode");
    assert.equal(bldgTabBtn.style.display, "none", "Society Building Studio tab MUST be hidden in Customer Mode");
    assert.equal(crmTabBtn.style.display, "none", "Solar CRM tab MUST be hidden in Customer Mode");

    // Verify Rooftop CAD pane is strictly hidden and Sizing pane is active in Customer Mode
    const paneCad = document.getElementById("paneCad");
    const paneSizing = document.getElementById("paneSizing");
    assert.equal(paneCad.style.display, "none", "Rooftop CAD pane MUST be display: none in Customer Mode");
    assert.ok(!paneCad.classList.contains("active"), "Rooftop CAD pane must NOT have active class in Customer Mode");
    assert.equal(paneSizing.style.display, "block", "Sizing pane must be visible in Customer Mode");
    assert.ok(paneSizing.classList.contains("active"), "Sizing pane must have active class in Customer Mode");

    // Verify Pricing & System Settings button is strictly hidden from customers
    const sidebarTabRates = document.getElementById("sidebarTabRatesBtn");
    assert.equal(sidebarTabRates.style.display, "none", "Pricing & Settings button must be hidden in Customer Mode");
    const sidebarTabInputs = document.getElementById("sidebarTabInputsBtn");
    assert.ok(sidebarTabInputs.classList.contains("active"), "Project Inputs button must be active in Customer Mode");

    // Verify Customer estimate CTA banner is shown in Sizing
    const custBanner = document.getElementById("customerEstimateCtaBanner");
    assert.notEqual(custBanner.style.display, "none", "Customer CTA banner must be visible in Customer Mode");

    // Verify Server Sync buttons are hidden; Local save/load buttons are visible
    const saveServerBtn = document.getElementById("sidebarSaveProposalBtn");
    const loadServerBtn = document.getElementById("openLoadProposalModalButton");
    const cloneServerBtn = document.getElementById("sidebarCloneProposalBtn");
    const saveCustBtn = document.getElementById("customerSaveLocalBtn");
    const loadCustBtn = document.getElementById("customerLoadLocalBtn");

    assert.equal(saveServerBtn.style.display, "none", "Server Save Data button must be hidden in Customer Mode");
    assert.equal(loadServerBtn.style.display, "none", "Server Load Data button must be hidden in Customer Mode");
    assert.equal(cloneServerBtn.style.display, "none", "Server Clone button must be hidden in Customer Mode");
    assert.notEqual(saveCustBtn.style.display, "none", "Customer local Save Estimate button must be visible");
    assert.notEqual(loadCustBtn.style.display, "none", "Customer local Load Estimate button must be visible");

    // Test Customer Local-only saving and loading
    document.getElementById("customerName").value = "Pooja Deshmukh";
    document.getElementById("mobileNumber").value = "9822100000";
    document.getElementById("monthlyBill").value = "4200";
    document.getElementById("monthlyUnits").value = "380";
    document.getElementById("sanctionedLoad").value = "4";

    saveCustBtn.click();

    const savedLocalEstimateRaw = localStorage.getItem("solar_customer_estimate");
    assert.ok(savedLocalEstimateRaw, "Customer estimate must be saved to localStorage");
    const savedLocalEstimate = JSON.parse(savedLocalEstimateRaw);
    assert.equal(savedLocalEstimate.customerName, "Pooja Deshmukh");
    assert.equal(savedLocalEstimate.monthlyBill, "4200");

    // Clear inputs and reload from local storage
    document.getElementById("customerName").value = "Temporary Name";
    document.getElementById("monthlyBill").value = "9999";
    
    loadCustBtn.click();

    assert.equal(document.getElementById("customerName").value, "Pooja Deshmukh", "Local load must restore customer name");
    assert.equal(document.getElementById("monthlyBill").value, "4200", "Local load must restore monthly bill");
  });

  await t.test("3. Internal Mode Switch & Enterprise Authentication Workflow", async () => {
    // Open internal dialog
    window.openInternalDialog();
    const pwdDialog = document.getElementById("passwordDialog");
    assert.notEqual(pwdDialog.style.display, "none", "Login dialog must be visible");

    // Select Indrajeet Date from quick dropdown
    const quickSelect = document.getElementById("loginUserQuickSelect");
    quickSelect.value = "indrajeet.date@cnergy.co.in";
    quickSelect.dispatchEvent(new window.Event("change"));

    assert.equal(document.getElementById("internalUsername").value, "indrajeet.date@cnergy.co.in", "Quick select must prefill username");

    // Enter wrong password
    document.getElementById("internalPassword").value = "badpass";
    await window.unlockInternal();
    const errEl = document.getElementById("passwordError");
    assert.ok(!errEl.classList.contains("hidden"), "Password error message must appear on failed login");

    // Enter correct password and unlock
    document.getElementById("internalPassword").value = "thisisbusiness";
    await window.unlockInternal();

    assert.equal(pwdDialog.style.display, "none", "Login dialog must close on successful authentication");
    assert.ok(document.getElementById("internalModeButton").classList.contains("active"), "Internal mode button must be active");

    // Check user session badge in header
    const userBadge = document.getElementById("loggedInUserBadge");
    const userNameSpan = document.getElementById("loggedInUserName");
    assert.notEqual(userBadge.style.display, "none", "User session badge must be visible in header");
    assert.ok(userNameSpan.textContent.includes("Indrajeet Date"), "User session badge must show authenticated user's name");

    // Verify Engineering Suite tabs are unlocked for internal users
    assert.notEqual(document.getElementById("workspaceTabCadBtn").style.display, "none", "Rooftop CAD tab must be visible for internal team");
    assert.notEqual(document.getElementById("workspaceTabProposalBtn").style.display, "none", "Proposal & Export tab must be visible for internal team");
    assert.notEqual(document.getElementById("workspaceTabCrmBtn").style.display, "none", "Solar CRM tab must be visible for internal team");

    // Verify Server Sync buttons are visible; local customer buttons are hidden
    assert.notEqual(document.getElementById("sidebarSaveProposalBtn").style.display, "none", "Server Save button must be visible for internal team");
    assert.notEqual(document.getElementById("openLoadProposalModalButton").style.display, "none", "Server Load button must be visible for internal team");
    assert.equal(document.getElementById("customerSaveLocalBtn").style.display, "none", "Customer local save button must be hidden in internal mode");

    // Verify internal login switches to CRM as landing home screen from the top
    const paneCrm = document.getElementById("paneCrm");
    assert.ok(paneCrm.classList.contains("active"), "CRM pane must be active on internal login");
    assert.equal(paneCrm.style.display, "block", "CRM pane must be visible on internal login");

    // Verify Pricing & System Settings button is unlocked and visible in internal mode
    const sidebarTabRates = document.getElementById("sidebarTabRatesBtn");
    assert.notEqual(sidebarTabRates.style.display, "none", "Pricing & Settings button must be visible in internal mode");
    const sidebarTabInputs = document.getElementById("sidebarTabInputsBtn");
    assert.ok(sidebarTabInputs.classList.contains("active"), "Project Inputs button must be active by default");

    // Verify CRM Bottom Proposal Navigation Banner & Enter Proposals Screen button
    const crmBottomBanner = document.getElementById("crmBottomProposalBanner");
    assert.ok(crmBottomBanner, "CRM bottom proposal action card banner must exist");
    const enterProposalsBtn = document.getElementById("crmBottomEnterProposalsBtn");
    assert.ok(enterProposalsBtn, "Enter Proposals Screen button must exist");
    enterProposalsBtn.click();
    assert.ok(document.getElementById("paneProposal").classList.contains("active"), "Clicking Enter Proposals button must navigate to proposal screen");

    // Test '+ Start New Proposal' button at bottom of CRM
    const newProposalBtn = document.getElementById("crmBottomNewProposalBtn");
    assert.ok(newProposalBtn, "Start New Proposal button must exist");
    newProposalBtn.click();
    assert.ok(document.getElementById("paneSizing").classList.contains("active"), "Clicking Start New Proposal must switch to sizing screen");

    // Test Sidebar Sub-Filters for Project Inputs (1. Required, 2. Not Required, 3. More Details, All)
    const subFilterReq = document.getElementById("subFilterReqBtn");
    const subFilterNotReq = document.getElementById("subFilterNotReqBtn");
    const subFilterMore = document.getElementById("subFilterMoreBtn");
    const subFilterAll = document.getElementById("subFilterAllBtn");
    const reqGroup = document.getElementById("requiredFieldsGroup");
    const notReqGroup = document.getElementById("notRequiredFieldsGroup");
    const advDrawer = document.getElementById("advancedOptionsDrawer");

    // 1. Required filter
    subFilterReq.click();
    assert.notEqual(reqGroup.style.display, "none", "Required fields must be visible under '1. Required' filter");
    assert.equal(notReqGroup.style.display, "none", "Not required fields must be hidden under '1. Required' filter");
    assert.equal(advDrawer.style.display, "none", "More details must be hidden under '1. Required' filter");

    // 2. Not Required filter
    subFilterNotReq.click();
    assert.equal(reqGroup.style.display, "none", "Required fields must be hidden under '2. Not Required' filter");
    assert.notEqual(notReqGroup.style.display, "none", "Not required fields must be visible under '2. Not Required' filter");
    assert.equal(advDrawer.style.display, "none", "More details must be hidden under '2. Not Required' filter");

    // 3. More Details filter
    subFilterMore.click();
    assert.equal(reqGroup.style.display, "none", "Required fields must be hidden under '3. More Details' filter");
    assert.equal(notReqGroup.style.display, "none", "Not required fields must be hidden under '3. More Details' filter");
    assert.notEqual(advDrawer.style.display, "none", "Advanced drawer must be visible under '3. More Details' filter");
    assert.equal(advDrawer.open, true, "Advanced drawer must be open under '3. More Details' filter");

    // All filter
    subFilterAll.click();
    assert.notEqual(reqGroup.style.display, "none", "Required fields must be visible under 'All' filter");
    assert.notEqual(notReqGroup.style.display, "none", "Not required fields must be visible under 'All' filter");
    assert.notEqual(advDrawer.style.display, "none", "More details must be visible under 'All' filter");

    // Switch between Project Inputs and Pricing & Settings
    sidebarTabRates.click();
    assert.equal(document.getElementById("catSectionRates").style.display, "block", "Pricing & Settings category must be visible when clicked");
    assert.equal(document.getElementById("catSectionContact").style.display, "none", "Project Inputs category must be hidden when Pricing & Settings is active");
    assert.equal(document.getElementById("sidebarSubFilterRow").style.display, "none", "Sub-filters must be hidden in Pricing & Settings view");

    sidebarTabInputs.click();
    assert.equal(document.getElementById("catSectionContact").style.display, "block", "Project Inputs category must be visible when clicked");
    assert.equal(document.getElementById("catSectionRates").style.display, "none", "Pricing & Settings must be hidden when Project Inputs is active");
    assert.notEqual(document.getElementById("sidebarSubFilterRow").style.display, "none", "Sub-filters must be visible in Project Inputs view");
  });

  await t.test("4. Solar CRM Leads Management, Status Workflow & Notes Timeline", async () => {
    // Open CRM tab and render
    document.getElementById("workspaceTabCrmBtn").click();
    await window.renderCrmDashboard();

    // Check KPI Ribbon elements
    const kpiTotal = document.getElementById("crmKpiTotalLeads");
    const kpiVisits = document.getElementById("crmKpiVisitsDone");
    const kpiProps = document.getElementById("crmKpiProposalsSent");
    const kpiWon = document.getElementById("crmKpiWon");
    const kpiVal = document.getElementById("crmKpiPipelineVal");

    assert.ok(Number(kpiTotal.textContent) >= 4, "Must show at least 4 initial CRM leads");
    assert.ok(Number(kpiVisits.textContent) >= 1, "Must show Site Visits Done count");
    assert.ok(Number(kpiProps.textContent) >= 1, "Must show Proposals Sent count");
    assert.ok(kpiVal.textContent.includes("₹"), "Pipeline value must be formatted with ₹ symbol");

    // Check leads table rows
    const tbody = document.getElementById("crmLeadsTableBody");
    assert.ok(tbody.children.length >= 4, "Leads table must render lead rows");

    // Filter by 'site_visit_done' tab
    const visitDoneTab = document.querySelector('.crm-filter-btn[data-filter="site_visit_done"]');
    assert.ok(visitDoneTab, "Site Visit Done filter tab must exist");
    visitDoneTab.click();
    await window.renderCrmDashboard("site_visit_done");

    await new Promise(r => setTimeout(r, 50));
    const filteredRows = tbody.querySelectorAll("tr");
    assert.ok(filteredRows.length >= 1, "Filtered table must show only Site Visit Done leads");

    // Change status of first lead to 'proposal_sent'
    const statusSelect = tbody.querySelector(".crm-status-select");
    assert.ok(statusSelect, "Lead row must have status select dropdown");
    const leadId = statusSelect.dataset.leadId;
    
    await window.handleCrmStatusChange(leadId, "proposal_sent");
    const leadsAfterStatus = await fetchCrmLeads();
    const updatedLead = leadsAfterStatus.find(l => l.id === leadId);
    assert.equal(updatedLead.status, "proposal_sent", "Lead status must be updated to proposal_sent");

    // Add note to lead
    await addNoteToLead(leadId, "Customer approved 3.3kW layout. Sent draft proposal.", "Indrajeet Date", "proposal_sent");
    const leadsAfterNote = await fetchCrmLeads();
    const leadWithNote = leadsAfterNote.find(l => l.id === leadId);
    assert.ok(leadWithNote.notes.some(n => n.text.includes("Customer approved 3.3kW layout")), "Timeline must contain newly added note");

    // Create a new lead via CRM New Lead Modal
    document.getElementById("newLeadName").value = "Amit Deshpande";
    document.getElementById("newLeadPhone").value = "9822998877";
    document.getElementById("newLeadEmail").value = "amit@deshpande.net";
    document.getElementById("newLeadAddress").value = "Kothrud, Pune";
    document.getElementById("newLeadCapacity").value = "5.0";
    document.getElementById("newLeadNotes").value = "Customer requested rooftop solar quotation.";

    await window.submitCrmNewLead();

    const leadsAfterNew = await fetchCrmLeads();
    const created = leadsAfterNew.find(l => l.customer_name === "Amit Deshpande");
    assert.ok(created, "Newly created lead must exist in CRM leads registry");
    assert.equal(created.mobile_number, "9822998877");
    assert.equal(created.status, "lead");

    // Test 1-click loading lead into Proposal Maker
    await window.loadLeadIntoProposalMaker(created.id);

    assert.equal(document.getElementById("customerName").value, "Amit Deshpande", "Customer Name must be loaded into proposal inputs");
    assert.equal(document.getElementById("mobileNumber").value, "9822998877", "Mobile number must be loaded into proposal inputs");
    assert.equal(document.getElementById("customerAddress").value, "Kothrud, Pune", "Customer address must be loaded into proposal inputs");
  });

  await t.test("5. CRM Previous Proposals Archive Table", async () => {
    // Save sample proposal to local storage
    const sampleProposal = {
      id: "prop-arch-001",
      proposalSerialNo: "DC/2026-27/PROP-9999",
      customerName: "Sanjay Kulkarni",
      mobileNumber: "9822554433",
      customerAddress: "Aundh, Pune",
      sanctionedLoad: 6,
      systemCapacityKw: 4.4,
      totalCost: 260000,
      savedAt: new Date().toISOString(),
      stateData: {
        formValues: { customerName: "Sanjay Kulkarni" },
        input: { customerName: "Sanjay Kulkarni", mobileNumber: "9822554433" }
      }
    };
    localStorage.setItem("solar_saved_proposals", JSON.stringify([sampleProposal]));

    // Open CRM archive tab
    const archiveTab = document.querySelector('.crm-filter-btn[data-filter="proposals_archive"]');
    assert.ok(archiveTab, "Proposals Archive tab must exist");
    archiveTab.click();

    await new Promise(r => setTimeout(r, 50));

    const archiveWrapper = document.getElementById("crmProposalsTableWrapper");
    assert.notEqual(archiveWrapper.style.display, "none", "Proposals archive table must be displayed");

    const archiveBody = document.getElementById("crmProposalsTableBody");
    assert.ok(archiveBody.children.length >= 1, "Archive table must list saved proposals");
    assert.ok(archiveBody.innerHTML.includes("DC/2026-27/PROP-9999"), "Archive table must display proposal serial number");
    assert.ok(archiveBody.innerHTML.includes("Sanjay Kulkarni"), "Archive table must display customer name");
  });

  await t.test("6. Customer Free Site Visit Request Submission", async () => {
    // Switch back to customer mode
    window.setCustomerMode();

    // Trigger site visit modal
    window.openCustomerSiteVisitModal();
    const modal = document.getElementById("customerSiteVisitModal");
    assert.notEqual(modal.style.display, "none", "Site visit modal must open");

    document.getElementById("custModalName").value = "Deepak Gokhale";
    document.getElementById("custModalPhone").value = "9822334455";
    document.getElementById("custModalAddress").value = "Shivaji Nagar, Pune";
    document.getElementById("custModalNotes").value = "Available on Sunday morning for rooftop inspection.";

    await window.submitCustomerSiteVisitRequest();

    assert.equal(modal.style.display, "none", "Site visit modal must close after submission");

    const leads = await fetchCrmLeads();
    const siteVisitLead = leads.find(l => l.customer_name === "Deepak Gokhale");
    assert.ok(siteVisitLead, "Site visit request must be recorded as a CRM lead");
    assert.equal(siteVisitLead.mobile_number, "9822334455");
    assert.ok(siteVisitLead.notes.some(n => n.text.includes("Customer requested free site survey")), "Note must record online portal request");
  });
});
