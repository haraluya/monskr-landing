/* =============================================================================
 * MONSKR Landing · 永久導航站
 * 三層 fallback 資料載入 → 分組排序 → live probe → FLIP 重排 → 動態安裝按鈕
 * ============================================================================= */

(function () {
  "use strict";

  const LANDING_REPO_URL = "https://haraluya.github.io/monskr-landing/domains.json";
  const LOCAL_URLS_PATH = "./urls.json";
  const PROBE_TIMEOUT_MS = 5000;
  const INSTALL_PATH = "/tw/install";

  /**
   * 三層 fallback 載入 domains 資料
   *  1st: 本地 ./urls.json（local dev 才會存在）
   *  2nd: https://haraluya.github.io/monskr-landing/domains.json
   *  3rd: window.FALLBACK_DOMAINS（inline 於 index.html）
   */
  async function loadDomainsData() {
    // 1st: local
    try {
      const local = await fetchJSON(LOCAL_URLS_PATH, 2000);
      if (local && Array.isArray(local.domains) && local.domains.length) {
        return normalizeSchema(local);
      }
    } catch (_) { /* ignore, fall through */ }

    // 2nd: remote
    try {
      const remote = await fetchJSON(LANDING_REPO_URL + "?t=" + Date.now(), 3000);
      if (remote && Array.isArray(remote.domains) && remote.domains.length) {
        return normalizeSchema(remote);
      }
    } catch (_) { /* ignore, fall through */ }

    // 3rd: inline fallback
    if (window.FALLBACK_DOMAINS && Array.isArray(window.FALLBACK_DOMAINS.domains)) {
      return normalizeSchema(window.FALLBACK_DOMAINS);
    }

    // 實務上不應走到這（HTML inline 有保底），但留個空殼避免 null deref
    return { version: 3, domains: [] };
  }

  async function fetchJSON(url, timeoutMs) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      return await res.json();
    } finally {
      clearTimeout(t);
    }
  }

  /**
   * Normalize schema — 接受 v1/v2/v3 格式，統一成 v3
   * 舊欄位 label / primary / priority 全部忽略
   */
  function normalizeSchema(data) {
    const domains = (data.domains || data.sites || []).map(function (d) {
      return {
        domain: d.domain,
        url: d.url || ("https://" + d.domain),
        addedAt: d.addedAt || "1970-01-01",
        status: d.status === "disabled" ? "disabled" : "active"
      };
    });
    return { version: 3, domains: domains };
  }

  /* ------- 分組與排序 ------- */

  /**
   * 把 domains 分為 alive / dead 兩組，每組按 addedAt 降冪
   * probeResults: Map<domain, "on"|"off"|"unknown">
   *   - "on"  通過 live probe
   *   - "off" probe failed / timeout
   *   - "unknown" 尚未 probe（初始靜態渲染用）
   */
  function classifyAndSort(domains, probeResults) {
    const alive = [];
    const dead = [];
    domains.forEach(function (d) {
      const probeStatus = probeResults.get(d.domain);
      const isDead = d.status === "disabled" || probeStatus === "off";
      (isDead ? dead : alive).push(d);
    });
    const byAddedDesc = function (a, b) { return (b.addedAt || "").localeCompare(a.addedAt || ""); };
    alive.sort(byAddedDesc);
    dead.sort(byAddedDesc);
    return { alive: alive, dead: dead };
  }

  /**
   * 初次渲染 — 所有 probe 狀態都當 unknown（灰色 pulsing）
   */
  function renderInitial(root, domains) {
    const probeResults = new Map();
    const groups = classifyAndSort(domains, probeResults);
    renderGroups(root, groups, probeResults, true);
  }

  function renderGroups(root, groups, probeResults, isInitialPulse) {
    root.innerHTML = "";
    if (groups.alive.length > 0) {
      root.appendChild(buildGroupHeader("可用站點", groups.alive.length));
      groups.alive.forEach(function (d, i) {
        root.appendChild(buildSiteRow(d, probeResults.get(d.domain) || "unknown", i, false, isInitialPulse));
      });
    }
    if (groups.dead.length > 0) {
      root.appendChild(buildGroupHeader("暫時失效", groups.dead.length));
      groups.dead.forEach(function (d, i) {
        root.appendChild(buildSiteRow(d, probeResults.get(d.domain) || "off", i, true, false));
      });
    }
  }

  function buildGroupHeader(label, count) {
    const el = document.createElement("div");
    el.className = "group-header";
    el.innerHTML =
      '<span class="group-label">' + escapeHTML(label) + '</span>' +
      '<span class="group-count">· ' + count + '</span>';
    return el;
  }

  function buildSiteRow(d, probeStatus, index, isDead, isInitialPulse) {
    const a = document.createElement("a");
    a.className = "site" + (isDead ? " dead" : "");
    a.href = d.url + "/tw";
    a.setAttribute("data-domain", d.domain);
    a.style.setProperty("--i", String(index));

    const dotClass = "dot " + probeStatus + (isInitialPulse && probeStatus === "unknown" ? " checking" : "");
    a.innerHTML =
      '<span class="site-name"><span class="' + dotClass + '"></span>' + escapeHTML(d.domain) + '</span>' +
      '<span class="site-age">' + formatAge(d.addedAt) + '</span>';
    return a;
  }

  function formatAge(isoDate) {
    const then = new Date(isoDate).getTime();
    if (!then || isNaN(then)) return "—";
    const days = Math.floor((Date.now() - then) / 86400000);
    if (days < 1)  return "today";
    if (days < 30) return days + " days ago";
    const months = Math.floor(days / 30);
    if (months < 12) return months + " months ago";
    const years = Math.floor(months / 12);
    return years + " " + (years === 1 ? "year ago" : "years ago");
  }

  function escapeHTML(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }

  /* ------- Live probe ------- */

  /**
   * 並行 probe 所有 status === "active" 的域名
   * 5 秒 timeout，用 no-cors 模式（opaque response 視為成功）
   * 每個 probe 完成即更新該站 dot 樣式
   * 全部完成後呼叫 onAllDone 觸發重排
   */
  function runProbes(domains, onProbeDone, onAllDone) {
    const toProbe = domains.filter(function (d) { return d.status === "active"; });
    const results = new Map();
    const promises = toProbe.map(function (d) {
      return probeOne(d.url).then(function (ok) {
        results.set(d.domain, ok ? "on" : "off");
        onProbeDone(d.domain, ok ? "on" : "off");
      });
    });
    // 失效的直接標 off（不 probe）
    domains.forEach(function (d) {
      if (d.status === "disabled") {
        results.set(d.domain, "off");
        onProbeDone(d.domain, "off");
      }
    });
    Promise.all(promises).then(function () { onAllDone(results); });
  }

  function probeOne(url) {
    return new Promise(function (resolve) {
      const ctrl = new AbortController();
      const t = setTimeout(function () { ctrl.abort(); resolve(false); }, PROBE_TIMEOUT_MS);
      fetch(url + "/tw", { mode: "no-cors", signal: ctrl.signal, cache: "no-store" })
        .then(function () { clearTimeout(t); resolve(true); })
        .catch(function () { clearTimeout(t); resolve(false); });
    });
  }

  /**
   * 更新單一站的 dot class（不重排，只換顏色）
   */
  function updateDot(domain, status) {
    const row = document.querySelector('.site[data-domain="' + CSS.escape(domain) + '"]');
    if (!row) return;
    const dot = row.querySelector(".dot");
    if (!dot) return;
    dot.className = "dot " + status;
  }

  /* ------- FLIP reorder ------- */

  /**
   * First/Last/Invert/Play — probe 完成後重新排序站點，用動畫過渡位置
   */
  function flipReorder(root, domains, probeResults) {
    // First: 記錄所有 site 的當前位置
    const rows = Array.from(root.querySelectorAll(".site"));
    const firstRects = new Map();
    rows.forEach(function (el) {
      firstRects.set(el.getAttribute("data-domain"), el.getBoundingClientRect());
    });

    // Re-render with new order
    const groups = classifyAndSort(domains, probeResults);
    renderGroups(root, groups, probeResults, false);

    // Last + Invert + Play
    const newRows = Array.from(root.querySelectorAll(".site"));
    newRows.forEach(function (el) {
      const domain = el.getAttribute("data-domain");
      const first = firstRects.get(domain);
      if (!first) return;
      const last = el.getBoundingClientRect();
      const dy = first.top - last.top;
      if (Math.abs(dy) < 1) return;

      el.style.transition = "none";
      el.style.transform = "translateY(" + dy + "px)";
      el.style.opacity = "1";
      el.style.animation = "none";

      requestAnimationFrame(function () {
        el.style.transition = "transform 0.2s cubic-bezier(0.22, 1, 0.36, 1)";
        el.style.transform = "translateY(0)";
      });
    });
  }

  /* ------- Install button dynamic href ------- */

  /**
   * 選出「活著且 addedAt 最新」的域名作為安裝目標
   * 若都不活，退回 addedAt 最新的 active 域名（讓使用者至少能試）
   */
  function pickInstallDomain(domains, probeResults) {
    const byAddedDesc = function (a, b) { return (b.addedAt || "").localeCompare(a.addedAt || ""); };
    const activeSorted = domains
      .filter(function (d) { return d.status === "active"; })
      .sort(byAddedDesc);
    if (activeSorted.length === 0) return null;

    const alive = activeSorted.find(function (d) { return probeResults.get(d.domain) === "on"; });
    return alive || activeSorted[0];
  }

  function updateInstallButton(domains, probeResults) {
    const btn = document.getElementById("install-btn");
    if (!btn) return;
    const target = pickInstallDomain(domains, probeResults);
    if (!target) {
      btn.removeAttribute("href");
      return;
    }
    btn.href = target.url + INSTALL_PATH;
  }

  /* ------- 入口 ------- */

  async function main() {
    const root = document.getElementById("sites-root");
    if (!root) return;
    const data = await loadDomainsData();
    renderInitial(root, data.domains);
    updateInstallButton(data.domains, new Map());  // 初始 href 用靜態資料選最新 active

    let allOffFallbackTimer = setTimeout(function () {
      // 若 5 秒後一個 probe 都沒完成（網路掛），把所有 pulsing dot 改回 static 灰
      document.querySelectorAll(".dot.checking").forEach(function (el) {
        el.classList.remove("checking");
        el.classList.add("unknown");
      });
    }, PROBE_TIMEOUT_MS + 500);

    runProbes(
      data.domains,
      function onProbeDone(domain, status) {
        clearTimeout(allOffFallbackTimer);
        updateDot(domain, status);
      },
      function onAllDone(results) {
        flipReorder(root, data.domains, results);
        updateInstallButton(data.domains, results);
        window.__landingDone = { domains: data.domains, probeResults: results, root: root };
      }
    );
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", main);
  } else {
    main();
  }
})();
