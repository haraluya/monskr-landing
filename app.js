// MONSKR Landing Page — 永久導航站
// 建立日期：2026-03-13

(function () {
  "use strict"

  function detectDevice() {
    var ua = navigator.userAgent
    var isIOS = /iPad|iPhone|iPod/.test(ua)
    var isAndroid = /Android/i.test(ua)
    var isMobile = isIOS || isAndroid || /webOS|BlackBerry|IEMobile/i.test(ua)

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

  function renderSites(data) {
    var container = document.getElementById("sites-list")
    if (!container || !data.sites) return

    data.sites.forEach(function (site) {
      var a = document.createElement("a")
      a.href = site.url
      a.className = "site-card"
      if (site.primary) a.className += " primary"

      var info = document.createElement("div")
      info.className = "site-info"

      var title = document.createElement("span")
      title.className = "site-title"
      title.textContent = site.label + " \u2014 " + site.domain

      var dot = document.createElement("span")
      dot.className = "status-dot active"

      info.appendChild(dot)
      info.appendChild(title)

      var arrow = document.createElement("span")
      arrow.className = "site-arrow"
      arrow.textContent = "\u2192"

      a.appendChild(info)
      a.appendChild(arrow)
      container.appendChild(a)
    })
  }

  function setupInstallBanner(data) {
    var banner = document.getElementById("install-banner")
    if (!banner) return

    var device = detectDevice()
    var installUrl = data.install_url || ""

    if (!installUrl) {
      banner.style.display = "none"
      return
    }

    var p = banner.querySelector("p")
    var btn = banner.querySelector(".btn-install")

    if (device.isInApp) {
      if (p) p.textContent = "\u60A8\u6B63\u5728 " + device.inAppName + " \u4E2D\uFF0C\u8ACB\u5148\u7528\u700F\u89BD\u5668\u958B\u555F"
      if (btn) {
        btn.textContent = "\u8907\u88FD\u9023\u7D50"
        btn.href = "#"
        btn.onclick = function (e) {
          e.preventDefault()
          copyToClipboard(installUrl)
          btn.textContent = "\u5DF2\u8907\u88FD\uFF01"
          setTimeout(function () {
            btn.textContent = "\u8907\u88FD\u9023\u7D50"
          }, 2000)
        }
      }
    } else {
      if (p) p.textContent = "\u5B89\u88DD\u5F8C\u5373\u4F7F\u57DF\u540D\u8B8A\u66F4\u4E5F\u80FD\u81EA\u52D5\u66F4\u65B0"
      if (btn) {
        btn.textContent = "\u5B89\u88DD App"
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

  function loadData() {
    fetch("urls.json")
      .then(function (res) {
        return res.json()
      })
      .then(function (data) {
        renderSites(data)
        setupInstallBanner(data)
      })
      .catch(function (err) {
        console.error("Failed to load urls.json:", err)
        var container = document.getElementById("sites-list")
        if (container) {
          var a = document.createElement("a")
          a.href = "https://monskr.uk/tw"
          a.className = "site-card primary"
          a.innerHTML =
            '<div class="site-info"><span class="status-dot active"></span><span class="site-title">\u4E3B\u7AD9 \u2014 monskr.uk</span></div><span class="site-arrow">\u2192</span>'
          container.appendChild(a)
        }
      })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadData)
  } else {
    loadData()
  }
})()
