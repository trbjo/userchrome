let { classes: Cc, interfaces: Ci, manager: Cm, utils: Cu } = Components;

/* set new tab page */
try {
  Cu.import("resource:///modules/AboutNewTab.jsm");
  var newTabURL = "about:firefoxview-next#history";
  AboutNewTab.newTabURL = newTabURL;
} catch (e) { Cu.reportError(e); } // report errors in the Browser Console

const Services = globalThis.Services || Components.utils.import("resource://gre/modules/Services.jsm").Services;
const { E10SUtils } = ChromeUtils.import("resource://gre/modules/E10SUtils.jsm");
const { Downloads } = ChromeUtils.importESModule("resource://gre/modules/Downloads.sys.mjs");


const { showAlertNotification } = Cc["@mozilla.org/alerts-service;1"].getService(
  Ci.nsIAlertsService
);
const MOZSTARTUPTIME = Date.now();

let xP = Services.prefs, xD = xP.getDefaultBranch(null), xZ = void 0, xS = 'string', xN = 'number', xB = 'boolean', xPref = {
  get: function (e, t = !1, r, n = !0) {
    var s = t ? xD : xP; try {
      var o = s.getPrefType(e); return 0 == o ? null != r ? this.set(e, r, n) : xZ :
        32 == o ? s.getStringPref(e) : 64 == o ? s.getIntPref(e) : 128 == o ? s.getBoolPref(e) : xZ
    } catch (P) { return }
  }, clear: xP.clearUserPref, old: {},
  set: function (e, t, r = !1) { let n = r ? xD : xP, s = typeof t; return (xS == s ? n.setStringPref : xN == s ? n.setIntPref : xB == s ? n.setBoolPref : xZ)(e, t) || t },
  lock: function (e, t) { this.old[e] = this.get(e, !0), xP.prefIsLocked(e) && xP.unlockPref(e), this.set(e, t, !0), xP.lockPref(e) },
  unlock: function (e) { xP.unlockPref(e); let t = this.old[e]; null == t ? xP.deleteBranch(e) : this.set(e, t, !0) },
  addListener: function (e, t) { return this.o = function (e, r, n) { return t(xPref.get(n), n) }, xP.addObserver(e, this.o), { p: e, o: this.o } },
  removeListener: function (e) { xP.removeObserver(e.p, e.o) }
}; /// uncomment to use minified xPref.jsm

globalThis.RunningPIDs = new Set();
globalThis.globalActiveDownload = false;
globalThis.ForegroundPIDs = new Set();
globalThis.INActivePIDs = new Set();
globalThis.presetTitle = "";


function browserWindows() {
  return Services.wm.getEnumerator("navigator:browser");
}


function setTitle({ runningPIDs = globalThis.RunningPIDs, foregroundPIDs = globalThis.ForegroundPIDs, inactivePIDs = globalThis.INActivePIDs } = {}) {
  const divider = "=|=";
  let titleString = divider;

  titleString += Uint32Array.from([globalThis.globalActiveDownload, ...runningPIDs]).sort().join(",");
  titleString += divider;
  titleString += Uint32Array.from(foregroundPIDs).sort().join(",");
  titleString += divider;
  titleString += Uint32Array.from(inactivePIDs).sort().join(",");
  titleString += divider;
  for (let win of browserWindows()) {
    win.document.title = titleString;
  }
  globalThis.presetTitle = titleString;
  globalThis.RunningPIDs = runningPIDs;
  globalThis.ForegroundPIDs = foregroundPIDs;
  globalThis.INActivePIDs = inactivePIDs;
}

