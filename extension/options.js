const apiInput = document.querySelector('#api');
const proactiveInput = document.querySelector('#proactive');

chrome.storage.sync.get(['apiUrl', 'proactiveWarning'], ({ apiUrl, proactiveWarning }) => {
  apiInput.value = apiUrl || '';
  proactiveInput.checked = proactiveWarning !== false; // defaults to on
});

document.querySelector('#save').addEventListener('click', () => {
  chrome.storage.sync.set(
    {
      apiUrl: apiInput.value.trim(),
      proactiveWarning: proactiveInput.checked,
    },
    () => {
      document.querySelector('#saved').textContent = 'Settings saved.';
    },
  );
});
