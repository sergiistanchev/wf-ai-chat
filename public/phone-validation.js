// Phone number validation for Webflow forms using libphonenumber-js
// Add this script to Webflow's custom code section (before </body>)
// Make sure to also include: <script src="/libphonenumber-max.min.js"></script>

(function () {
  'use strict';

  function ready(fn) {
    if (document.readyState !== 'loading') {
      fn();
    } else {
      document.addEventListener('DOMContentLoaded', fn);
    }
  }

  ready(function () {
    var input = document.getElementById('phone');
    if (!input) return;

    // libphonenumber-js UMD exposes libphonenumber
    var lp = window.libphonenumber;
    if (!lp || !lp.AsYouType || !lp.parsePhoneNumberFromString) {
      console.warn('libphonenumber-js library not loaded');
      return;
    }

    var hidden = document.getElementById('phone_e164');
    var form = input.closest('form');

    input.setAttribute('inputmode', 'tel');
    input.setAttribute('autocomplete', 'tel');
    input.setAttribute('placeholder', '+49 171 1234567');

    function formatAsYouType(val) {
      // keep only digits, spaces, +, (), -
      val = (val || '').replace(/[^\d+\s()-]/g, '');

      var ayt = new lp.AsYouType('DE'); // default country DE
      ayt.input(val);
      return ayt.getNumberValue() ? ayt.getNumber().formatInternational() : ayt.getTemplate() ? ayt.getTemplate().replace(/·/g, '') : ayt.getInput();
    }

    function updateHiddenAndValidity() {
      var raw = (input.value || '').trim();

      // Parse with default country DE; if user types +..., it will be treated as international.
      var pn = lp.parsePhoneNumberFromString(raw, 'DE');

      if (pn && pn.isValid()) {
        input.setCustomValidity('');
        if (hidden) hidden.value = pn.number; // E.164 (e.g. +491711234567)
        return true;
      } else {
        if (hidden) hidden.value = '';
        input.setCustomValidity('Bitte eine gültige Telefonnummer eingeben.');
        return false;
      }
    }

    // Live formatting
    input.addEventListener('input', function () {
      var before = input.value;
      var formatted = formatAsYouType(before);
      // If AsYouType returned empty/odd template, fall back to original
      if (formatted && formatted.length >= 2) input.value = formatted;
      updateHiddenAndValidity();
    });

    // Validate on submit
    if (form) {
      form.addEventListener('submit', function (e) {
        if (!updateHiddenAndValidity()) {
          e.preventDefault();
          input.reportValidity();
          input.focus();
        }
      });
    }

    // initial pass
    updateHiddenAndValidity();
  });
})();

