# Kitchen 🥕

A phone-friendly web app for your kitchen:

- **Fridge & Pantry**: everything you have, grouped by type, with counts (🍅🍅🍅 ×3) or fill gauges (milk: half). Tap −/＋ as you use things; when something runs out it offers to add it to your grocery list.
- **Groceries**: your shopping list, grouped by aisle. Check items off in the store, then **Put away** moves them into the fridge/pantry. **Scan a receipt** reads a photo and adds the items.
- **Recipes**: cards with photos, grouped by cuisine and sorted by **fewest ingredients you'd need to buy**. Add your own or paste a link. Add "(optional)" to an ingredient line to leave it out of the sorting.

No build step. It's plain HTML/CSS/JS hosted on GitHub Pages.

## Use it on your phone

Open the GitHub Pages link in Safari (iPhone) or Chrome (Android), then **Share → Add to Home Screen**. It opens full-screen like an app.

## Turn on sync (phone ⇄ laptop)

Until this is set up, data is saved only in the browser you're using.

1. Go to <https://console.firebase.google.com> → **Add project** (Google Analytics not needed).
2. **Build → Authentication → Get started → Email/Password → Enable**.
3. **Build → Firestore Database → Create database** → production mode → any location.
4. In Firestore → **Rules**, paste the contents of [`firestore.rules`](firestore.rules) and **Publish**.
5. **Project settings (⚙️) → Your apps → Web (`</>`)** → register an app → copy the `firebaseConfig` values into [`js/config.js`](js/config.js). These values are safe to be public; the rules protect your data.
6. **Authentication → Settings → Authorized domains** → add `<your-github-username>.github.io`.
7. Commit & push. Open the app, **create an account**, and sign in with the same email on every device.
8. Optional: after creating your account, **Authentication → Settings → User actions** → untick *Enable create (sign-up)* so nobody else can make accounts.

## Better receipt scanning & recipe links (optional, free)

Without a key, receipts are read by free on-device OCR (it reads store abbreviations literally, e.g. "GV WHL MLK").
With a free **Google Gemini API key**, paste it in ⚙️ Settings inside the app:

1. Go to <https://aistudio.google.com/apikey> and sign in with a Google account.
2. **Create API key** → copy it (starts with `AIza`). No credit card needed.

Then:

- Receipts are read accurately, with abbreviations expanded ("Whole milk").
- **✨ Auto-fill from link** pulls the title, ingredients, steps and photo from a recipe web page.

The key is stored only in that browser. It is not synced and not in this repo. The free tier has a daily request limit (plenty for home use). If the main model's quota runs out, the app falls back to a lighter one. On the free tier, Google may use what you send to improve its products.

## Run locally

```sh
python3 -m http.server 8000   # then open http://localhost:8000
```
