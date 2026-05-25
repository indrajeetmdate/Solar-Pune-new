# Replicating Gemini PDF Bill Extraction in Your Application

This comprehensive guide provides all the necessary steps, code snippets, and gotchas to integrate the Gemini-powered PDF parsing feature into a React + Node.js (Express) application. 

This specific implementation handles:
* Converting physical PDF files to base64 for API transmission
* Multimodal vision prompting via the `@google/genai` SDK
* Automatic regional language translation to English (Marathi used as an example)
* Structured JSON extraction

---

## Architecture Overview
1. **Frontend (React)**: Captures the PDF file, reads it into a Base64 string using the HTML5 `FileReader` API, and sends it to your backend.
2. **Backend (Express)**: Validates the payload, prepares a strict instructional prompt for Gemini (including translation rules), and passes the Base64 file via `inlineData`. It enforces a JSON output using `responseMimeType: "application/json"`.

---

## Step 1: Backend Setup

### Prerequisites
Make sure you have the official Google Gen AI SDK installed in your backend project:
```bash
npm install @google/genai express
```

### 1.1 Express Body Parser configuration
PDF base64 strings can easily exceed the default 100kb limit in Express. You **must** increase the JSON body parser limit.

```typescript
import express from 'express';
import { GoogleGenAI } from '@google/genai';

const app = express();

// INCREASE LIMIT: Crucial for handling large base64 PDF uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
```

### 1.2 The API Route (`/api/extract-pdf`)
This endpoint accepts the base64 string, sets up the prompt with a glossary (to guarantee robust translation of local language bills), and requests `application/json` output.

```typescript
app.post("/api/extract-pdf", async (req, res) => {
  try {
    const { base64Data, mimeType } = req.body;
    if (!base64Data) {
      return res.status(400).json({ error: "No file data provided." });
    }

    if (mimeType !== "application/pdf") {
       return res.status(400).json({ error: "Only PDF files are supported." });
    }

    // 1. Construct a highly specific prompt. 
    //    Include a translation glossary for regional bills (e.g. Marathi -> English)
    const prompt = `Extract all relevant billing data from this electricity bill PDF.
    
    IMPORTANT: The bill may be partially or fully in Marathi. You must automatically translate all Marathi terms into standard English electricity billing terminology.
    Do not use literal translations (e.g., "आकार" should be translated as "Charge", not "Size").
    
    Here is a glossary to help you translate accurately:
    - स्थिर आकार -> Fixed Charge
    - वीज आकार -> Power Charge
    - वहन आकार -> Wheeling Charge
    - इंधन समायोजन आकार -> Fuel Adjustment Charge
    - वीज शुल्क -> Electricity Duty / Charges
    - चालू वीज देयक (रु.) -> Current Electricity Bill (Rs.)
    - निवडक थकबाकी/जमा -> Net Outstanding
    - एकूण थकबाकी/जमा -> Total Outstanding
    - देयकाची निव्वळ रक्कम -> Net Payable Amount

    Please include standard fields like:
    - Consumer Number
    - BU Number
    - Consumer Name
    - Billing Month
    - Due Date
    - Total Amount Due
    - A comprehensive breakdown of the charges listed above.
    
    Format the output as a clean, nested JSON object.`;

    // 2. Call the Gemini API with Multimodal Input
    // We use "gemini-2.5-flash" (or gemini-1.5-flash) for vision and text tasks.
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: "application/pdf"
              }
            },
            { text: prompt }
          ]
        }
      ],
      config: {
        // Enforce JSON output globally
        responseMimeType: "application/json",
        temperature: 0.0 // Keep temperature low to prevent hallucinated numbers
      }
    });

    // 3. Parse and return the result
    let jsonResult;
    try {
      jsonResult = JSON.parse(response.text);
    } catch (e) {
      // Fallback in case the model failed to output pure JSON
      jsonResult = { rawText: response.text };
    }

    return res.json({ data: jsonResult });
  } catch (error: any) {
    console.error("PDF Extraction error:", error);
    return res.status(500).json({ error: error.message || "Failed to process PDF" });
  }
});
```

