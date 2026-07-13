# Family Grocery List

A shared grocery list that everyone in your family can open and edit from their
own phone — no more paper lists getting erased or lost. Changes sync live
using Firestore, so if your mom adds "milk" it shows up on your phone and your
brother's phone instantly.

No login required — just share one link.

## How it works

- One shared list, stored in Firestore, under the `groceryItems` collection.
- Anyone with the link can add items, check them off ("bought"), or delete them.
- The first time someone opens the app, it asks for their name (stored only
  on their device) so items show "added by Mom" / "added by Nandha", etc.
- Bought items move to a separate "Bought" section that can be cleared in one tap.

## 1. Create a Firebase project

1. Go to https://console.firebase.google.com and create a new project
   (e.g. "family-grocery-list").
2. In the project, go to **Build > Firestore Database** and click **Create database**.
   Start in **production mode** (we'll set custom rules below).
3. Go to **Project settings > General**, scroll to "Your apps", click the
   web icon (`</>`) to register a new web app. Copy the config values shown
   (`apiKey`, `authDomain`, `projectId`, etc.).

## 2. Configure the project locally

```bash
cd grocery-list-app
npm install
cp .env.example .env
```

Open `.env` and paste in the values from your Firebase config:

```
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

## 3. Apply the Firestore security rules

The included `firestore.rules` only opens up the one `groceryItems`
collection and locks everything else down. Deploy it with the Firebase CLI:

```bash
npm install -g firebase-tools   # if you don't already have it
firebase login
firebase init firestore         # select your existing project, keep default file names
firebase deploy --only firestore:rules
```

(If `firebase init` asks about Hosting too, you can set that up now — see step 5.)

## 4. Run it locally to test

```bash
npm run dev
```

Open the printed `localhost` URL, add a couple of test items, and open the
same URL on your phone (same wifi, use your PC's local IP instead of
`localhost`) to confirm it syncs.

## 5. Deploy so your family can use it from anywhere

```bash
npm run build
firebase init hosting     # if not already done in step 3; set "dist" as the public folder,
                            # answer "Yes" to single-page app rewrite
firebase deploy --only hosting
```

Firebase will give you a live URL like `https://family-grocery-list.web.app`.
Share that one link with your mom and brother — that's the whole "app".
They can also tap "Add to Home Screen" in their browser so it opens like a
normal app icon.

## Notes / things to keep in mind

- Because there's no login, anyone who has the link can edit the list — that's
  fine for a family, just don't post the link publicly.
- If you ever want to support **multiple households** using the same
  deployment (not just your family), the easy upgrade is to add a "family
  code" that becomes part of the Firestore path (e.g.
  `groceryLists/{familyCode}/items`) — happy to help you add that later if
  you want to turn this into something you share with friends too.
