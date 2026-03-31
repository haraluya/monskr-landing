// MONSKR Landing Page — 永久導航站 + 域名管理
// 建立日期：2026-03-31

;(function () {
  "use strict"

  var GITHUB_OWNER = "haraluya"
  var GITHUB_REPO = "monskr-landing"
  var GITHUB_FILE = "domains.json"
  var TOKEN_KEY = "monskr-github-token"
  var ADMIN_PIN = "831025"
  var domainsData = null
  var fileSha = null

  // ===== 自動導向 =====
  function checkRedirect() {
    var params = new URLSearchParams(window.location.search)
    var redirectPath = params.get("r")
    if (!redirectPath) return false

    document.getElementById("redirect-loading").style.display = "flex"
    document.getElementById("main-content").style.display = "none"

    loadDomains(function (data) {
      if (!data || !data.domains) {
        showMainContent()
        return
      }

      var active = data.domains
        .filter(function (d) { return d.status === "active" })
        .sort(function (a, b) { return a.priority - b.priority })

      testDomainsSequentially(active, 0, function (availableUrl) {
        if (availableUrl) {
          window.location.href = availableUrl + redirectPath
        } else {
          showMainContent()
          document.getElementById("redirect-loading").style.display = "none"
        }
      })
    })

    return true
  }

  function showMainContent() {
    document.getElementById("main-content").style.display = ""
    document.getElementById("redirect-loading").style.display = "none"
  }

  function testDomainsSequentially(domains, index, callback) {
    if (index >= domains.length) {
      callback(null)
      return
    }
    testDomain(domains[index].url, function (ok) {
      if (ok) {
        callback(domains[index].url)
      } else {
        testDomainsSequentially(domains, index + 1, callback)
      }
    })
  }

  function testDomain(url, callback) {
    var timeout = setTimeout(function () { callback(false) }, 3000)
    fetch(url + "/tw", { mode: "no-cors" })
      .then(function () { clearTimeout(timeout); callback(true) })
      .catch(function () { clearTimeout(timeout); callback(false) })
  }

  // ===== 域名顯示 =====
  function loadDomains(callback) {
    fetch("domains.json?t=" + Date.now())
      .then(function (res) { return res.json() })
      .then(function (data) {
        domainsData = data
        if (callback) callback(data)
      })
      .catch(function () {
        // fallback
        domainsData = {
          version: 1,
          updated: "",
          backendApi: "https://api.tomvape.com",
          domains: [
            { domain: "monskr.uk", url: "https://monskr.uk", priority: 1, status: "active" }
          ]
        }
        if (callback) callback(domainsData)
      })
  }

  function renderDomains(data) {
    var container = document.getElementById("sites-list")
    if (!container || !data.domains) return
    container.innerHTML = ""

    var active = data.domains
      .filter(function (d) { return d.status === "active" })
      .sort(function (a, b) { return a.priority - b.priority })

    active.forEach(function (d, i) {
      var a = document.createElement("a")
      a.href = d.url + "/tw"
      a.className = "site-card" + (i === 0 ? " primary" : "")

      var info = document.createElement("div")
      info.className = "site-info"

      var dot = document.createElement("span")
      dot.className = "status-dot testing"
      dot.id = "dot-" + d.domain

      var title = document.createElement("span")
      title.className = "site-title"
      title.textContent = (i === 0 ? "主站" : "備用站") + " — " + d.domain

      info.appendChild(dot)
      info.appendChild(title)

      var arrow = document.createElement("span")
      arrow.className = "site-arrow"
      arrow.textContent = "\u2192"

      a.appendChild(info)
      a.appendChild(arrow)
      container.appendChild(a)

      // 即時測試連線
      testDomain(d.url, function (ok) {
        dot.className = "status-dot " + (ok ? "active" : "inactive")
      })
    })
  }

  // ===== 安裝 Banner =====
  function setupInstallBanner(data) {
    var banner = document.getElementById("install-banner")
    if (!banner || !data.domains || data.domains.length === 0) return

    var primaryDomain = data.domains.find(function (d) { return d.priority === 1 }) || data.domains[0]
    var installUrl = primaryDomain.url + "/tw/install"

    var ua = navigator.userAgent
    var isLine = /Line\//i.test(ua)
    var isFB = /FBAN|FBAV/i.test(ua)
    var isIG = /Instagram/i.test(ua)
    var isInApp = isLine || isFB || isIG

    var p = banner.querySelector("p")
    var btn = banner.querySelector(".btn-install")

    if (isInApp) {
      var appName = isLine ? "LINE" : isFB ? "Facebook" : "Instagram"
      if (p) p.textContent = "您正在 " + appName + " 中，請先用瀏覽器開啟"
      if (btn) {
        btn.textContent = "複製連結"
        btn.href = "#"
        btn.onclick = function (e) {
          e.preventDefault()
          copyText(installUrl)
          btn.textContent = "已複製！"
          setTimeout(function () { btn.textContent = "複製連結" }, 2000)
        }
      }
    } else {
      if (btn) btn.href = installUrl
    }
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(function () {})
    }
  }

  // ===== 管理介面 =====
  window.toggleAdmin = function () {
    var panel = document.getElementById("admin-panel")
    if (panel.style.display === "none") {
      var pin = prompt("請輸入管理密碼")
      if (pin !== ADMIN_PIN) {
        alert("密碼錯誤")
        return
      }
      panel.style.display = "block"
      checkToken()
    } else {
      panel.style.display = "none"
    }
  }

  function checkToken() {
    var token = localStorage.getItem(TOKEN_KEY)
    if (token) {
      document.getElementById("token-setup").style.display = "none"
      document.getElementById("domain-manager").style.display = "block"
      renderAdminDomains()
    } else {
      document.getElementById("token-setup").style.display = "block"
      document.getElementById("domain-manager").style.display = "none"
    }
  }

  window.saveToken = function () {
    var token = document.getElementById("token-input").value.trim()
    if (!token) { alert("請輸入 Token"); return }
    localStorage.setItem(TOKEN_KEY, token)
    checkToken()
  }

  window.clearToken = function () {
    localStorage.removeItem(TOKEN_KEY)
    checkToken()
  }

  function renderAdminDomains() {
    var container = document.getElementById("domain-list")
    if (!container || !domainsData) return
    container.innerHTML = ""

    domainsData.domains.forEach(function (d) {
      var div = document.createElement("div")
      div.className = "domain-item"

      var info = document.createElement("div")
      info.className = "domain-item-info"

      var dot = document.createElement("span")
      dot.className = "status-dot testing"
      dot.id = "admin-dot-" + d.domain

      var name = document.createElement("span")
      name.className = "domain-name"
      name.textContent = d.domain

      var badge = document.createElement("span")
      badge.className = "domain-badge " + d.status
      badge.textContent = d.status

      info.appendChild(dot)
      info.appendChild(name)
      info.appendChild(badge)

      var actions = document.createElement("div")
      actions.className = "domain-item-actions"

      // 切換狀態
      var toggleBtn = document.createElement("button")
      toggleBtn.className = "btn-small"
      toggleBtn.textContent = d.status === "active" ? "停用" : "啟用"
      toggleBtn.onclick = (function (domain) {
        return function () { toggleDomainStatus(domain) }
      })(d.domain)
      actions.appendChild(toggleBtn)

      // 刪除
      var delBtn = document.createElement("button")
      delBtn.className = "btn-small btn-danger"
      delBtn.textContent = "刪除"
      delBtn.onclick = (function (domain) {
        return function () { deleteDomain(domain) }
      })(d.domain)
      actions.appendChild(delBtn)

      div.appendChild(info)
      div.appendChild(actions)
      container.appendChild(div)

      // 測試連線
      testDomain(d.url, function (ok) {
        var adminDot = document.getElementById("admin-dot-" + d.domain)
        if (adminDot) adminDot.className = "status-dot " + (ok ? "active" : "inactive")
      })
    })
  }

  window.addDomain = function () {
    var input = document.getElementById("new-domain-input")
    var statusEl = document.getElementById("add-domain-status")
    var btn = document.getElementById("add-domain-btn")
    var raw = input.value.trim()
    if (!raw) return

    // 正規化：移除 protocol 和 trailing slash
    var domain = raw.replace(/^https?:\/\//, "").replace(/\/.*$/, "")
    var url = "https://" + domain

    btn.disabled = true
    btn.textContent = "測試中..."
    statusEl.style.display = "block"
    statusEl.className = "status-message info"
    statusEl.textContent = "正在測試 " + url + " 是否可連線..."

    testDomain(url, function (ok) {
      if (!ok) {
        statusEl.className = "status-message warning"
        statusEl.textContent = "\u26a0\ufe0f " + domain + " 目前無法連線，仍要新增嗎？"
        btn.textContent = "強制新增"
        btn.disabled = false
        btn.onclick = function () { doAddDomain(domain, url); btn.onclick = window.addDomain }
        return
      }

      doAddDomain(domain, url)
    })
  }

  function doAddDomain(domain, url) {
    var btn = document.getElementById("add-domain-btn")
    var statusEl = document.getElementById("add-domain-status")
    var input = document.getElementById("new-domain-input")

    // 檢查重複
    if (domainsData.domains.some(function (d) { return d.domain === domain })) {
      statusEl.className = "status-message error"
      statusEl.textContent = "\u274c " + domain + " 已存在"
      btn.textContent = "新增"
      btn.disabled = false
      return
    }

    var maxPriority = domainsData.domains.reduce(function (max, d) {
      return Math.max(max, d.priority)
    }, 0)

    domainsData.domains.push({
      domain: domain,
      url: url,
      priority: maxPriority + 1,
      status: "active"
    })
    domainsData.version++
    domainsData.updated = new Date().toISOString().slice(0, 10)

    btn.textContent = "儲存中..."
    btn.disabled = true

    saveToGitHub(function (success) {
      if (success) {
        statusEl.className = "status-message success"
        statusEl.textContent = "\u2705 " + domain + " 已新增"
        input.value = ""
        renderAdminDomains()
        renderDomains(domainsData)
      } else {
        statusEl.className = "status-message error"
        statusEl.textContent = "\u274c 儲存失敗，請檢查 Token"
        // 回滾
        domainsData.domains = domainsData.domains.filter(function (d) { return d.domain !== domain })
        domainsData.version--
      }
      btn.textContent = "新增"
      btn.disabled = false
      btn.onclick = window.addDomain
    })
  }

  function toggleDomainStatus(domain) {
    var d = domainsData.domains.find(function (x) { return x.domain === domain })
    if (!d) return
    d.status = d.status === "active" ? "disabled" : "active"
    domainsData.version++
    domainsData.updated = new Date().toISOString().slice(0, 10)

    saveToGitHub(function (success) {
      if (success) {
        renderAdminDomains()
        renderDomains(domainsData)
      } else {
        alert("儲存失敗，請檢查 Token")
        d.status = d.status === "active" ? "disabled" : "active"
        domainsData.version--
      }
    })
  }

  function deleteDomain(domain) {
    if (!confirm("確定刪除 " + domain + "？")) return
    var removed = domainsData.domains.find(function (x) { return x.domain === domain })
    domainsData.domains = domainsData.domains.filter(function (d) { return d.domain !== domain })
    domainsData.version++
    domainsData.updated = new Date().toISOString().slice(0, 10)

    saveToGitHub(function (success) {
      if (success) {
        renderAdminDomains()
        renderDomains(domainsData)
      } else {
        alert("儲存失敗，請檢查 Token")
        if (removed) domainsData.domains.push(removed)
        domainsData.version--
      }
    })
  }

  // ===== GitHub API =====
  function getGitHubHeaders() {
    var token = localStorage.getItem(TOKEN_KEY)
    return {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json"
    }
  }

  function fetchFileSha(callback) {
    fetch("https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + GITHUB_FILE, {
      headers: getGitHubHeaders()
    })
      .then(function (res) { return res.json() })
      .then(function (data) {
        fileSha = data.sha
        callback(true)
      })
      .catch(function () { callback(false) })
  }

  function saveToGitHub(callback) {
    var content = btoa(unescape(encodeURIComponent(JSON.stringify(domainsData, null, 2) + "\n")))

    function doSave() {
      var body = {
        message: "update domains.json \u2014 " + new Date().toISOString().slice(0, 10),
        content: content,
        sha: fileSha
      }

      fetch("https://api.github.com/repos/" + GITHUB_OWNER + "/" + GITHUB_REPO + "/contents/" + GITHUB_FILE, {
        method: "PUT",
        headers: getGitHubHeaders(),
        body: JSON.stringify(body)
      })
        .then(function (res) {
          if (res.ok) return res.json()
          throw new Error("GitHub API error: " + res.status)
        })
        .then(function (data) {
          fileSha = data.content.sha
          callback(true)
        })
        .catch(function () { callback(false) })
    }

    if (fileSha) {
      doSave()
    } else {
      fetchFileSha(function (ok) {
        if (ok) doSave()
        else callback(false)
      })
    }
  }

  // ===== 初始化 =====
  function init() {
    if (checkRedirect()) return

    loadDomains(function (data) {
      renderDomains(data)
      setupInstallBanner(data)
      // 預先取得 SHA 供管理用
      var token = localStorage.getItem(TOKEN_KEY)
      if (token) fetchFileSha(function () {})
    })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init)
  } else {
    init()
  }
})()
