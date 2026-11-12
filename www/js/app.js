const view = document.getElementById("view");
const $ = sel => document.querySelector(sel);

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );
}

// ---------- Routing ----------
function route() {
  const parts = location.hash.slice(1).split("/").map(decodeURIComponent);
  const page = parts[0] || "home";

  document.querySelectorAll(".bottomnav a").forEach(a =>
    a.classList.toggle("active", a.dataset.tab === page)
  );

  if (page === "search") return renderSearch();
  if (page === "addons") return renderAddons();
  if (page === "settings") return renderSettings();
  if (page === "detail") return renderDetail(parts[1], parts[2], parts[3]);
  return renderHome();
}

window.addEventListener("hashchange", route);

// ---------- UI helpers ----------
function card(meta) {
  const href = `#detail/${encodeURIComponent(meta._addon)}/${encodeURIComponent(meta.type || "movie")}/${encodeURIComponent(meta.id)}`;
  const img = meta.poster
    ? `<img loading="lazy" src="${esc(meta.poster)}" alt="">`
    : `<div class="noposter">${esc(meta.name)}</div>`;
  return `<a class="card" href="${href}">${img}<span class="title">${esc(meta.name)}</span></a>`;
}

function notice(errors) {
  return errors ? `<div class="notice">${esc(t("sourcesDown", { n: errors }))}</div>` : "";
}

// ---------- Home ----------
async function renderHome() {
  const list = loadAddons().filter(a => a.enabled && a.catalogs.length);
  if (!list.length) {
    view.innerHTML = `<p class="muted">${t("noCatalogs")}</p>`;
    return;
  }
  view.innerHTML = `<p class="muted">${t("loading")}</p>`;

  const jobs = [];
  list.forEach(a =>
    a.catalogs.forEach(c => jobs.push({ addon: a, catalog: c }))
  );

  const results = await Promise.allSettled(
    jobs.map(j => fetchCatalog(j.addon, j.catalog.type || "movie", j.catalog.id))
  );

  let errors = 0;
  let html = "";
  results.forEach((r, i) => {
    const { addon, catalog } = jobs[i];
    if (r.status === "rejected") { errors++; return; }
    if (!r.value.length) return;
    html += `<h2 class="section">${esc(catalog.name || catalog.id)} <span class="muted">· ${esc(addon.name)}</span></h2>
             <div class="row">${r.value.slice(0, 30).map(card).join("")}</div>`;
  });

  view.innerHTML = notice(errors) + (html || `<p class="muted">${t("noResults")}</p>`);
}

// ---------- Search ----------
function renderSearch() {
  view.innerHTML = `
    <div class="form-row">
      <input id="q" type="search" placeholder="${esc(t("searchPlaceholder"))}">
    </div>
    <div id="results"></div>`;

  const input = $("#q");
  let timer;
  input.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(() => runSearch(input.value.trim()), 400);
  });
  input.focus();
}

async function runSearch(q) {
  const out = $("#results");
  if (!q) { out.innerHTML = ""; return; }
  out.innerHTML = `<p class="muted">${t("loading")}</p>`;

  const { data, errors } = await fromAddons("catalog", a =>
    Promise.all(
      a.catalogs.map(c => fetchCatalog(a, c.type || "movie", c.id, q))
    ).then(arrs => arrs.flat())
  );

  const items = data.flat();
  out.innerHTML =
    notice(errors) +
    (items.length
      ? `<div class="grid">${items.map(card).join("")}</div>`
      : `<p class="muted">${t("noResults")}</p>`);
}

// ---------- Add-ons manager ----------
function renderAddons() {
  const list = loadAddons();
  const rows = list.length
    ? list.map(a => `
        <div class="list-item">
          <div class="info">
            <div class="name">${esc(a.name)} <span class="muted">v${esc(a.version)}</span></div>
            <div class="url">${esc(a.base)}</div>
            <span class="badge ${a.enabled ? "ok" : ""}">${a.enabled ? t("enabled") : "Off"}</span>
          </div>
          <div style="display:flex;gap:6px;flex-direction:column">
            <button class="btn ghost" data-toggle="${esc(a.id)}">${a.enabled ? "⏸" : "▶"}</button>
            <button class="btn ghost" data-remove="${esc(a.id)}">${t("removeAddon")}</button>
          </div>
        </div>`).join("")
    : `<p class="muted">${t("noAddons")}</p>`;

  view.innerHTML = `
    <h2 class="section">${t("addons")}</h2>
    <div class="form-row">
      <input id="manifest-url" type="url" placeholder="${esc(t("manifestUrl"))}">
      <button id="install-btn" class="btn">${t("install")}</button>
    </div>
    <div id="add-msg"></div>
    ${rows}
    ${list.length ? `<button class="btn ghost" id="clear-all">${t("clearAll")}</button>` : ""}`;

  $("#install-btn").onclick = async () => {
    const btn = $("#install-btn");
    const msg = $("#add-msg");
    const url = $("#manifest-url").value;
    btn.disabled = true;
    btn.textContent = t("installing");
    msg.innerHTML = "";
    try {
      const a = await installAddon(url);
      msg.innerHTML = `<p class="badge ok">✓ ${esc(a.name)}</p>`;
      renderAddons();
    } catch (e) {
      const key = e.message === "insecure" ? "insecure" : "invalid";
      msg.innerHTML = `<p class="error">${t(key)}</p>`;
      btn.disabled = false;
      btn.textContent = t("install");
    }
  };

  view.querySelectorAll("[data-toggle]").forEach(b =>
    b.onclick = () => { toggleAddon(b.dataset.toggle); renderAddons(); }
  );
  view.querySelectorAll("[data-remove]").forEach(b =>
    b.onclick = () => { removeAddon(b.dataset.remove); renderAddons(); }
  );
  const clear = $("#clear-all");
  if (clear) clear.onclick = () => { saveAddons([]); renderAddons(); };
}

