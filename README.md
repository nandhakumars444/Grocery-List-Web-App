# Family Grocery List

A shared grocery list your family can open and edit from any phone — no more
paper lists getting erased or lost. Items sync live via Firestore.

## Features

- Tap-to-select item grid, grouped by category (பூஜை பொருட்கள், மசாலா, பருப்பு
  வகைகள், etc.), each with an icon.
- "Not on the list?" box for anything not already a tile — typing a new item
  saves it as a permanent tile for the whole family from then on.
- Items you tap first sit in a local "Your list" draft (not shared yet) where
  you can set quantity + unit (kg / litres / nos) before sharing.
- "Move to buy list" pushes the draft to Firebase in one batch — everyone
  sees it in the shared "To buy" list instantly.
- Qty/unit stay editable even after items are shared.
- No login — just one shared link. Your name is stored on your own device
  only, so items show "added by Mom" etc.

## 1. Create a Firebase project

1. https://console.firebase.google.com → create a project.
2. Build > Firestore Database > Create database (Standard edition,
   production mode). Note: Google may require a billing account linked even
   on the free Spark-equivalent usage — you won't be charged unless you go
   over the free daily quotas.
3. Project settings > General > "Your apps" > web icon (`</>`) > register app,
   copy the config values shown.

## 2. Configure locally

```bash
cd grocery-list-app
npm install
cp .env.example .env
```

Paste your Firebase config values into `.env`.

## 3. Deploy Firestore rules

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase deploy --only firestore:rules
```

## 4. Run locally

```bash
npm run dev
```

## 5. Deploy hosting

```bash
npm run build
firebase init hosting   # public directory: dist, single-page app: Yes
firebase deploy --only hosting
```

Share the resulting `.web.app` link with your family.

## Editing the item list

Open `src/items.js` — add a new object to `COMMON_ITEMS` following the
existing pattern (Tamil name, English search words, category id, icon).
Category definitions/order live in `CATEGORIES` in the same file.
