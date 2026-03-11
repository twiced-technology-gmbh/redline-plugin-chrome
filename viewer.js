const dropZone = document.getElementById('dropZone');
const viewer = document.getElementById('viewer');
const fileInput = document.getElementById('fileInput');
const fileMeta = document.getElementById('fileMeta');
const newBtn = document.getElementById('newBtn');
const screenshotContainer = document.getElementById('screenshotContainer');
const screenshotImg = document.getElementById('screenshotImg');
const annotationsList = document.getElementById('annotationsList');
const jsonOutput = document.getElementById('jsonOutput');

// Tab switching
document.querySelectorAll('.tab').forEach((tab) => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('panel-' + tab.dataset.tab).classList.add('active');
  });
});

// Prevent Chrome from navigating to dropped files
document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

// Drop zone
dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  const file = e.dataTransfer.files[0];
  if (file) loadFile(file);
});

dropZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

function loadFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      render(data, file.name);
    } catch (err) {
      console.error('Failed to parse JSON:', err);
      dropZone.querySelector('p').textContent = 'Invalid JSON file. Try again.';
    }
  };
  reader.readAsText(file);
}

// New button — reset viewer and show drop zone
newBtn.addEventListener('click', () => {
  viewer.hidden = true;
  dropZone.hidden = false;
  newBtn.hidden = true;
  fileMeta.innerHTML = '';
  screenshotImg.src = '';
  annotationsList.innerHTML = '';
  jsonOutput.innerHTML = '';
  fileInput.value = '';
  // Reset tabs to screenshot
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
  document.querySelector('.tab[data-tab="screenshot"]').classList.add('active');
  document.getElementById('panel-screenshot').classList.add('active');
});

function render(data, filename) {
  dropZone.hidden = true;
  viewer.hidden = false;
  newBtn.hidden = false;

  // Header meta
  const parts = [];
  if (filename) parts.push(`<span>${escapeHtml(filename)}</span>`);
  if (data.view) parts.push(`<span>View: ${escapeHtml(data.view)}</span>`);
  if (data.timestamp) {
    const d = new Date(data.timestamp);
    parts.push(`<span>${d.toLocaleDateString()} ${d.toLocaleTimeString()}</span>`);
  }
  if (data.annotations) parts.push(`<span>${data.annotations.length} annotation(s)</span>`);
  fileMeta.innerHTML = parts.join('');

  // Screenshot — merge page + annotations into a single composite
  const screenshots = data.screenshots || {};
  const pageImg = screenshots.page || data.screenshot; // fallback to legacy field
  const annotationsImg = screenshots.annotations;

  if (pageImg || annotationsImg) {
    compositeScreenshots(pageImg, annotationsImg).then((compositeUrl) => {
      screenshotImg.src = compositeUrl;
    });
  } else {
    screenshotContainer.innerHTML =
      '<p style="padding:40px;color:#71717a;">No screenshot in this file.</p>';
  }

  // Annotations list
  renderAnnotations(data.annotations || []);

  // JSON (strip screenshots from display to keep it manageable)
  const displayData = { ...data };
  if (displayData.screenshot) {
    displayData.screenshot = displayData.screenshot.substring(0, 60) + '... (base64 image)';
  }
  if (displayData.screenshots) {
    displayData.screenshots = {};
    if (screenshots.page) displayData.screenshots.page = screenshots.page.substring(0, 60) + '... (base64 image)';
    if (screenshots.annotations) displayData.screenshots.annotations = screenshots.annotations.substring(0, 60) + '... (base64 image)';
  }
  // Strip computedCss from annotations for cleaner JSON view
  if (displayData.annotations) {
    displayData.annotations = displayData.annotations.map((a) => {
      const clean = { ...a };
      if (clean.computedCss) {
        clean.computedCss = '(collapsed — see Annotations tab)';
      }
      return clean;
    });
  }
  jsonOutput.innerHTML = syntaxHighlight(JSON.stringify(displayData, null, 2));
}

function compositeScreenshots(pageUrl, annotationsUrl) {
  return new Promise((resolve) => {
    // If only one is available, use it directly
    if (!pageUrl && annotationsUrl) return resolve(annotationsUrl);
    if (pageUrl && !annotationsUrl) return resolve(pageUrl);

    // Load both images and draw page first, annotations on top
    const pageImage = new Image();
    const annotationsImage = new Image();
    let loaded = 0;

    function tryComposite() {
      loaded++;
      if (loaded < 2) return;
      const w = Math.max(pageImage.naturalWidth || 0, annotationsImage.naturalWidth || 0);
      const h = Math.max(pageImage.naturalHeight || 0, annotationsImage.naturalHeight || 0);
      if (w === 0 || h === 0) return resolve(pageUrl || annotationsUrl);

      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (pageImage.naturalWidth) ctx.drawImage(pageImage, 0, 0, w, h);
      if (annotationsImage.naturalWidth) ctx.drawImage(annotationsImage, 0, 0, w, h);
      resolve(canvas.toDataURL('image/png'));
    }

    pageImage.onload = tryComposite;
    pageImage.onerror = tryComposite;
    annotationsImage.onload = tryComposite;
    annotationsImage.onerror = tryComposite;

    pageImage.src = pageUrl;
    annotationsImage.src = annotationsUrl;
  });
}

