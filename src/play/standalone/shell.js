// Page shell of the single-file browser build (plain browser JavaScript, inlined by build.ts).
// It runs the game's own request handler (globalThis.kriminalfaelle) instead of a server: every
// page is rendered into a frame, links and forms are routed to the handler, and each case's
// Session C save is kept in localStorage so the game survives a reload.
(() => {
  const app = globalThis.kriminalfaelle;
  const frame = document.getElementById("kf");
  const boot = document.getElementById("boot");
  const KEY = "kriminalfaelle.spielstand.";
  // Imported cases ("Eigenen Fall laden") are kept as their checked file and re-imported on start.
  const CASE_KEY = "kriminalfaelle.eigenerfall.";
  const store = {
    get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
  };
  const none = async () => null;

  async function request(method, url, body) {
    const res = await app.handle(method, url, body === undefined ? none : async () => body);
    if (method === "POST" && url === "/eigener-fall" && res.status === 200) {
      try { store.set(CASE_KEY + JSON.parse(res.body).slug, body); } catch {}
    }
    const changed = method === "POST" && /^\/fall\/([a-z0-9-]+)\/(act|new|load)$/.exec(url);
    if (changed) {
      const saved = await app.handle("GET", `/fall/${changed[1]}/save`, none);
      if (saved.status === 200) store.set(KEY + changed[1], saved.body);
    }
    return res;
  }

  function download(res) {
    const name = /filename="([^"]+)"/.exec(res.headers["content-disposition"])?.[1] ?? "spielstand.json";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([res.body], { type: "application/json" }));
    a.download = name;
    document.body.append(a);
    a.click();
    setTimeout(() => (URL.revokeObjectURL(a.href), a.remove()), 1000);
  }

  // Runs inside each page before its own script: navigation and the save upload go to the shell.
  const PAGE_SHIM = `<script>window.kfVisit = (u) => parent.kfGo("GET", u); window.fetch = (u, o) => parent.kfFetch(String(u), o || {}); window.focus();<\/script>`;

  async function go(method, url, body) {
    let res = await request(method, url, body);
    for (let hops = 0; res.status === 303 && hops < 5; hops++) {
      url = res.headers.location;
      res = await request("GET", url);
    }
    if (res.headers["content-disposition"]) return download(res);
    const html = res.headers["content-type"]?.startsWith("text/html")
      ? res.body
      : `<!doctype html><meta charset="utf-8"><body style="font:18px system-ui;background:#1c1814;color:#f5eedf;padding:40px"><p>${res.status}: ${res.body}</p><p><a style="color:#c99a4b" href="/">Zu den Fällen</a></p>`;
    try { history.replaceState(null, "", `#${url}`); } catch {}
    frame.srcdoc = html.replace(/<head>|<body[^>]*>/, (tag) => tag + PAGE_SHIM);
  }

  window.kfGo = (method, url, body) => void go(method, url, body);
  window.kfFetch = async (url, opts) => {
    const res = await request(opts.method || "GET", url, opts.body === undefined ? undefined : String(opts.body));
    return { ok: res.status < 400, status: res.status, text: async () => res.body };
  };

  frame.addEventListener("load", () => {
    const doc = frame.contentDocument;
    if (!doc) return;
    document.title = doc.title || "Kriminalfälle";
    doc.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest("a[href]");
      if (!a || e.defaultPrevented || !a.getAttribute("href").startsWith("/")) return;
      e.preventDefault();
      go("GET", a.getAttribute("href"));
    });
    doc.addEventListener("submit", (e) => {
      const form = e.target;
      if (e.defaultPrevented || form.getAttribute("method") === "dialog") return;
      e.preventDefault();
      go((form.getAttribute("method") || "GET").toUpperCase(), form.getAttribute("action"), new URLSearchParams(new FormData(form)).toString());
    });
    doc.querySelector(".save h2")?.insertAdjacentHTML("afterend", `<p class="muted">Dein Stand wird automatisch in diesem Browser gespeichert.</p>`);
    frame.hidden = false;
    boot.hidden = true;
  });

  (async () => {
    // Restore every saved case silently, then open the page the address names. A Zufallsfall's
    // seed is part of its slug (zufall-<seed>), so its save key alone recreates the case.
    const generated = [];
    const own = [];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || "";
        const slug = key.slice(KEY.length);
        if (key.startsWith(KEY) && /^zufall-(0|[1-9][0-9]{0,8})$/.test(slug)) generated.push(slug);
        if (key.startsWith(CASE_KEY)) own.push(key);
      }
    } catch {}
    // Each stored case file goes through the full import check again.
    for (const key of own.sort()) {
      const res = await app.handle("POST", "/eigener-fall", async () => store.get(key));
      if (res.status === 200) generated.push(JSON.parse(res.body).slug);
    }
    for (const slug of [...app.slugs, ...generated.sort()]) {
      const saved = store.get(KEY + slug);
      if (saved === null) continue;
      const loaded = await app.handle("POST", `/fall/${slug}/load`, async () => saved);
      if (loaded.status === 303) await app.handle("GET", `/fall/${slug}`, none);
    }
    const start = /^#(\/[^#]*)$/.exec(location.hash)?.[1] ?? "/";
    await go("GET", start);
  })().catch((err) => {
    boot.textContent = `Die Fälle konnten nicht geladen werden: ${err && err.message ? err.message : err}`;
  });
})();
