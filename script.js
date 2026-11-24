(function () {
  'use strict';

  var FORMSPREE_ENDPOINT = 'https://formspree.io/f/mzerykyj';
  var CONTACT_EMAIL = 'novascholarsacademy@icloud.com';
  var CALENDLY_URL = 'https://calendly.com/novascholars/1-hour-tutoring-session';

  var REQUEST_CATALOG = {
    notes: {
      label: 'Notes Refinement',
      tiers: {
        standard: {
          name: 'Standard Tier',
          price: '$20 / set',
          summary: 'Cleanly organized, legible notes ready for regular class review.',
          features: [
            'Clean formatting and logical headings',
            'Corrected typos, equations, and definitions',
            'Consistent bullet hierarchy for easy reading',
          ],
        },
        pro: {
          name: 'Pro Tier',
          price: '$40 / set',
          summary: 'Exam-ready study package built directly from your class notes.',
          features: [
            'Everything in Notes Standard',
            'Condensed unit and chapter summaries',
            'Key formulas and concepts highlighted',
            'Full exam-ready study guide structure',
          ],
        },
      },
    },
    'study-guide': {
      label: 'Study Guides & Exam Preparation',
      tiers: {
        standard: {
          name: 'Standard Tier',
          price: '$25',
          summary: 'Focused study guide for a single quiz, unit, or topic review.',
          features: [
            'Structured topic outline and key concepts',
            'Essential formulas, definitions, and takeaways',
            'Targeted review checklist before your test',
          ],
        },
        pro: {
          name: 'Pro Tier',
          price: '$60',
          summary: 'Comprehensive exam-prep packet for midterms, finals, or major units.',
          features: [
            'Multi-unit synthesis and concept connections',
            'Step-by-step worked example walkthroughs',
            'Practice questions with guided review tips',
            'Personalized multi-day exam pacing plan',
          ],
        },
      },
    },
  };

  function initMobileNav() {
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.getElementById('primary-nav');
    if (!toggle || !nav) return;

    function setOpen(isOpen) {
      nav.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
    }

    toggle.addEventListener('click', function () {
      var expanded = toggle.getAttribute('aria-expanded') === 'true';
      setOpen(!expanded);
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        setOpen(false);
        toggle.focus();
      }
    });

    document.addEventListener('click', function (event) {
      if (
        nav.classList.contains('is-open') &&
        !nav.contains(event.target) &&
        !toggle.contains(event.target)
      ) {
        setOpen(false);
      }
    });
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  function isValidHttpUrl(value) {
    try {
      var parsed = new URL(value);
      return parsed.protocol === 'https:' || parsed.protocol === 'http:';
    } catch {
      return false;
    }
  }

  function setFieldError(inputEl, message) {
    if (!inputEl) return;
    var errorEl = document.getElementById(inputEl.id + '-error');
    if (message) {
      inputEl.setAttribute('aria-invalid', 'true');
      if (errorEl) errorEl.textContent = message;
    } else {
      inputEl.removeAttribute('aria-invalid');
      if (errorEl) errorEl.textContent = '';
    }
  }

  function showStatus(container, type, text, fallbackMailto) {
    if (!container) return;
    container.className = 'form-status is-visible ' + type;
    container.textContent = '';

    var p = document.createElement('p');
    p.style.margin = '0';
    p.textContent = text;
    container.appendChild(p);

    if (fallbackMailto) {
      var actions = document.createElement('div');
      actions.className = 'fallback-actions';
      var link = document.createElement('a');
      link.className = 'cta-btn-secondary';
      link.href = fallbackMailto;
      link.textContent = 'Email Request Directly';
      actions.appendChild(link);
      container.appendChild(actions);
    }
  }

  function buildMailtoHref(subject, body) {
    return (
      'mailto:' +
      CONTACT_EMAIL +
      '?subject=' +
      encodeURIComponent(subject) +
      '&body=' +
      encodeURIComponent(body)
    );
  }

  function applyIframeTarget(btn) {
    try {
      if (window.self !== window.top) {
        btn.setAttribute('target', '_blank');
        btn.setAttribute('rel', 'noopener noreferrer');
      }
    } catch {
      btn.setAttribute('target', '_blank');
      btn.setAttribute('rel', 'noopener noreferrer');
    }
  }

  var serverConfigPromise = null;
  function getServerConfig() {
    if (!serverConfigPromise) {
      serverConfigPromise = fetch('/api/public-config', {
        headers: { Accept: 'application/json' },
      })
        .then(function (res) {
          if (!res.ok) return { _staticOnly: true };
          var ct = res.headers.get('content-type') || '';
          if (ct.indexOf('application/json') === -1) return { _staticOnly: true };
          return res.json();
        })
        .catch(function () {
          return { _staticOnly: true };
        });
    }
    return serverConfigPromise;
  }

  function initStripeCheckout() {
    var buttons = document.querySelectorAll('[data-stripe-plan]');
    if (!buttons.length) return;

    buttons.forEach(function (btn) {
      var initialUrl = btn.getAttribute('data-stripe-url') || '';
      if (isValidHttpUrl(initialUrl)) {
        btn.setAttribute('href', initialUrl);
        applyIframeTarget(btn);
      }
    });

    getServerConfig()
      .then(function (config) {
        buttons.forEach(function (btn) {
          var plan = btn.getAttribute('data-stripe-plan');
          var configuredUrl =
            plan === 'monthly'
              ? config.monthlyPlanCheckoutUrl
              : config.singleSessionCheckoutUrl;
          var fallbackAttr = btn.getAttribute('data-stripe-url') || '';
          var checkoutUrl =
            configuredUrl && isValidHttpUrl(configuredUrl)
              ? configuredUrl
              : isValidHttpUrl(fallbackAttr)
              ? fallbackAttr
              : '';

          var statusBox = document.getElementById(
            plan === 'monthly' ? 'monthly-checkout-status' : 'single-checkout-status'
          );

          if (checkoutUrl) {
            btn.setAttribute('href', checkoutUrl);
            applyIframeTarget(btn);
            if (statusBox) {
              statusBox.className = 'form-status';
              statusBox.textContent = '';
            }
            return;
          }

          btn.addEventListener('click', function (event) {
            event.preventDefault();
            var label =
              plan === 'monthly'
                ? 'Monthly Tutoring Plan ($175/month)'
                : 'Single Tutoring Session ($50)';
            var mailto = buildMailtoHref(
              'Checkout Request: ' + label,
              'Hi NovaScholars Academy,\n\nI would like to enroll in / purchase: ' +
                label +
                '.\nPlease send me the active Stripe payment link.\n\nStudent Name:\nSubject / Grade Level:\nPreferred Days/Times:\n'
            );
            showStatus(
              statusBox,
              'info',
              'Online Stripe checkout for the ' +
                label +
                ' is pending final payment-link activation in site configuration. You can request a direct payment link via email or contact us to get scheduled right away.',
              mailto
            );
          });
        });
      });
  }

  function initContactForm() {
    var form = document.getElementById('contact-form');
    if (!form) return;

    var nameInput = document.getElementById('name');
    var emailInput = document.getElementById('email');
    var serviceInput = document.getElementById('service');
    var messageInput = document.getElementById('message');
    var statusEl = document.getElementById('contact-form-status');
    var submitBtn = form.querySelector('button[type="submit"]');

    function validate() {
      var valid = true;
      var nameVal = nameInput.value.trim();
      var emailVal = emailInput.value.trim();
      var messageVal = messageInput.value.trim();

      if (nameVal.length < 2) {
        setFieldError(nameInput, 'Please enter your full name.');
        valid = false;
      } else {
        setFieldError(nameInput, '');
      }

      if (!isValidEmail(emailVal)) {
        setFieldError(emailInput, 'Please enter a valid email address.');
        valid = false;
      } else {
        setFieldError(emailInput, '');
      }

      if (messageVal.length < 10) {
        setFieldError(
          messageInput,
          'Please include a short message (at least 10 characters) describing how we can help.'
        );
        valid = false;
      } else {
        setFieldError(messageInput, '');
      }

      return valid;
    }

    [nameInput, emailInput, messageInput].forEach(function (input) {
      input.addEventListener('input', function () {
        if (input.getAttribute('aria-invalid') === 'true') {
          validate();
        }
      });
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!validate()) {
        showStatus(statusEl, 'error', 'Please fix the highlighted fields before sending.');
        return;
      }

      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Sending...';

      var mailtoFallback = buildMailtoHref(
        'NovaScholars Inquiry: ' + serviceInput.value,
        'Name: ' +
          nameInput.value.trim() +
          '\nEmail: ' +
          emailInput.value.trim() +
          '\nInterested In: ' +
          serviceInput.value +
          '\n\nMessage:\n' +
          messageInput.value.trim()
      );

      var jsonBody = {
        name: nameInput.value.trim(),
        email: emailInput.value.trim(),
        service: serviceInput.value,
        message: messageInput.value.trim(),
      };

      getServerConfig()
        .then(function (config) {
          if (config._staticOnly || !config.emailDeliveryConfigured) {
            return fetch(FORMSPREE_ENDPOINT, {
              method: 'POST',
              body: new FormData(form),
              headers: { Accept: 'application/json' },
            }).then(function (fsRes) {
              if (!fsRes.ok) {
                throw new Error('Form delivery returned status ' + fsRes.status + '.');
              }
              return true;
            });
          }

          return fetch('/api/contact', {
            method: 'POST',
            body: JSON.stringify(jsonBody),
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
          }).then(function (response) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (data) {
                if (response.ok) {
                  return true;
                }
                var noServerBackend =
                  response.status === 404 ||
                  response.status === 405 ||
                  (response.status === 503 && data && data.code === 'SMTP_NOT_CONFIGURED');
                if (noServerBackend) {
                  return fetch(FORMSPREE_ENDPOINT, {
                    method: 'POST',
                    body: new FormData(form),
                    headers: { Accept: 'application/json' },
                  }).then(function (fsRes) {
                    if (!fsRes.ok) {
                      throw new Error('Form delivery returned status ' + fsRes.status + '.');
                    }
                    return true;
                  });
                }
                throw new Error((data && data.error) || 'Unable to send message.');
              });
          });
        })
        .then(function () {
          form.reset();
          showStatus(
            statusEl,
            'success',
            'Thank you! Your message was sent to NovaScholars Academy. We typically reply within 24 hours.'
          );
        })
        .catch(function (err) {
          showStatus(
            statusEl,
            'error',
            'We could not confirm delivery through the web form (' +
              err.message +
              '). Your message was NOT lost—please click below to send it directly via email to ' +
              CONTACT_EMAIL +
              '.',
            mailtoFallback
          );
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }

  function initRequestForm() {
    var form = document.getElementById('service-request-form');
    if (!form) return;

    var serviceSelect = document.getElementById('request-service');
    var tierSelect = document.getElementById('request-tier');
    var nameInput = document.getElementById('request-name');
    var emailInput = document.getElementById('request-email');
    var subjectInput = document.getElementById('request-subject');
    var gradeInput = document.getElementById('request-grade');
    var deadlineInput = document.getElementById('request-deadline');
    var linkInput = document.getElementById('request-link');
    var fileInput = document.getElementById('request-files');
    var fileListEl = document.getElementById('selected-file-list');
    var dropzone = document.getElementById('file-dropzone');
    var detailsInput = document.getElementById('request-details');
    var statusEl = document.getElementById('request-form-status');
    var submitBtn = form.querySelector('button[type="submit"]');

    var summaryTitle = document.getElementById('summary-service-title');
    var summaryPrice = document.getElementById('summary-service-price');
    var summaryDesc = document.getElementById('summary-service-desc');
    var summaryFeatures = document.getElementById('summary-service-features');

    var ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg', '.webp', '.docx', '.txt'];
    var MAX_FILE_BYTES = 10 * 1024 * 1024;
    var MAX_FILES = 5;
    var selectedFiles = [];

    var params = new URLSearchParams(window.location.search);
    var paramService = params.get('service');
    var paramTier = params.get('tier');
    if (paramService && REQUEST_CATALOG[paramService]) {
      serviceSelect.value = paramService;
    }
    if (paramTier === 'pro' || paramTier === 'standard') {
      tierSelect.value = paramTier;
    }

    function updateSummary() {
      var svc = REQUEST_CATALOG[serviceSelect.value] || REQUEST_CATALOG.notes;
      var tier = svc.tiers[tierSelect.value] || svc.tiers.standard;

      if (summaryTitle) summaryTitle.textContent = svc.label + ' — ' + tier.name;
      if (summaryPrice) summaryPrice.textContent = tier.price;
      if (summaryDesc) summaryDesc.textContent = tier.summary;
      if (summaryFeatures) {
        summaryFeatures.textContent = '';
        tier.features.forEach(function (item) {
          var li = document.createElement('li');
          li.textContent = item;
          summaryFeatures.appendChild(li);
        });
      }
    }

    function formatBytes(bytes) {
      if (bytes < 1024) return bytes + ' B';
      if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
      return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    function renderFileList() {
      if (!fileListEl) return;
      fileListEl.textContent = '';
      selectedFiles.forEach(function (file, index) {
        var li = document.createElement('li');
        var label = document.createElement('span');
        label.textContent = file.name + ' (' + formatBytes(file.size) + ')';
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'file-remove-btn';
        btn.textContent = 'Remove';
        btn.setAttribute('aria-label', 'Remove ' + file.name);
        btn.addEventListener('click', function () {
          selectedFiles.splice(index, 1);
          renderFileList();
        });
        li.appendChild(label);
        li.appendChild(btn);
        fileListEl.appendChild(li);
      });
    }

    function addFiles(fileList) {
      var incoming = Array.prototype.slice.call(fileList || []);
      var errorMsg = '';

      incoming.forEach(function (file) {
        if (selectedFiles.length >= MAX_FILES) {
          errorMsg = 'You can attach up to ' + MAX_FILES + ' files per request.';
          return;
        }
        var lower = file.name.toLowerCase();
        var hasValidExt = ALLOWED_EXTENSIONS.some(function (ext) {
          return lower.slice(-ext.length) === ext;
        });
        if (!hasValidExt) {
          errorMsg =
            'Unsupported file type for "' +
            file.name +
            '". Allowed: PDF, PNG, JPG, WEBP, DOCX, TXT.';
          return;
        }
        if (file.size > MAX_FILE_BYTES) {
          errorMsg = '"' + file.name + '" exceeds the 10 MB limit per file.';
          return;
        }
        var duplicate = selectedFiles.some(function (existing) {
          return existing.name === file.name && existing.size === file.size;
        });
        if (!duplicate) {
          selectedFiles.push(file);
        }
      });

      setFieldError(fileInput, errorMsg);
      renderFileList();
      fileInput.value = '';
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        addFiles(fileInput.files);
      });
    }

    if (dropzone) {
      dropzone.addEventListener('dragover', function (event) {
        event.preventDefault();
        dropzone.classList.add('is-dragover');
      });
      dropzone.addEventListener('dragleave', function () {
        dropzone.classList.remove('is-dragover');
      });
      dropzone.addEventListener('drop', function (event) {
        event.preventDefault();
        dropzone.classList.remove('is-dragover');
        if (event.dataTransfer && event.dataTransfer.files) {
          addFiles(event.dataTransfer.files);
        }
      });
    }

    serviceSelect.addEventListener('change', updateSummary);
    tierSelect.addEventListener('change', updateSummary);
    updateSummary();

    function validate() {
      var valid = true;
      if (nameInput.value.trim().length < 2) {
        setFieldError(nameInput, 'Please enter your full name.');
        valid = false;
      } else {
        setFieldError(nameInput, '');
      }

      if (!isValidEmail(emailInput.value.trim())) {
        setFieldError(emailInput, 'Please enter a valid email address.');
        valid = false;
      } else {
        setFieldError(emailInput, '');
      }

      if (subjectInput.value.trim().length < 2) {
        setFieldError(subjectInput, 'Please enter the course or subject (e.g., AP Chemistry).');
        valid = false;
      } else {
        setFieldError(subjectInput, '');
      }

      var linkVal = linkInput.value.trim();
      if (linkVal && !isValidHttpUrl(linkVal)) {
        setFieldError(linkInput, 'Please enter a valid https:// or http:// link.');
        valid = false;
      } else {
        setFieldError(linkInput, '');
      }

      if (serviceSelect.value === 'notes' && !linkVal && selectedFiles.length === 0) {
        setFieldError(
          linkInput,
          'For Notes Refinement, please share a Google Drive/iCloud link or attach your notes file(s) below.'
        );
        valid = false;
      }

      if (detailsInput.value.trim().length < 10) {
        setFieldError(
          detailsInput,
          'Please describe the topics, chapters, or goals for your materials (at least 10 characters).'
        );
        valid = false;
      } else {
        setFieldError(detailsInput, '');
      }

      return valid;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!validate()) {
        showStatus(statusEl, 'error', 'Please review the highlighted fields before submitting.');
        return;
      }

      var svc = REQUEST_CATALOG[serviceSelect.value] || REQUEST_CATALOG.notes;
      var tier = svc.tiers[tierSelect.value] || svc.tiers.standard;
      var originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting Request...';

      var fileNames = selectedFiles.map(function (f) {
        return f.name + ' (' + formatBytes(f.size) + ')';
      });

      var summaryBody =
        'Service: ' +
        svc.label +
        ' — ' +
        tier.name +
        ' (' +
        tier.price +
        ')\n' +
        'Student/Parent Name: ' +
        nameInput.value.trim() +
        '\nEmail: ' +
        emailInput.value.trim() +
        '\nCourse / Subject: ' +
        subjectInput.value.trim() +
        '\nGrade Level: ' +
        (gradeInput.value || 'Not specified') +
        '\nTarget / Exam Date: ' +
        (deadlineInput.value || 'Flexible') +
        '\nShared Material Link: ' +
        (linkInput.value.trim() || 'None provided') +
        '\nAttached Local Files: ' +
        (fileNames.length ? fileNames.join(', ') : 'None') +
        '\n\nGoals & Instructions:\n' +
        detailsInput.value.trim();

      var mailtoFallback = buildMailtoHref(
        'Material Request: ' + svc.label + ' (' + tier.name + ')',
        summaryBody
      );

      var payload = new FormData();
      payload.append('service', serviceSelect.value);
      payload.append('tier', tierSelect.value);
      payload.append('request_type', svc.label + ' — ' + tier.name + ' (' + tier.price + ')');
      payload.append('name', nameInput.value.trim());
      payload.append('email', emailInput.value.trim());
      payload.append('subject', subjectInput.value.trim());
      payload.append('grade_level', gradeInput.value || 'Not specified');
      payload.append('target_date', deadlineInput.value || 'Flexible');
      payload.append('material_link', linkInput.value.trim());
      payload.append('selected_file_names', fileNames.length ? fileNames.join(', ') : 'None');
      payload.append('details', detailsInput.value.trim());
      selectedFiles.forEach(function (file) {
        payload.append('attachment', file);
      });

      var submittedEmail = emailInput.value.trim();
      var hadFiles = selectedFiles.length > 0;

      getServerConfig()
        .then(function (config) {
          if (config._staticOnly || !config.emailDeliveryConfigured) {
            if (hadFiles) {
              throw new Error(
                config._staticOnly
                  ? 'Direct file uploads require the Node.js server (static GitHub Pages cannot attach files).'
                  : 'Direct email delivery with attachments requires SMTP configuration on the server.'
              );
            }
            return fetch(FORMSPREE_ENDPOINT, {
              method: 'POST',
              body: payload,
              headers: { Accept: 'application/json' },
            }).then(function (fsRes) {
              if (!fsRes.ok) {
                throw new Error('Form delivery returned HTTP ' + fsRes.status + '.');
              }
              return true;
            });
          }

          return fetch('/api/request-materials', {
            method: 'POST',
            body: payload,
            headers: { Accept: 'application/json' },
          }).then(function (response) {
            return response
              .json()
              .catch(function () {
                return {};
              })
              .then(function (data) {
                if (response.ok) {
                  return true;
                }
                var noServerBackend =
                  response.status === 404 ||
                  response.status === 405 ||
                  (response.status === 503 && data && data.code === 'SMTP_NOT_CONFIGURED');
                if (noServerBackend && !hadFiles) {
                  return fetch(FORMSPREE_ENDPOINT, {
                    method: 'POST',
                    body: payload,
                    headers: { Accept: 'application/json' },
                  }).then(function (fsRes) {
                    if (!fsRes.ok) {
                      throw new Error('Form delivery returned HTTP ' + fsRes.status + '.');
                    }
                    return true;
                  });
                }
                if ((response.status === 404 || response.status === 405) && hadFiles) {
                  throw new Error(
                    'Direct file uploads require the Node.js server (static GitHub Pages cannot run server.js).'
                  );
                }
                throw new Error((data && data.error) || 'Request endpoint returned HTTP ' + response.status + '.');
              });
          });
        })
        .then(function () {
          var successMsg =
            'Request sent for ' +
            svc.label +
            ' (' +
            tier.name +
            ', ' +
            tier.price +
            ')' +
            (hadFiles ? ' with ' + fileNames.length + ' attached file(s)' : '') +
            '. We will review your materials manually and email ' +
            submittedEmail +
            ' within 24 hours to confirm scope, turnaround time, and payment before starting.';

          form.reset();
          selectedFiles = [];
          renderFileList();
          updateSummary();
          showStatus(statusEl, 'success', successMsg);
        })
        .catch(function (err) {
          var hint = hadFiles
            ? ' To attach local files directly without Formspree, configure SMTP credentials on the server (e.g., iCloud or Gmail App Password)—or paste a Google Drive / iCloud share link above or click below to email your files directly.'
            : '';
          showStatus(
            statusEl,
            'error',
            'We could not deliver your request yet (' + err.message + ').' + hint,
            mailtoFallback
          );
        })
        .finally(function () {
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        });
    });
  }

  function initSuccessPage() {
    var planTargets = document.querySelectorAll('[data-plan]');
    if (!planTargets.length) return;

    var params = new URLSearchParams(window.location.search);
    var plan = params.get('plan') === 'monthly' ? 'monthly' : 'single';

    planTargets.forEach(function (el) {
      el.style.display = el.getAttribute('data-plan') === plan ? '' : 'none';
    });

    var calendlyFallback = document.getElementById('calendly-direct-link');
    if (calendlyFallback) {
      calendlyFallback.href = CALENDLY_URL;
    }
  }

  document.addEventListener('DOMContentLoaded', function () {
    initMobileNav();
    initStripeCheckout();
    initContactForm();
    initRequestForm();
    initSuccessPage();
  });
})();
