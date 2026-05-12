import fs from 'fs';

let content = fs.readFileSync('index.html', 'utf-8');

const replacement = `      <section class="input-panel" aria-label="Customer and site inputs">
        <div id="wizardNav" class="wizard-nav">
          <div class="wizard-step-dot active" id="navStep1">1. Contact</div>
          <div class="wizard-step-dot" id="navStep2">2. Energy</div>
          <div class="wizard-step-dot" id="navStep3">3. Site</div>
        </div>

        <!-- STEP 1 -->
        <div id="step1" class="wizard-step active">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Step 1</p>
              <h2>Customer basics</h2>
            </div>
            <button class="ghost-button" id="resetButton" type="button">Reset</button>
          </div>

          <div class="field-grid">
            <label class="field">
              <span>Customer name</span>
              <input id="customerName" type="text" placeholder="Optional">
            </label>
            <label class="field">
              <span>Mobile number <span style="color: var(--danger)">*</span></span>
              <input id="mobileNumber" type="tel" placeholder="Required" required>
            </label>
            <label class="field">
              <span>Email address</span>
              <input id="emailAddress" type="email" placeholder="Optional">
            </label>
          </div>
          
          <div class="wizard-actions">
            <div></div> <!-- Spacer -->
            <button class="primary-button" type="button" onclick="window.goToStep(2)">Next: Energy →</button>
          </div>
        </div>

        <!-- STEP 2 -->
        <div id="step2" class="wizard-step hidden">
          <div class="section-heading">
            <div>
              <p class="eyebrow">Step 2</p>
              <h2>Energy profile</h2>
            </div>
          </div>

          <label class="upload-zone" for="billUpload">
            <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <input id="billUpload" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif,.txt,.csv">
            <span class="upload-title">Attach electricity bill</span>
            <span class="upload-formats">PDF, JPG, PNG, TXT, CSV — scanned images use AI-powered OCR</span>
            <span id="billUploadStatus"></span>
          </label>

          <div id="billExtractPanel" class="extract-panel hidden">
            <div class="section-heading compact">
              <div>
                <p class="eyebrow">Bill extraction</p>
                <h2>Detected fields</h2>
              </div>
              <button class="ghost-button" id="applyExtractedBill" type="button">Apply</button>
            </div>

            <div class="extract-grid">
              <div><span>File Name</span><strong id="extractedFileName">-</strong></div>
              <div><span>Name</span><strong id="extractedName">-</strong></div>
              <div><span>Address</span><strong id="extractedAddress">-</strong></div>
              <div><span>Bill Month</span><strong id="extractedBillMonth">-</strong></div>
              <div><span>Sanction Load</span><strong id="extractedSanctionLoad">-</strong></div>
              <div><span>Bill Amount</span><strong id="extractedBillAmount">-</strong></div>
              <div><span>Units Consumed</span><strong id="extractedUnits">-</strong></div>
              <div><span>Yearly Avg Unit</span><strong id="extractedYearlyAvg">-</strong></div>
            </div>

            <p id="billExtractWarnings" class="muted small"></p>
          </div>

          <div class="field-grid mt-4" style="margin-top: 1.5rem;">
            <label class="field">
              <span>Monthly units</span>
              <input id="monthlyUnits" type="number" min="0" step="1" value="450">
            </label>
            <label class="field">
              <span>Monthly bill amount</span>
              <input id="monthlyBill" type="number" min="0" step="100" value="5200">
            </label>
            <label class="field">
              <span>Sanctioned load</span>
              <input id="sanctionedLoad" type="number" min="0" step="0.5" value="5">
            </label>
          </div>

          <div class="wizard-actions">
            <button class="ghost-button" type="button" onclick="window.goToStep(1)">← Back</button>
            <button class="primary-button" type="button" onclick="window.goToStep(3)">Next: Site →</button>
          </div>
        </div>

        <!-- STEP 3 -->
        <div id="step3" class="wizard-step hidden">
          <div class="section-heading compact">
            <div>
              <p class="eyebrow">Step 3</p>
              <h2>Site & Goals</h2>
            </div>
            <button class="ghost-button" id="fetchLocationButton" type="button" title="Fetch current coordinates">Auto-fetch</button>
          </div>

          <div class="field-grid">
            <label class="field">
              <span>Usable roof area</span>
              <input id="roofArea" type="number" min="0" step="10" value="650">
            </label>
            <label class="field">
              <span>Goal</span>
              <select id="goal">
                <option value="maximumSavings">Maximum savings</option>
                <option value="backupSupport">Backup support</option>
                <option value="lowestUpfront">Lowest upfront cost</option>
                <option value="bestRoi">Best long-term ROI</option>
              </select>
            </label>
            <label class="field">
              <span>Coordinates (Lat, Lng)</span>
              <input id="coordinates" type="text" placeholder="e.g. 18.52, 73.85">
            </label>
            <label class="field">
              <span>Tilt Angle (°)</span>
              <input id="tiltAngle" type="number" min="0" max="90" step="1" placeholder="Auto (Lat)">
            </label>
            <label class="field">
              <span>Orientation</span>
              <select id="orientationDir">
                <option value="South">South (Optimal)</option>
                <option value="SouthEast">South-East</option>
                <option value="SouthWest">South-West</option>
                <option value="East">East</option>
                <option value="West">West</option>
                <option value="North">North (High Loss)</option>
              </select>
            </label>
          </div>

          <div class="toggle-row" style="margin-top: 1.5rem;">
            <label class="check-row">
              <input id="backupNeeded" type="checkbox" checked>
              <span>Customer wants backup comparison</span>
            </label>
            <label class="check-row">
              <input id="customerView" type="checkbox" checked>
              <span>Customer view</span>
            </label>
          </div>

          <div class="wizard-actions">
            <button class="ghost-button" type="button" onclick="window.goToStep(2)">← Back</button>
            <button class="primary-button" type="button" onclick="window.finishWizard()">View Results ✓</button>
          </div>
        </div>

        <div id="internalPanel" class="internal-panel hidden">`;

const startMarker = '<section class="input-panel" aria-label="Customer and site inputs">';
const endMarker = '<div id="internalPanel" class="internal-panel hidden">';

const startIdx = content.indexOf(startMarker);
const endIdx = content.indexOf(endMarker);

if (startIdx !== -1 && endIdx !== -1) {
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx + endMarker.length);
}

// Add the logo into the header
const headerLogoMatch = '<div class="logo">';
const headerLogoReplacement = `<div class="logo" style="display: flex; align-items: center; gap: 1rem;">
        <img src="https://bfkxdpripwjxenfvwpfu.supabase.co/storage/v1/object/public/Logo/DC_Energyfull_black_bg_.png" alt="DC Energy Logo" style="height: 40px; border-radius: 4px;">
        <div>`;
content = content.replace(headerLogoMatch, headerLogoReplacement).replace('<h1>Solar Calculator</h1>\n      </div>', '<h1>Solar Calculator</h1>\n        </div>\n      </div>');

fs.writeFileSync('index.html', content, 'utf-8');
console.log('HTML updated successfully');
