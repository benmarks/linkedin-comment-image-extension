// Load current settings
chrome.storage.sync.get(['debug'], (result) => {
  document.getElementById('debug').checked = result.debug || false;
});

// Save settings on change
document.getElementById('debug').addEventListener('change', (e) => {
  chrome.storage.sync.set({ debug: e.target.checked });
});