// ---------- Detail ----------
async function renderDetail(addonId, type, id) {
  const addon = getAddon(addonId);
  if (!addon) {
    view.innerHTML = `<p class="muted">${t("noResults")}</p>`;
    return;
  }
  view.innerHTML = `<p class="muted">${t("loading")}</p>`;

  const [meta, streamRes] = await Promise.all([
    fetchMeta(addon, type, id).catch(() => null),
    fromAddons("stream", a =>
      fetchStreams(a, type, id).catch(() => [])
    )
  ]);

  // Only direct URLs are playable in-app. Torrent-style entries are skipped.
  const streams = streamRes.data.flat().filter(s => s.url);

  const hero = meta
    ? `<div class="detail-hero">
         ${meta.poster ? `<img src="${esc(meta.poster)}" alt="">` : ""}
         <div>
           <h2 class="section" style="margin-top:0">${esc(meta.name)}</h2>
           <div class="muted">${esc(meta.releaseInfo || "")}</div>
           <p>${esc(meta.description || "")}</p>
         </div>
       </div>`
    : "";

  const streamList = streams.length
    ? streams.map((s, i) => `
        <button class="stream-btn" data-stream="${i}">
          <span>▶ ${esc(s.title || s.name || "Source " + (i + 1))}</span>
          <span class="muted">${esc(s._addon)}</span>
        </button>`).join("")
    : `<p class="muted">${t("noStreams")}</p>`;

  view.innerHTML = `
    <a href="javascript:history.back()" class="btn ghost" style="display:inline-block;margin-bottom:12px">← ${t("back")}</a>
    ${hero}
    <h2 class="section">${t("sources")}</h2>
    ${notice(streamRes.errors)}
    ${streamList}`;

  view.querySelectorAll("[data-stream]").forEach(b => {
    const s = streams[Number(b.dataset.stream)];
    b.onclick = () => openPlayer(s.url, s.title || (meta && meta.name) || "");
  });
}

// ---------- Settings ----------
function renderSettings() {
  view.innerHTML = `
    <h2 class="section">${t("settings")}</h2>
    <div class="list-item">
      <div class="name">${t("language")}</div>
      <select id="lang-select" style="width:auto">
        <option value="en" ${getLang() === "en" ? "selected" : ""}>English</option>
        <option value="hi" ${getLang() === "hi" ? "selected" : ""}>हिन्दी</option>
      </select>
    </div>
    <div class="list-item">
      <div class="name">${t("version")}</div>
      <span class="muted">1.0.0</span>
    </div>`;

  $("#lang-select").onchange = e => {
    setLang(e.target.value);
    renderSettings();
    document.querySelectorAll(".bottomnav a span");
  };
}

// ---------- Player ----------
let hls = null;

function openPlayer(url, title) {
  const overlay = $("#player");
  const video = $("#video");
  const fallback = $("#player-fallback");
  $("#player-title").textContent = title;
  fallback.classList.add("hidden");
  video.classList.remove("hidden");
  overlay.classList.remove("hidden");

  if (hls) { hls.destroy(); hls = null; }

  const isHls = /\.m3u8(\?|$)/i.test(url);
  if (isHls && window.Hls && Hls.isSupported()) {
    hls = new Hls();
    hls.loadSource(url);
    hls.attachMedia(video);
  } else {
    video.src = url;
  }
  video.play().catch(() => {});

  video.onerror = () => {
    video.classList.add("hidden");
    fallback.innerHTML = `
      <p>${t("playerError")}</p>
      <p><a href="${esc(url)}" target="_blank" rel="noopener">${t("openExternal")}</a></p>`;
    fallback.classList.remove("hidden");
  };
}

function closePlayer() {
  const video = $("#video");
  video.pause();
  video.removeAttribute("src");
  video.load();
  if (hls) { hls.destroy(); hls = null; }
  $("#player").classList.add("hidden");
}

$("#player-close").onclick = closePlayer;

// ---------- Language picker (first open) ----------
document.querySelectorAll("[data-set-lang]").forEach(b =>
  b.onclick = () => {
    setLang(b.dataset.setLang);
    $("#lang-overlay").classList.add("hidden");
    route();
  }
);

// ---------- Boot ----------
applyI18n();
if (!hasLang()) $("#lang-overlay").classList.remove("hidden");
route();
