const injectedTabs = new Map();

// Keyboard shortcuts
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'toggle-overlay') {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.id) toggleOverlay(tab.id);
  } else if (command === 'open-viewer') {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
  }
});

// Message from content script / capture bridge
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'toggle-overlay' && msg.tabId) {
    toggleOverlay(msg.tabId);
  } else if (msg.action === 'capture-tab' && sender.tab) {
    const tabId = sender.tab.id;
    chrome.tabs.captureVisibleTab(sender.tab.windowId, { format: 'jpeg', quality: 70 }, (dataUrl) => {
      if (chrome.runtime.lastError) {
        console.error('[Redline] captureVisibleTab error:', chrome.runtime.lastError.message);
      }
      // Inject result directly into MAIN world — bypasses ISOLATED↔MAIN boundary
      chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (url) => { window.__redline_capture_data = url; },
        args: [dataUrl || null]
      }).catch((err) => console.error('[Redline] Failed to inject capture result:', err));
      sendResponse({ ok: true });
    });
    return true;
  }
});

async function ensureCaptureBridge(tabId) {
  await chrome.scripting.executeScript({
    target: { tabId },
    func: () => {
      // Disconnect old observer (stale after extension reload)
      if (window.__redline_observer) {
        window.__redline_observer.disconnect();
      }
      window.__redline_observer = new MutationObserver((mutations) => {
        for (const m of mutations) {
          for (const node of m.addedNodes) {
            if (node.nodeType === 1 && node.id === '__redline_capture_req') {
              node.remove();
              chrome.runtime.sendMessage({ action: 'capture-tab' });
              return;
            }
          }
        }
      });
      window.__redline_observer.observe(document.body, { childList: true });
    },
  });
}

async function toggleOverlay(tabId) {
  try {
    // Always ensure capture bridge is present (survives extension reloads)
    await ensureCaptureBridge(tabId);

    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => !!window.__redline_initialized,
    });

    if (result.result) {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
          document.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'A',
              code: 'KeyA',
              altKey: true,
              shiftKey: true,
              metaKey: isMac,
              ctrlKey: !isMac,
              bubbles: true,
            })
          );
        },
      });
    } else {
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['lib/fabric.min.js'],
      });
      await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        files: ['lib/annotation-overlay.js'],
      });
      injectedTabs.set(tabId, true);
    }
  } catch (err) {
    console.error('[Redline] Failed to inject:', err);
  }
}

chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});