---

## Step 2: Frontend Setup (React)

The frontend needs an `<input type="file" />` that converts the chosen abstract `File` object into a Base64 string that can be sent over HTTP JSON.

### 2.1 Creating the React Component

```tsx
import React, { useState, useRef } from 'react';

export default function PdfUploader() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [extractedData, setExtractedData] = useState<any>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      setError("Please upload a valid PDF file.");
      return;
    }

    setLoading(true);
    setError('');

    try {
      const reader = new FileReader();
      
      // When the reader finishes parsing the local file...
      reader.onloadend = async () => {
        // reader.result gives us a Data URL: "data:application/pdf;base64,JVBERi0xLjQK..."
        // We MUST strip the prefix before sending to Gemini.
        const base64String = (reader.result as string).split(',')[1];
        
        try {
          const response = await fetch('/api/extract-pdf', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64Data: base64String,
              mimeType: file.type
            })
          });

          const resData = await response.json();
          if (!response.ok) throw new Error(resData.error || 'Failed to extract PDF data');
          
          setExtractedData(resData.data);
        } catch (err: any) {
          setError(err.message || 'Error occurred during backend extraction');
        } finally {
          setLoading(false);
          // Reset file input so you can upload the same file again if needed
          if (fileInputRef.current) fileInputRef.current.value = '';
        }
      };
      
      reader.onerror = () => {
        setError("Failed to read file.");
        setLoading(false);
      }
      
      // Start reading the file
      reader.readAsDataURL(file);

    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-lg mx-auto bg-white rounded-xl shadow-md space-y-4">
      <h2 className="text-xl font-semibold">Upload Electricity Bill</h2>
      
      {/* Hidden input - accessible via button click referencing the ref */}
      <input 
        type="file" 
        accept=".pdf,application/pdf"
        className="hidden"
        ref={fileInputRef}
        onChange={handlePdfUpload}
      />
      
      <button 
        onClick={() => fileInputRef.current?.click()}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
      >
        {loading ? 'Analyzing with Gemini...' : 'Select PDF File'}
      </button>

      {error && (
        <div className="p-3 bg-red-100 text-red-700 rounded border border-red-200">
          {error}
        </div>
      )}

      {extractedData && (
        <div className="mt-4 p-4 bg-gray-50 border rounded-lg">
          <h3 className="font-semibold mb-2">Extracted Data:</h3>
          <pre className="text-xs overflow-auto">
            {JSON.stringify(extractedData, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
```

---

## 💡 Important Best Practices & Gotchas

1. **`responseMimeType: "application/json"` ensures clean output**
   Prior to this feature, models would wrap markdown around the JSON (e.g. ` ```json {...} ``` `). Using `responseMimeType` guarantees pure JSON output, making `JSON.parse` safe.

2. **Base64 Prefix**
   When utilizing JavaScript's `FileReader.readAsDataURL()`, the resulting string comes formatted as `data:application/pdf;base64,xxxxxxx...`. The Gemini backend expects exactly what's *after* the comma. Always split and isolate the raw Base64:
   ```javascript
   const base64String = readerResult.split(',')[1];
   ```

3. **Provide a glossary for Regional Labels**
   If you rely solely on Gemini to translate proprietary/regional layout elements, you run the risk of hallucinated keys across different runs (e.g. yielding `Power Size` instead of `Demand Charge` on one run and `Energy Used` on another). Providing a rigid translation map fixes this constraint entirely.

4. **Temperature Control**
   Always set `temperature: 0.0` when doing Data Extraction. This heavily grounds the model to read exactly what is visibly written in the file, preventing the LLM from inventing or averaging out financial figures when OCR is partially obscured. 
