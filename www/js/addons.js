// Add-on manager: stores manifests, validates them, calls add-on endpoints safely.

const ADDON_KEY = "wm_addons";
const TIMEOUT_MS = 6000;

function loadAddons() {
  try {
    return JSON.parse(localStorage.getItem(ADDON_KEY)) || [];
  } catch {
    return [];
  }
}

function saveAddons(list) {
  localStorage.setItem(ADDON_KEY, JSON.stringify(list));
}

// Fetch JSON with a timeout so one slow add-on can't freeze the app.
async function fetchJSON(url, ms = TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// Turns "https://x.com/manifest.json" into "https://x.com"
function baseOf(url) {
  return url.replace(/\/manifest\.json$/i, "").replace(/\/+$/, "");
}

function validateManifest(m) {
  if (!m || typeof m !== "object") throw new Error("invalid");
  if (typeof m.id !== "string" || !m.id) throw new Error("invalid");
  if (typeof m.name !== "string" || !m.name) throw new Error("invalid");
  if (!Array.isArray(m.resources)) throw new Error("invalid");
}

async function installAddon(manifestUrl) {
  const url = manifestUrl.trim();
  const isLocal = /^http:\/\/localhost(:\d+)?\//i.test(url);
  if (!/^https:\/\//i.test(url) && !isLocal) throw new Error("insecure");

  const m = await fetchJSON(url);
  validateManifest(m);

  const entry = {
    id: m.id,
    name: m.name,
    version: m.version || "-",
    description: m.description || "",
    base: baseOf(url),
    resources: m.resources,
    types: m.types || [],
    catalogs: m.catalogs || [],
    enabled: true,
    status: "ok"
  };

  const list = loadAddons();
  const i = list.findIndex(a => a.id === entry.id);
  if (i >= 0) {
    entry.enabled = list[i].enabled; // keep user's choice on update
    list[i] = entry;
  } else {
    list.push(entry);
  }
  saveAddons(list);
  return entry;
}

function removeAddon(id) {
  saveAddons(loadAddons().filter(a => a.id !== id));
}

function toggleAddon(id) {
  const list = loadAddons();
  const a = list.find(x => x.id === id);
  if (a) a.enabled = !a.enabled;
  saveAddons(list);
}

function getAddon(id) {
  return loadAddons().find(a => a.id === id);
}

// Fetch a catalog from one add-on. Optional search query.
function fetchCatalog(addon, type, catalogId, search) {
  let path = `${addon.base}/catalog/${encodeURIComponent(type)}/${encodeURIComponent(catalogId)}`;
  if (search) path += `/search=${encodeURIComponent(search)}`;
  return fetchJSON(path + ".json").then(r => (r.metas || []).map(m => ({ ...m, _addon: addon.id })));
}

function fetchMeta(addon, type, id) {
  const path = `${addon.base}/meta/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  return fetchJSON(path).then(r => r.meta || null);
}

function fetchStreams(addon, type, id) {
  const path = `${addon.base}/stream/${encodeURIComponent(type)}/${encodeURIComponent(id)}.json`;
  return fetchJSON(path).then(r => (r.streams || []).map(s => ({ ...s, _addon: addon.name })));
}

// Run a request on all enabled add-ons that support a resource.
// Returns results plus a count of failures, so the UI can show "2 sources unavailable".
async function fromAddons(resource, fn) {
  const list = loadAddons().filter(a => a.enabled && a.resources.includes(resource));
  const settled = await Promise.allSettled(list.map(a => fn(a)));
  let errors = 0;
  const data = [];
  settled.forEach(s => {
    if (s.status === "fulfilled") data.push(s.value);
    else errors++;
  });
  return { data, errors };
}
