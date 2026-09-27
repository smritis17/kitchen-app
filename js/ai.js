// Receipt scanning and recipe import.
// - With a free Google Gemini API key (Settings), receipts and recipe links are read by Gemini.
// - Without one, receipts are read with Tesseract OCR in the browser (free, less accurate).
import { CATEGORY_IDS } from "./foods.js";

const TESSERACT_URL = "https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js";
const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models";
// Best model first; if its free daily quota runs out, fall back to the lighter one.
const MODELS = ["gemini-3.8-flash", "gemini-3.5-flash-lite"];
const KEY_STORAGE = "kitchen-gemini-key";

export const getApiKey = () => { try { return localStorage.getItem(KEY_STORAGE) || ""; } catch { return ""; } };
export const setApiKey = (k) => { try { k ? localStorage.setItem(KEY_STORAGE, k) : localStorage.removeItem(KEY_STORAGE); } catch {} };

async function callGemini(model, body) {
  const res = await fetch(`${GEMINI_URL}/${model}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": getApiKey() },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error?.message || `Gemini error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  const cand = data.candidates?.[0];
  if (!cand) throw new Error("Gemini couldn't read this. Try again or enter it manually.");
  const text = (cand.content?.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join("");
  if (!text) throw new Error(cand.finishReason === "SAFETY" ? "Gemini declined to read this." : "Gemini returned nothing. Try again.");
  return text;
}

// Sends the request, falling back to a lighter model when quota runs out. Returns parsed JSON.
async function askGemini(body) {
  let lastErr;
  for (const model of MODELS) {
    try {
      const text = await callGemini(model, body);
      const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1); // tolerate ```json fences
      return JSON.parse(json);
    } catch (e) {
      lastErr = e;
      if (![429, 404, 503].includes(e.status)) break; // only retry for quota / unavailable model
    }
  }
  if (lastErr.status === 429) throw new Error("Free daily limit reached. Try again tomorrow");
  if (lastErr.status === 400 && /api key/i.test(lastErr.message)) throw new Error("Your Gemini API key isn't valid. Check it in ⚙️ Settings");
  throw lastErr;
}

// ---------- images ----------

// Downscale a photo to a JPEG data URL (keeps uploads and stored photos small).
export function resizeImage(file, maxSide = 1000, quality = 0.8) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Couldn't open that image.")); };
    img.src = url;
  });
}

// ---------- receipts ----------

const RECEIPT_SCHEMA = {
  type: "OBJECT",
  properties: {
    items: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          name: { type: "STRING" },
          quantity: { type: "INTEGER" },
          category: { type: "STRING", enum: CATEGORY_IDS },
        },
        required: ["name", "quantity", "category"],
      },
    },
  },
  required: ["items"],
};

const RECEIPT_PROMPT = `This is a photo of a grocery store receipt. List every product that was purchased.

- Expand store abbreviations into the plain, common grocery name a person would write on a shopping list (e.g. "GV WHL MLK GAL" -> "Whole milk", "ORG BNNA" -> "Bananas", "KS ROMA TOM" -> "Roma tomatoes"). Drop brand names unless the brand is the product.
- quantity is the number of units bought (use 1 when unclear; for items sold by weight use 1).
- Merge duplicate lines of the same product by adding their quantities.
- Skip anything that isn't a product: subtotals, totals, tax, discounts, coupons, bag fees, deposits, payment and loyalty lines.
- If the image is not a receipt or is unreadable, return an empty list.`;

export async function scanReceipt(file, onProgress) {
  if (getApiKey()) {
    onProgress?.("Reading receipt with Gemini…");
    const dataUrl = await resizeImage(file, 2000, 0.85);
    const { items } = await askGemini({
      contents: [{
        parts: [
          { inline_data: { mime_type: "image/jpeg", data: dataUrl.split(",")[1] } },
          { text: RECEIPT_PROMPT },
        ],
      }],
      generationConfig: { responseMimeType: "application/json", responseSchema: RECEIPT_SCHEMA },
    });
    return items || [];
  }
  return ocrReceipt(file, onProgress);
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) return resolve();
    const s = document.createElement("script");
    s.src = src; s.onload = resolve; s.onerror = () => reject(new Error("Couldn't load the scanner. Check your connection."));
    document.head.appendChild(s);
  });
}

const NOT_ITEMS = /(sub\s*total|total|tax|change|cash|visa|mastercard|amex|debit|credit|balance|savings|saved|discount|coupon|member|rewards|points|tender|payment|approved|auth|card|bag fee|deposit|thank|receipt|store|cashier|register|items? sold|tel|phone|www|http|date|time)/i;

async function ocrReceipt(file, onProgress) {
  onProgress?.("Loading scanner…");
  await loadScript(TESSERACT_URL);
  const worker = await window.Tesseract.createWorker("eng", 1, {
    logger: (m) => m.status === "recognizing text" && onProgress?.(`Reading receipt… ${Math.round(m.progress * 100)}%`),
  });
  try {
    const dataUrl = await resizeImage(file, 2000, 0.9);
    const { data } = await worker.recognize(dataUrl);
    const items = [];
    for (const raw of data.text.split("\n")) {
      const line = raw.trim();
      if (!/\d+[.,]\d{2}/.test(line) || NOT_ITEMS.test(line)) continue; // item lines end in a price
      let qty = 1;
      const q = line.match(/(\d+)\s*@/) || line.match(/^(\d{1,2})\s+[a-z]/i);
      if (q) qty = Math.max(1, Math.min(24, parseInt(q[1], 10)));
      const name = line
        .replace(/\d+\s*@.*$/, "")
        .replace(/-?\$?\d+[.,]\d{2}.*$/, "") // price and anything after it
        .replace(/^\d+\s+/, "")
        .replace(/\b\d{4,}\b/g, "") // item codes
        .replace(/[^a-z\s&'-]/gi, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (name.length < 3) continue;
      items.push({ name: name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()), quantity: qty, category: "" });
    }
    return items;
  } finally {
    worker.terminate();
  }
}

// ---------- recipe import from a link ----------

export async function importRecipe(url, cuisines) {
  // URL context (reading the page) can't be combined with JSON mode, so the JSON shape is in the prompt.
  const r = await askGemini({
    contents: [{ parts: [{ text: `Read this recipe page and extract the recipe: ${url}

Reply with only a JSON object, no other text, in exactly this shape:
{"title": "", "cuisine": "", "time": "", "servings": "", "image_url": "", "ingredients": [""], "steps": [""]}

- cuisine: pick the best fit from ${cuisines.join(", ")} (or another single word if none fit).
- time: total time, short (e.g. "35 min"); "" if not given. servings: e.g. "4"; "" if not given.
- image_url: the main photo of the finished dish (og:image is ideal), as an absolute URL; "" if none.
- ingredients: one string per ingredient exactly as written with amounts (e.g. "2 cups basmati rice"). Append " (optional)" to optional ones.
- steps: the instructions, one string per step, without step numbers.
- If the page can't be read or isn't a recipe, return {"title": ""}.` }] }],
    tools: [{ url_context: {} }],
  });
  if (!r.title) throw new Error("Couldn't find a recipe on that page");
  return r;
}
