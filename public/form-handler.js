// Form handler for Webflow estimate form
// Intercepts form submission and shows success modal instead of redirecting

(function() {
  'use strict';

  // Wait for DOM to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  function init() {
    // Find the form - adjust selector based on your Webflow form
    const form = document.querySelector('form[action*="submit-estimate"]') || 
                 document.querySelector('form[data-name="Estimate Form"]') ||
                 document.querySelector('form.w-form');

    if (!form) {
      console.log('[Form Handler] No form found');
      return;
    }

    // Create success modal HTML
    const modalHTML = `
      <div id="estimate-success-modal" style="display: none; position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.5); z-index: 9999; justify-content: center; align-items: center;">
        <div style="background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 500px; width: 90%; text-align: center; position: relative;">
          <button id="close-success-modal" style="position: absolute; top: 15px; right: 15px; background: none; border: none; font-size: 24px; cursor: pointer; color: #999; padding: 0; width: 30px; height: 30px; line-height: 30px;">&times;</button>
          <div style="font-size: 64px; margin-bottom: 20px;">✅</div>
          <h1 style="color: #2c3e50; margin: 0 0 10px 0; font-size: 28px;">Vielen Dank!</h1>
          <h2 style="color: #2c3e50; margin: 0 0 20px 0; font-size: 20px; font-weight: normal;">Thank You!</h2>
          <p style="color: #666; line-height: 1.6; margin: 10px 0;">
            Ihr Hochzeits-Angebot wurde erfolgreich gesendet.
          </p>
          <p style="color: #666; line-height: 1.6; margin: 10px 0;">
            Your wedding estimate has been sent successfully.
          </p>
          <div style="margin-top: 20px; padding: 15px; background: #f8f9fa; border-radius: 4px; font-size: 14px;">
            <p style="margin: 0 0 10px 0;"><strong>Sie erhalten in Kürze eine E-Mail mit Ihrer Kostenschätzung.</strong></p>
            <p style="margin: 0 0 10px 0;"><strong>You will receive an email with your cost estimate shortly.</strong></p>
            <p style="margin: 15px 0 0 0; font-size: 12px; color: #999;">
              Bitte überprüfen Sie auch Ihren Spam-Ordner.<br>
              Please also check your spam folder.
            </p>
          </div>
        </div>
      </div>
    `;

    // Add modal to page
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    const modal = document.getElementById('estimate-success-modal');
    const closeBtn = document.getElementById('close-success-modal');

    // Show modal function
    function showModal() {
      modal.style.display = 'flex';
      document.body.style.overflow = 'hidden'; // Prevent scrolling
    }

    // Hide modal function
    function hideModal() {
      modal.style.display = 'none';
      document.body.style.overflow = ''; // Restore scrolling
    }

    // Close modal handlers
    closeBtn.addEventListener('click', hideModal);
    modal.addEventListener('click', function(e) {
      if (e.target === modal) {
        hideModal();
      }
    });

    // Escape key to close
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        hideModal();
      }
    });

    // Intercept form submission
    form.addEventListener('submit', async function(e) {
      e.preventDefault(); // Prevent default form submission

      // Get form data
      const formData = new FormData(form);
      const formObject = {};
      formData.forEach((value, key) => {
        formObject[key] = value;
      });

      // Show loading state (optional - you can add a spinner here)
      const submitButton = form.querySelector('input[type="submit"]') || 
                           form.querySelector('button[type="submit"]');
      const originalButtonText = submitButton ? submitButton.value || submitButton.textContent : '';
      if (submitButton) {
        submitButton.disabled = true;
        if (submitButton.value) {
          submitButton.value = 'Wird gesendet...';
        } else {
          submitButton.textContent = 'Wird gesendet...';
        }
      }

      try {
        // Send to API
        const response = await fetch('https://wf-ai-chat.vercel.app/api/submit-estimate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(formObject),
        });

        const result = await response.json();

        if (result.ok) {
          // Show success modal
          showModal();
          
          // Reset form (optional)
          form.reset();
          
          // Scroll to top (optional)
          window.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          // Show error message
          alert('Fehler beim Senden. Bitte versuchen Sie es erneut.\nError sending. Please try again.');
          console.error('Form submission error:', result);
        }
      } catch (error) {
        console.error('Form submission error:', error);
        alert('Fehler beim Senden. Bitte versuchen Sie es erneut.\nError sending. Please try again.');
      } finally {
        // Restore button
        if (submitButton) {
          submitButton.disabled = false;
          if (submitButton.value) {
            submitButton.value = originalButtonText;
          } else {
            submitButton.textContent = originalButtonText;
          }
        }
      }
    });

    console.log('[Form Handler] Initialized successfully');
  }
})();

