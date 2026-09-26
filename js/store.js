// Data layer. Uses Firebase (synced across devices) when js/config.js is filled in,
// otherwise falls back to localStorage on this device.
import { firebaseConfig } from "./config.js";

const FB = "https://www.gstatic.com/firebasejs/12.19.0";
const COLLECTIONS = ["fridge", "groceries", "recipes"];
const LOCAL_KEY = "kitchen-data-v1";

export const newId = () =>
  (crypto.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2)).replace(/-/g, "");

const listeners = new Set();
const state = { fridge: [], groceries: [], recipes: [] };

export const store = {
  state,
  mode: firebaseConfig.apiKey ? "cloud" : "local",
  user: null, // signed-in Firebase user in cloud mode
  ready: false, // true once data (or the sign-in requirement) is known
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  add, update, remove, addMany, replaceAll, signIn, signUp, signOut, resetPassword,
};

const emit = () => listeners.forEach((fn) => fn());

// ---------- local backend ----------

function loadLocal() {
  try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || null; } catch { return null; }
}
function saveLocal() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); } catch (e) { console.warn("Could not save", e); }
}

// ---------- cloud backend ----------

let fb = null; // { db, auth, fs, authApi }

async function initCloud() {
  const [{ initializeApp }, authApi, fs] = await Promise.all([
    import(`${FB}/firebase-app.js`),
    import(`${FB}/firebase-auth.js`),
    import(`${FB}/firebase-firestore.js`),
  ]);
  const app = initializeApp(firebaseConfig);
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }),
  });
  const auth = authApi.getAuth(app);
  fb = { db, auth, fs, authApi };

  let unsubs = [];
  authApi.onAuthStateChanged(auth, (user) => {
    unsubs.forEach((u) => u());
    unsubs = [];
    store.user = user;
    COLLECTIONS.forEach((c) => (state[c] = []));
    if (!user) { store.ready = true; emit(); return; }
    store.ready = false;
    emit();
    let pending = new Set(COLLECTIONS);
    for (const c of COLLECTIONS) {
      unsubs.push(fs.onSnapshot(fs.collection(db, "users", user.uid, c), (snap) => {
        state[c] = snap.docs.map((d) => ({ ...d.data(), id: d.id }));
        if (pending.delete(c) && pending.size === 0) {
          store.ready = true;
          migrateLocalToCloud();
        }
        emit();
      }, (err) => console.error(`Sync error (${c})`, err)));
    }
  });
}

// First sign-in: copy anything saved on this device before sync was set up.
async function migrateLocalToCloud() {
  const local = loadLocal();
  if (!local || COLLECTIONS.some((c) => state[c].length)) return;
  const items = COLLECTIONS.flatMap((c) => (local[c] || []).map((it) => [c, it]));
  if (!items.length) return;
  for (const [c, it] of items) await add(c, it);
  try { localStorage.removeItem(LOCAL_KEY); } catch {}
}

const docRef = (col, id) => fb.fs.doc(fb.db, "users", store.user.uid, col, id);
const clean = (obj) => JSON.parse(JSON.stringify(obj)); // Firestore rejects undefined values

// ---------- public API ----------

async function add(col, item) {
  const doc = { ...item, id: item.id || newId() };
  if (store.mode === "cloud") {
    const { id, ...data } = doc;
    await fb.fs.setDoc(docRef(col, id), clean(data));
  } else {
    state[col] = [...state[col].filter((x) => x.id !== doc.id), doc];
    saveLocal(); emit();
  }
  return doc;
}

async function addMany(col, items) {
  if (store.mode === "cloud") {
    const batch = fb.fs.writeBatch(fb.db);
    for (const it of items) {
      const { id = newId(), ...data } = it;
      batch.set(docRef(col, id), clean(data));
    }
    await batch.commit();
  } else {
    state[col] = [...state[col], ...items.map((it) => ({ ...it, id: it.id || newId() }))];
    saveLocal(); emit();
  }
}

async function update(col, id, patch) {
  if (store.mode === "cloud") {
    await fb.fs.updateDoc(docRef(col, id), clean(patch));
  } else {
    state[col] = state[col].map((x) => (x.id === id ? { ...x, ...patch } : x));
    saveLocal(); emit();
  }
}

async function remove(col, id) {
  if (store.mode === "cloud") {
    await fb.fs.deleteDoc(docRef(col, id));
  } else {
    state[col] = state[col].filter((x) => x.id !== id);
    saveLocal(); emit();
  }
}

// Used by backup import: wipes each collection and writes the given data.
async function replaceAll(data) {
  for (const c of COLLECTIONS) {
    if (!Array.isArray(data[c])) continue;
    for (const it of [...state[c]]) await remove(c, it.id);
    await addMany(c, data[c]);
  }
}

async function signIn(email, password) {
  await fb.authApi.signInWithEmailAndPassword(fb.auth, email, password);
}
async function signUp(email, password) {
  await fb.authApi.createUserWithEmailAndPassword(fb.auth, email, password);
}
async function resetPassword(email) {
  await fb.authApi.sendPasswordResetEmail(fb.auth, email);
}
async function signOut() {
  await fb.authApi.signOut(fb.auth);
}

export async function initStore() {
  if (store.mode === "cloud") {
    try {
      await initCloud();
      return;
    } catch (e) {
      console.error("Firebase failed to load; using this device only", e);
      store.mode = "local";
    }
  }
  Object.assign(state, loadLocal() || {});
  store.ready = true;
  emit();
}
