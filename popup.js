document.getElementById('annotate').addEventListener('click', async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) return;
  chrome.runtime.sendMessage({ action: 'toggle-overlay', tabId: tab.id });
  window.close();
});

document.getElementById('viewer').addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('viewer.html') });
  window.close();
});

// Show correct shortcut key for platform
if (!navigator.platform.toUpperCase().includes('MAC')) {
  document.querySelector('.annotate-shortcut').textContent = 'Alt+Shift+A';
  document.querySelector('.viewer-shortcut').textContent = 'Alt+Shift+V';
}
