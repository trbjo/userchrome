/// Create in Firefox-Install-Directory/UserChrome.js - a minimal bootstrap to run js snippets on startup - AveYo, 2023.09.14
/// Requires: Firefox-Install-Directory/defaults/pref/enable-UserChrome.js

let { classes: Cc, interfaces: Ci, manager: Cm, utils: Cu } = Components;

const Services = globalThis.Services || Components.utils.import("resource://gre/modules/Services.jsm").Services;

const { E10SUtils } = ChromeUtils.import("resource://gre/modules/E10SUtils.jsm");

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

let UserChrome_js = {
  observe: function (s) {
    s.addEventListener('DOMContentLoaded', this, { once: true });
  },

  handleEvent: async function (evt) {
    let browser = evt.originalTarget, document = browser, window = browser.defaultView, console = window.console;

    if (window.gBrowserInit && !window.gBrowserInit.delayedStartupFinished) {
      await window.delayedStartupPromise;
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

    if (typeof UC === 'undefined') UC = {};

    UC.TabPIDsInWindowTitle = {
      init: function () {
        var { document, gBrowser } = window;
        let tabContainer = gBrowser.tabContainer;
        const divider = "|||";
        const windowSUFFIX = "Mozilla Firefox";

        document.globalActivePIDs = new Set();
        document.globalINActivePIDs = new Set();


        function collectAllPIDs() {
          let allPids = new Set();
          var allTabs = tabContainer._allTabs;
          for (var i = 0; i < allTabs.length; i++) {
            tab = allTabs[i];
            let { linkedBrowser } = tab;
            var tabPids = E10SUtils.getBrowserPids(linkedBrowser, true);
            tabPids.forEach(pid => allPids.add(pid));
          };
          return allPids
        }

        function pidsForTabEvent(event) {
          const tab = event.target;
          let { linkedBrowser } = tab;
          var tabPids = E10SUtils.getBrowserPids(linkedBrowser, true);
          return new Set(tabPids)
        }

        function updatePIDsInState(event) {
          selected = event.target.selected === true;
          if (!selected) {
            // we are in the middle of an update and just return
            return
          }
          let activePIDs = pidsForTabEvent(event);
          document.globalActivePIDs = activePIDs;

          let allPIDs = collectAllPIDs();
          activePIDs.forEach(pid => allPIDs.delete(pid));
          document.globalINActivePIDs = allPIDs;
        };

        function setTitle() {
          let titleString = Array.from(document.globalActivePIDs).join(",");
          titleString += divider;
          titleString += Array.from(document.globalINActivePIDs).join(",");
          document.title = titleString;
        }



        // Callback function to execute when mutations are observed
        const callback = (mutationList, observer) => {
          for (const mutation of mutationList) {
            if (mutation.type === "childList") {
              let text = mutation.target.innerText;
              if (text.endsWith(windowSUFFIX)) {
                setTitle();
              }
            }
          }
        };



        // Create an observer instance linked to the callback function

        function logEvent(event) {
          console.log(event)
          console.log(event.type, event.target)
        }

        function updateStateAndSetTitle(event) {
          // logEvent(event);
          updatePIDsInState(event);
          setTitle();
        }

        const listeners = [
          // "TabSelect",
          // "TabClose",
          "TabAttrModified",
          // "TabHide",
          // "TabShow",
          // TabOpen,
          // "TabPinned",
          // "TabUnpinned",
          // "transitionend",
        ]

        listeners.forEach(event => {
          tabContainer.addEventListener(event, updateStateAndSetTitle, false);
        });

        const observer = new window.MutationObserver(callback);
        const titleNode = document.head.querySelector('title');
        const config = { attributes: true, childList: true, subtree: true };
        observer.observe(titleNode, config);
        console.info('\u2713 TabPIDsInWindowTitle');
      }
    };
    UC.TabPIDsInWindowTitle.init();

    //////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

    /*******************************************    PLACE UC SNIPPETS ABOVE THIS LINE!    *******************************************/
  }
};

if (!Services.appinfo.inSafeMode) {
  Services.obs.addObserver(UserChrome_js, 'chrome-document-global-created', false);
}
/// ^,^