// listen for active downloads
(async () => {
  const list = await Downloads.getList(Downloads.ALL);
  const myDownloadView = {
    downloadId(download) {
      return download.target.path + download.startTime.toString(36)
    },
    _downloadsInProgress: new Map(),
    imageURL: "chrome://branding/content/icon128.png",
    extractFilename(download) {
      const fullPath = download.target.path
      var pathSep = '/';    // Linux / (probably) OSX
      var filepath = fullPath.split(pathSep);
      var filename = filepath.pop(filepath.length - 1);
      return filename
    },
    notify(title, message) {
      showAlertNotification(this.imageURL, title, message);
    },
    onDownloadAdded(download) {
      const body = this.extractFilename(download);
      var title;
      if ((Date.now() - 2000) > MOZSTARTUPTIME) {
        title = "Download Added";
      } else {
        title = "Download Resumed";
      }
      this._downloadsInProgress.set(this.downloadId(download), download);
      this.notify(title, body);
      globalThis.globalActiveDownload = this._downloadsInProgress.size > 0;
      setTitle();
    },
    onDownloadChanged(download) {
      var title;
      if (download.succeeded === true) {
        title = 'Download Completed';
      } else if (download.canceled) {
        title = 'Download Cancelled';
      } else if (download.error) {
        title = 'Download Failed';
      } else {
        return
      }
      const body = this.extractFilename(download);
      this._downloadsInProgress.delete(this.downloadId(download));
      globalThis.globalActiveDownload = this._downloadsInProgress.size > 0;
      this.notify(title, body);
      setTitle();
    },
    onDownloadRemoved(download) {
      this._downloadsInProgress.delete(this.downloadId(download));
      globalThis.globalActiveDownload = this._downloadsInProgress.size > 0;
      setTitle();
    }
  };
  await list.addView(myDownloadView);
})();


