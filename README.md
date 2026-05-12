# Pune Solar Calculator

Local V1 of the rooftop solar calculator and internal estimator.

## Run Locally

```powershell
python -m http.server 5173
```

Open:

```text
http://localhost:5173
```

If your local npm installation is healthy, this also works:

```powershell
npm run serve
```

## Internal Mode

Internal Mode asks you to set a browser-local passphrase on first use.

This is only a V1 local gate. Static hosting cannot protect internal features with real secrecy, so use proper authentication before public deployment.

## Test

```powershell
npm test
```

## Current Scope

- Easy customer-friendly calculator
- Password-gated Internal mode
- On-grid, hybrid, and off-grid with grid charging comparison
- DCR and non-DCR pricing
- PM Surya Ghar subsidy logic
- Editable pricing, tariff, performance, backup, and loss assumptions
- On-screen cost breakup and eligibility notes

PDF generation, saved estimates, bill OCR, admin-managed product catalog, and real authentication are planned for later versions.
