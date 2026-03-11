// Fallback bridge: capture requests via DOM mutation (shared between MAIN and ISOLATED worlds)
if (!window.__redline_bridge) {
  window.__redline_bridge = true;
  const startObserver = () => {
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1 && node.id === '__redline_capture_req') {
            node.remove();
            chrome.runtime.sendMessage({ action: 'capture-tab' });
            return;
          }
        }
      }
    }).observe(document.body, { childList: true });
  };
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);
}
