import fs from 'fs';
import { JSDOM } from 'jsdom';

const html = fs.readFileSync('index.html', 'utf-8');
const dom = new JSDOM(html, { runScripts: "dangerously", resources: "usable" });

// We simulate module loading
const appJsCode = fs.readFileSync('src/app.js', 'utf-8');
const configJsCode = fs.readFileSync('src/config.js', 'utf-8');
const calculatorJsCode = fs.readFileSync('src/calculator.js', 'utf-8');
const billParserJsCode = fs.readFileSync('src/billParser.js', 'utf-8');
const ocrExtractorJsCode = fs.readFileSync('src/ocrExtractor.js', 'utf-8');

try {
  // Try evaluating the code as one big chunk replacing imports to find syntax/reference errors
  console.log("Checking for errors in DOM environment...");
  const window = dom.window;
  const document = window.document;
  const navigator = window.navigator;

  // Let's just find out if there's any obvious error
  // Let's manually trigger attachEvents to see if it throws
  const script = document.createElement('script');
  script.type = 'module';
  script.textContent = `
    import './src/app.js';
  `;
  document.body.appendChild(script);

  setTimeout(() => {
    console.log("Errors:", window.errors || 'None');
  }, 1000);

} catch (err) {
  console.error("Caught:", err);
}
