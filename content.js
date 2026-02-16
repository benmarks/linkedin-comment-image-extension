// LinkedIn Comment Image Paste Extension v0.2

(function() {
  'use strict';

  let pendingImageFile = null;
  let config = { debug: false };

  // Load config from storage
  chrome.storage.sync.get(['debug'], (result) => {
    config.debug = result.debug || false;
    log('Config loaded, debug:', config.debug);
    if (config.debug) {
      showToast('LinkedIn Paste active', 'success', 2000);
    }
  });

  // Listen for config changes
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.debug) {
      config.debug = changes.debug.newValue;
      log('Debug mode changed to:', config.debug);
    }
  });

  function log(...args) {
    if (config.debug) {
      console.log('[LinkedIn Paste]', ...args);
    }
  }

  // ============ TOAST NOTIFICATIONS ============
  function showToast(message, type = 'info', duration = 4000) {
    const existing = document.getElementById('linkedin-paste-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.id = 'linkedin-paste-toast';
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 14px 24px;
      background: ${type === 'success' ? '#0a66c2' : type === 'error' ? '#cc1016' : '#333'};
      color: white;
      border-radius: 8px;
      font-family: -apple-system, system-ui, sans-serif;
      font-size: 14px;
      font-weight: 500;
      z-index: 9999999;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
      max-width: 350px;
    `;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  // ============ CHECK IF IN QUILL/COMMENT EDITOR ============
  function isInCommentEditor(target) {
    if (!target) return false;
    
    let el = target;
    for (let i = 0; i < 20 && el; i++) {
      const classes = el.className || '';
      
      if (classes.includes('ql-editor') || 
          classes.includes('ql-container') ||
          classes.includes('quill') ||
          classes.includes('comment') ||
          classes.includes('editor') ||
          classes.includes('mentions')) {
        return true;
      }
      
      if (el.isContentEditable || el.contentEditable === 'true') {
        return true;
      }
      
      el = el.parentElement;
    }
    
    return false;
  }

  // ============ GET IMAGE FROM CLIPBOARD ============
  function getImageFromClipboard(clipboardData) {
    if (!clipboardData || !clipboardData.items) return null;

    for (let i = 0; i < clipboardData.items.length; i++) {
      const item = clipboardData.items[i];
      log('Clipboard item:', item.type, item.kind);
      
      if (item.type.startsWith('image/')) {
        const blob = item.getAsFile();
        if (blob) {
          const ext = item.type.split('/')[1] || 'png';
          return new File([blob], `paste-${Date.now()}.${ext}`, { type: item.type });
        }
      }
    }
    return null;
  }

  // ============ FIND COMMENT BOX CONTAINER ============
  function findCommentContainer(startElement) {
    let el = startElement;
    for (let i = 0; i < 30 && el; i++) {
      const classes = (el.className || '').toLowerCase();
      
      // LinkedIn comment box containers
      if (classes.includes('comments-comment-box') ||
          classes.includes('comment-box') ||
          classes.includes('comments-comment-texteditor') ||
          el.matches('[class*="comments-comment-box"]')) {
        log('Found comment container:', el.className);
        return el;
      }
      
      // Also check for form elements that might contain the input
      if (el.tagName === 'FORM' && classes.includes('comment')) {
        log('Found comment form:', el.className);
        return el;
      }
      
      el = el.parentElement;
    }
    return null;
  }

  // ============ FIND FILE INPUT - AGGRESSIVE SEARCH ============
  function findFileInput(startElement) {
    // First, try to find the comment container
    const container = findCommentContainer(startElement);
    
    // Search in container first
    if (container) {
      const inputs = container.querySelectorAll('input[type="file"]');
      log('File inputs in container:', inputs.length);
      if (inputs.length > 0) {
        return inputs[0];
      }
    }

    // Search up the DOM from the active element
    let searchEl = startElement;
    for (let i = 0; i < 30 && searchEl; i++) {
      const inputs = searchEl.querySelectorAll('input[type="file"]');
      if (inputs.length > 0) {
        log('Found file input at level', i);
        return inputs[0];
      }
      searchEl = searchEl.parentElement;
    }
    
    // Search siblings and nearby elements of the comment container
    if (container && container.parentElement) {
      const parent = container.parentElement;
      const inputs = parent.querySelectorAll('input[type="file"]');
      log('File inputs in parent:', inputs.length);
      if (inputs.length > 0) {
        return inputs[0];
      }
    }

    // Last resort: find all file inputs and pick the most relevant one
    const allInputs = document.querySelectorAll('input[type="file"]');
    log('Total file inputs on page:', allInputs.length);
    
    // Try to find one related to the active comment area
    for (const input of allInputs) {
      // Check if this input is near our active element in the DOM
      const inputRect = input.getBoundingClientRect();
      const activeRect = startElement.getBoundingClientRect();
      
      // If they're vertically close (within 300px), likely related
      if (Math.abs(inputRect.top - activeRect.top) < 300) {
        log('Found nearby file input by position');
        return input;
      }
    }
    
    return null;
  }

  // ============ SET FILE ON INPUT ============
  function setFileOnInput(input, file) {
    try {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      
      // Dispatch multiple events to ensure LinkedIn picks it up
      input.dispatchEvent(new Event('change', { bubbles: true }));
      input.dispatchEvent(new Event('input', { bubbles: true }));
      
      // Also try a more complete change event
      const changeEvent = new Event('change', { 
        bubbles: true, 
        cancelable: true 
      });
      input.dispatchEvent(changeEvent);
      
      log('File set on input successfully');
      return true;
    } catch (e) {
      log('Error setting file on input:', e);
      return false;
    }
  }

  // ============ FIND AND CLICK IMAGE BUTTON (only if needed) ============
  function findAndClickImageButton(startElement) {
    const container = findCommentContainer(startElement);
    if (!container) return false;
    
    // Look for the image/media button
    const buttons = container.querySelectorAll('button, [role="button"]');
    for (const btn of buttons) {
      const label = (btn.getAttribute('aria-label') || '').toLowerCase();
      
      if (label.includes('image') || label.includes('photo') || label.includes('media')) {
        log('Found image button:', btn);
        btn.click();
        return true;
      }
    }
    
    // Also check parent container
    if (container.parentElement) {
      const parentButtons = container.parentElement.querySelectorAll('button, [role="button"]');
      for (const btn of parentButtons) {
        const label = (btn.getAttribute('aria-label') || '').toLowerCase();
        if (label.includes('image') || label.includes('photo') || label.includes('media')) {
          log('Found image button in parent:', btn);
          btn.click();
          return true;
        }
      }
    }
    
    return false;
  }

  // ============ MAIN PASTE HANDLER ============
  function handleWindowPaste(event) {
    log('===== PASTE EVENT =====');
    
    const target = document.activeElement;
    log('Active element:', target?.tagName, target?.className);

    if (!isInCommentEditor(target)) {
      log('Not in editor, ignoring');
      return;
    }

    const clipboardData = event.clipboardData;
    const imageFile = getImageFromClipboard(clipboardData);

    if (!imageFile) {
      log('No image in clipboard');
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    log('Image intercepted:', imageFile.name, imageFile.size);
    pendingImageFile = imageFile;

    // STEP 1: Try to find existing file input without clicking anything
    let fileInput = findFileInput(target);
    
    if (fileInput) {
      log('Found file input directly, attempting to set file');
      const success = setFileOnInput(fileInput, imageFile);
      if (success) {
        showToast('✓ Image attached!', 'success');
        pendingImageFile = null;
        return;
      }
    }

    // STEP 2: Click the image button to reveal/activate file input
    log('No file input found, clicking image button...');
    const clicked = findAndClickImageButton(target);
    
    if (clicked) {
      // Wait for the input to become available, then set file
      setTimeout(() => {
        const newFileInput = findFileInput(target);
        if (newFileInput && pendingImageFile) {
          // Intercept the file dialog opening
          const originalClick = newFileInput.click;
          newFileInput.click = function() {
            log('Intercepted file input click');
            // Don't actually click - we're setting the file programmatically
          };
          
          const success = setFileOnInput(newFileInput, pendingImageFile);
          
          // Restore original click
          newFileInput.click = originalClick;
          
          if (success) {
            showToast('✓ Image attached!', 'success');
            pendingImageFile = null;
            return;
          }
        }
        
        // If we still couldn't attach, show fallback message
        if (pendingImageFile) {
          showToast('📷 Image ready - click the 📷 icon to upload', 'info', 6000);
        }
      }, 300);
    } else {
      showToast('📷 Image ready - click the 📷 icon to upload', 'info', 6000);
    }
  }

  // ============ MONITOR FILE INPUTS FOR MANUAL CLICK ============
  function monitorFileInputs() {
    document.addEventListener('click', (e) => {
      if (e.target.matches('input[type="file"]') && pendingImageFile) {
        setTimeout(() => {
          try {
            const dt = new DataTransfer();
            dt.items.add(pendingImageFile);
            e.target.files = dt.files;
            e.target.dispatchEvent(new Event('change', { bubbles: true }));
            showToast('✓ Image attached!', 'success');
            pendingImageFile = null;
          } catch (err) {
            log('Could not attach to file input');
          }
        }, 100);
      }
    }, true);
  }

  // ============ INITIALIZATION ============
  window.addEventListener('paste', handleWindowPaste, true);
  monitorFileInputs();

})();