function renderAnnotations(annotations) {
  if (annotations.length === 0) {
    annotationsList.innerHTML =
      '<p style="padding:20px;color:#71717a;">No annotations in this file.</p>';
    return;
  }

  annotationsList.innerHTML = annotations
    .map((a, i) => {
      const details = [];
      if (a.intent) details.push(`<dt>Intent</dt><dd>${escapeHtml(a.intent)}</dd>`);
      if (a.from && a.to)
        details.push(`<dt>From → To</dt><dd>(${a.from.x}, ${a.from.y}) → (${a.to.x}, ${a.to.y})</dd>`);
      if (a.position)
        details.push(`<dt>Position</dt><dd>x: ${a.position.x}, y: ${a.position.y}</dd>`);
      if (a.nearTagName) details.push(`<dt>Near Element</dt><dd>&lt;${a.nearTagName.toLowerCase()}&gt;${a.nearClasses ? ' .' + escapeHtml(a.nearClasses.split(' ')[0]) : ''}</dd>`);
      if (a.fromTagName) details.push(`<dt>From Element</dt><dd>&lt;${a.fromTagName.toLowerCase()}&gt;${a.fromClasses ? ' .' + escapeHtml(a.fromClasses.split(' ')[0]) : ''}</dd>`);
      if (a.tagName) details.push(`<dt>Element</dt><dd>&lt;${a.tagName.toLowerCase()}&gt;</dd>`);
      if (a.classes) details.push(`<dt>Classes</dt><dd>${escapeHtml(a.classes)}</dd>`);
      if (a.text) details.push(`<dt>Text</dt><dd>${escapeHtml(a.text)}</dd>`);

      const selector = a.selector || a.nearSelector;
      const selectorSection = selector
        ? `<details class="annotation-collapse">
            <summary>Selector${a.nearSelector ? ' (nearest)' : ''}</summary>
            <pre>${escapeHtml(selector)}</pre>
           </details>`
        : '';

      const fromSelectorSection = a.fromSelector
        ? `<details class="annotation-collapse">
            <summary>From Selector</summary>
            <pre>${escapeHtml(a.fromSelector)}</pre>
           </details>`
        : '';

      const htmlSection = a.html
        ? `<details class="annotation-collapse">
            <summary>HTML${a.nearSelector ? ' (nearest)' : ''}</summary>
            <pre>${escapeHtml(a.html)}</pre>
           </details>`
        : '';

      const childHintsSection = a.childHints && a.childHints.length
        ? `<details class="annotation-collapse">
            <summary>Child Hints (${a.childHints.length})</summary>
            <pre>${escapeHtml(JSON.stringify(a.childHints, null, 2))}</pre>
           </details>`
        : '';

      const cssSection = a.computedCss
        ? `<details class="annotation-collapse">
            <summary>Computed CSS (${Object.keys(a.computedCss).length} properties)</summary>
            <pre>${escapeHtml(JSON.stringify(a.computedCss, null, 2))}</pre>
           </details>`
        : '';

      return `
        <div class="annotation-card">
          <div class="annotation-card-header">
            <div class="annotation-badge">${i + 1}</div>
            <span class="annotation-type">${escapeHtml(a.type || 'annotation')}</span>
            ${a.tagName ? `<span class="annotation-tag">&lt;${a.tagName.toLowerCase()}&gt;</span>` : ''}
          </div>
          ${a.comment ? `<div class="annotation-comment">${escapeHtml(a.comment)}</div>` : ''}
          <dl class="annotation-details">${details.join('')}</dl>
          ${selectorSection}
          ${fromSelectorSection}
          ${htmlSection}
          ${childHintsSection}
          ${cssSection}
        </div>`;
    })
    .join('');
}

function syntaxHighlight(json) {
  return json.replace(
    /("(\\u[a-fA-F0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?|[{}\[\],:])/g,
    (match) => {
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          return `<span class="json-key">${escapeHtml(match.slice(0, -1))}</span><span class="json-colon">:</span>`;
        }
        return `<span class="json-string">${escapeHtml(match)}</span>`;
      }
      if (/true|false/.test(match)) {
        return `<span class="json-boolean">${match}</span>`;
      }
      if (/null/.test(match)) {
        return `<span class="json-null">${match}</span>`;
      }
      if (/[{}\[\]]/.test(match)) {
        return `<span class="json-bracket">${match}</span>`;
      }
      if (/[,]/.test(match)) {
        return `<span class="json-comma">${match}</span>`;
      }
      return `<span class="json-number">${match}</span>`;
    }
  );
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// Fullscreen lightbox
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

screenshotContainer.addEventListener('click', (e) => {
  if (!screenshotImg.src) return;
  lightboxImg.src = screenshotImg.src;
  lightbox.classList.add('open');
});

lightbox.addEventListener('click', () => lightbox.classList.remove('open'));
document.getElementById('lightboxClose').addEventListener('click', () => lightbox.classList.remove('open'));
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') lightbox.classList.remove('open');
});

// No resize handler needed — screenshot is a static composited image