let UserChrome_js = {
  observe: function (s) {
    s.addEventListener('DOMContentLoaded', this, { once: true });
  },

  handleEvent: async function (evt) {
    const root = evt.originalTarget;
    let window = root.defaultView;
    let console = window.console;
    const closeWindow = (event) => {
      if (event && event.target && event.target.gBrowser) {
        var tabPIDs = new Set(event.target.gBrowser.tabs.reduce((acc, tab) => acc.concat(getTabPids(tab)), []));
        promoteTab(tabPIDs);
      }

      for (let window of browserWindows()) {
        window.setTimeout(updatePIDsAndSetTitle, 300);
      }
    }
    const promoteTab = (tabPids) => {
      // ensures the tab is unsuspended
      const runningPIDs = new Set([...globalThis.RunningPIDs, ...tabPids])
      const foregroundPIDs = new Set([...globalThis.ForegroundPIDs].filter(x => !runningPIDs.has(x)));
      const maxActive = new Set([...runningPIDs, ...foregroundPIDs])
      const inactivePIDs = new Set([...globalThis.INActivePIDs].filter(x => !maxActive.has(x)));
      setTitle({ runningPIDs: runningPIDs, foregroundPIDs: foregroundPIDs, inactivePIDs: inactivePIDs });
    }
    const getTabPids = (tab) => {
      return E10SUtils.getBrowserPids(tab.linkedBrowser, true);
    }

    var intervalId = null;
    var timer = null;

    const updatePIDsAndSetTitle = (event) => {
      let runningPIDs = new Set();
      let foregroundPIDs = new Set();
      let inactivePIDs = new Set();

      let tabs = [];
      for (let win of browserWindows()) {
        tabs.push(...win.gBrowser.tabs)
      }
      var tabMightChangePID = false;
      for (let tab of tabs) {
        var tabPids = getTabPids(tab);
        if (tab.hasAttribute("busy")) {
          tabPids.forEach(pid => runningPIDs.add(pid));
          tabMightChangePID = true;
        } else if ((tab.soundPlaying && !tab.hasAttribute("soundplaying-scheduledremoval")) || tab.pictureinpicture === true) {
          tabPids.forEach(pid => runningPIDs.add(pid));
        } else if (tab.selected === true) {
          tabPids.forEach(pid => foregroundPIDs.add(pid));
        } else if (tab.isEmpty === true) {
          tabPids.forEach(pid => foregroundPIDs.add(pid));
          // "New Tab"
        } else if (tab.hasAttribute("pending") === true) {
          tabPids.forEach(pid => foregroundPIDs.add(pid));
          // tab has not been loaded yet
        } else {
          tabPids.forEach(pid => inactivePIDs.add(pid));
        }
      }

      // cleanup: some tabs share pids, we prefer the active ones.
      runningPIDs.forEach(pid => inactivePIDs.delete(pid));
      runningPIDs.forEach(pid => foregroundPIDs.delete(pid));
      foregroundPIDs.forEach(pid => inactivePIDs.delete(pid));

      // window close
      if (typeof event === 'undefined') {
        setTitle({ runningPIDs: runningPIDs, foregroundPIDs: foregroundPIDs, inactivePIDs: inactivePIDs });
        return
      }

      if ((tabMightChangePID === true) && (intervalId === null)) {
        intervalId = window.setInterval(() => {
          var tabs = [];
          for (let win of browserWindows()) {
            tabs.push(...win.gBrowser.tabs)
          }
          var busyTabs = tabs.filter(tab => tab.hasAttribute("busy"));
          var newBusyPids = new Set(busyTabs.reduce((acc, tab) => acc.concat(getTabPids(tab)), []));
          promoteTab(newBusyPids);
          if (newBusyPids.size === 0) {
            window.clearInterval(intervalId);
            intervalId = null;
          }
        }, 50);
      }

      // keep the previously open tabs for a while
      const runningPIDsUnion = new Set([...globalThis.RunningPIDs, ...runningPIDs])
      const ForegroundPIDsUnion = new Set([...globalThis.ForegroundPIDs, ...foregroundPIDs].filter(x => !runningPIDsUnion.has(x)));
      const inactivePIDsIntersection = new Set([...globalThis.INActivePIDs].filter(x => inactivePIDs.has(x)));
      setTitle({ runningPIDs: runningPIDsUnion, foregroundPIDs: ForegroundPIDsUnion, inactivePIDs: inactivePIDsIntersection });

      if (timer !== null) {
        window.clearTimeout(timer);
      }
      timer = window.setTimeout(setTitle, 500, { runningPIDs: runningPIDs, foregroundPIDs: foregroundPIDs, inactivePIDs: inactivePIDs });
    }

    if (window.gBrowserInit && !window.gBrowserInit.delayedStartupFinished) {
      await window.delayedStartupPromise;
    }

    const winType = evt.originalTarget.location.href;
    if (winType === "chrome://global/content/pictureinpicture/player.xhtml") {
      closeWindow();
      window.addEventListener("close", closeWindow);
      window.addEventListener("click", closeWindow);
    }

    if (winType !== "chrome://browser/content/browser.xhtml") {
      console.log(evt)
      return
    }

    if (!window.gBrowserInit || !window.docShell) {
      return;
    }

    /*******************************************    PLACE UC SNIPPETS BELOW THIS LINE!    *******************************************/

    // ==UserScript==
    // @name            TabPIDsInWindowTitle redux v3
    // @author          trbjo
    // @description     shows the tab pids in the window title
    // @include         main
    // @onlyonce
    // ==/UserScript==

    const { document, gBrowser } = window;
    let tabContainer = gBrowser.tabContainer;

    const titleCallback = (mutationList, observer) => {
      const windowSUFFIX = "Mozilla Firefox";
      for (const mutation of mutationList) {
        let text = mutation.target.innerText;
        if (text.endsWith(windowSUFFIX)) {
          for (let win of browserWindows()) {
            win.document.title = globalThis.presetTitle;
          }
          return
        }
      }
    };

    const afterClose = (event) => {
      tab = event.target;
      if (tab.collapsed === true || !tab.linkedBrowser) {
        updatePIDsAndSetTitle("delay");
      }
    }

    const closeTab = (event) => {
      tab = event.target;
      let tabPIDs = getTabPids(tab);
      promoteTab(tabPIDs);
    }

    const titleObserver = new window.MutationObserver(titleCallback);
    const titleNode = document.head.querySelector('title');
    const config = { attributes: true, childList: true, subtree: true };
    titleObserver.observe(titleNode, config);

    const listeners = [
      // "TabSelect",
      // "TabClose",
      "TabAttrModified",
      "SSTabRestored",
      // "TabHide",
      // "TabShow",
      // "TabOpen",
      // "TabPinned",
      // "TabUnpinned",
      // "transitionend",
    ]
    listeners.forEach(event => {
      tabContainer.addEventListener(event, updatePIDsAndSetTitle, false);
    });
    tabContainer.addEventListener("TabClose", closeTab, false);
    tabContainer.addEventListener("transitionend", afterClose, false);
    window.addEventListener("close", closeWindow);

    console.info('\u2713 TabPIDsInWindowTitle');

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /*******************************************    PLACE UC SNIPPETS ABOVE THIS LINE!    *******************************************/
  }
};

if (!Services.appinfo.inSafeMode) {
  Services.obs.addObserver(UserChrome_js, 'chrome-document-global-created', false);
}
/// ^,^

