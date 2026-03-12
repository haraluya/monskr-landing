// MONSKR Landing Page — 讀取 urls.json + 裝置偵測
// 建立日期：2026-03-13

(function () {
  "use strict"

  // 簡易裝置偵測
  function detectDevice() {
    var ua = navigator.userAgent
    var isIOS = /iPad|iPhone|iPod/.test(ua)
    var isAndroid = /Android/i.test(ua)
    var isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile/i.test(ua)

    // in-app browser
    var isLine = /Line\//i.test(ua)
    var isFB = /FBAN|FBAV/i.test(ua)
    var isIG = /Instagram/i.test(ua)
    var isInApp = isLine || isFB || isIG

    return {
      isIOS: isIOS,
      isAndroid: isAndroid,
      isMobile: isMobile,
      isInApp: isInApp,
      inAppName: isLine ? "LINE" : isFB ? "Facebook" : isIG ? "Instagram" : null,
    }
  }

  // Icon 映射
  var iconMap = {
    shop: "🛒",
    install: "📲",
    store: "🏪",
    cart: "🛍️",
  }

  // 渲染連結清單
  function renderLinks(data) {
    var container = document.getElementById("links-list")
    if (!container || !data.urls) return

    data.urls.forEach(function (item) {
      if (item.status !== "active") return

      var a = document.createElement("a")
      a.href = item.url
      a.className = "link-card"
      if (item.primary) a.className += " primary"
      if (item.highlight) a.className += " highlight"

      var icon = document.createElement("div")
      icon.className = "link-icon"
      icon.textContent = iconMap[item.id] || "🔗"

      var name = document.createElement("span")
      name.className = "link-name"
      name.textContent = item.name

      var arrow = document.createElement("span")
      arrow.className = "link-arrow"
      arrow.textContent = "→"

      a.appendChild(icon)
      a.appendChild(name)
      a.appendChild(arrow)
      container.appendChild(a)
    })
  }

  // 渲染社群連結
  function renderSocial(data) {
    var container = document.getElementById("social-links")
    if (!container || !data.social) return

    var hasSocial = false
    data.social.forEach(function (item) {
      if (!item.url) return
      hasSocial = true

      var a = document.createElement("a")
      a.href = item.url
      a.className = "social-link"
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      a.textContent = item.label

      container.appendChild(a)
    })

    if (!hasSocial) {
      var section = document.getElementById("social-section")
      if (section) section.style.display = "none"
    }
  }

  // 設定安裝引導
  function setupInstallBanner(data) {
    var banner = document.getElementById("install-banner")
    if (!banner) return

    var device = detectDevice()

    // 找安裝連結
    var installUrl = ""
    if (data.urls) {
      data.urls.forEach(function (item) {
        if (item.id === "install" && item.status === "active") {
          installUrl = item.url
        }
      })
    }

    if (!installUrl) {
      banner.style.display = "none"
      return
    }

    var p = banner.querySelector("p")
    var btn = banner.querySelector(".btn-install")

    if (device.isInApp) {
      if (p) p.textContent = "您正在 " + device.inAppName + " 中，請先用瀏覽器開啟"
      if (btn) {
        btn.textContent = "複製連結"
        btn.href = "#"
        btn.onclick = function (e) {
          e.preventDefault()
          copyToClipboard(installUrl)
          btn.textContent = "已複製！"
          setTimeout(function () {
            btn.textContent = "複製連結"
          }, 2000)
        }
      }
    } else {
      if (p) p.textContent = "加到主畫面，享受更快速的購物體驗"
      if (btn) {
        btn.textContent = "安裝 App"
        btn.href = installUrl
      }
    }
  }

  function copyToClipboard(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(function () {
        fallbackCopy(text)
      })
    } else {
      fallbackCopy(text)
    }
  }

  function fallbackCopy(text) {
    var input = document.createElement("input")
    input.value = text
    document.body.appendChild(input)
    input.select()
    document.execCommand("copy")
    document.body.removeChild(input)
  }

  // 載入 JSON
  function loadData() {
    fetch("urls.json")
      .then(function (res) {
        return res.json()
      })
      .then(function (data) {
        renderLinks(data)
        renderSocial(data)
        setupInstallBanner(data)
      })
      .catch(function (err) {
        console.error("Failed to load urls.json:", err)
        // 最低限度 fallback
        var container = document.getElementById("links-list")
        if (container) {
          var a = document.createElement("a")
          a.href = "https://tomvape.com/tw"
          a.className = "link-card primary"
          a.innerHTML =
            '<div class="link-icon">🛒</div><span class="link-name">MONSKR 商店</span><span class="link-arrow">→</span>'
          container.appendChild(a)
        }
      })
  }

  // 啟動
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData)
  } else {
    loadData()
  }
})()
