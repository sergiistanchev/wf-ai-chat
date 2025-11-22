/**
 * Smart Script Loader for Königswirt Webflow Site
 * 
 * This script automatically loads the appropriate scripts based on:
 * - Current page path
 * - Current domain (staging or production)
 * 
 * Configuration is managed in config.json
 */

(function() {
  'use strict';

  // Configuration
  const CONFIG_URL = 'https://wf-ai-chat.vercel.app/config.json';
  const SCRIPT_BASE_URL = 'https://wf-ai-chat.vercel.app';

  // Get current page path and domain
  const currentPath = window.location.pathname;
  const currentHost = window.location.hostname;

  // Debug mode (set to false in production)
  const DEBUG = false;

  function log(...args) {
    if (DEBUG) {
      console.log('[Script Loader]', ...args);
    }
  }

  /**
   * Load a script dynamically
   */
  function loadScript(src) {
    return new Promise((resolve, reject) => {
      // Check if script is already loaded
      const existingScript = document.querySelector(`script[src="${src}"]`);
      if (existingScript) {
        log('Script already loaded:', src);
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = () => {
        log('Script loaded:', src);
        resolve();
      };
      script.onerror = () => {
        log('Error loading script:', src);
        reject(new Error(`Failed to load script: ${src}`));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Check if a page path matches the configured pages
   */
  function matchesPage(configuredPages, currentPath) {
    return configuredPages.some(page => {
      // Exact match
      if (page === currentPath) return true;
      // Path starts with (for sub-pages)
      if (page.endsWith('*')) {
        const basePath = page.slice(0, -1);
        return currentPath.startsWith(basePath);
      }
      // Wildcard match
      if (page === '*') return true;
      return false;
    });
  }

  /**
   * Check if current domain matches configured domains
   */
  function matchesDomain(configuredDomains, currentHost) {
    if (!configuredDomains || configuredDomains.length === 0) return true;
    return configuredDomains.some(domain => {
      // Exact match
      if (domain === currentHost) return true;
      // Subdomain match (e.g., www.koenigswirt-th.de matches koenigswirt-th.de)
      if (currentHost.endsWith('.' + domain) || domain.endsWith('.' + currentHost)) return true;
      return false;
    });
  }

  /**
   * Load scripts based on configuration
   */
  async function loadScripts() {
    try {
      log('Loading configuration from:', CONFIG_URL);
      const response = await fetch(CONFIG_URL);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch config: ${response.status}`);
      }

      const config = await response.json();
      log('Configuration loaded:', config);

      const scriptsToLoad = [];

      // Check each script configuration
      for (const [scriptName, scriptConfig] of Object.entries(config.scripts || {})) {
        const matchesPagePath = matchesPage(scriptConfig.pages || [], currentPath);
        const matchesDomainName = matchesDomain(scriptConfig.domains || [], currentHost);

        log(`Checking ${scriptName}:`, {
          matchesPage: matchesPagePath,
          matchesDomain: matchesDomainName,
          currentPath,
          currentHost
        });

        if (matchesPagePath && matchesDomainName) {
          const scriptUrl = `${SCRIPT_BASE_URL}/${scriptConfig.file}`;
          scriptsToLoad.push({ name: scriptName, url: scriptUrl });
        }
      }

      // Load all matching scripts
      if (scriptsToLoad.length > 0) {
        log(`Loading ${scriptsToLoad.length} script(s):`, scriptsToLoad.map(s => s.name));
        
        const loadPromises = scriptsToLoad.map(script => 
          loadScript(script.url).catch(err => {
            console.error(`Failed to load ${script.name}:`, err);
          })
        );

        await Promise.all(loadPromises);
        log('All scripts loaded successfully');
      } else {
        log('No scripts to load for current page/domain');
      }
    } catch (error) {
      console.error('[Script Loader] Error:', error);
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadScripts);
  } else {
    // DOM already loaded
    loadScripts();
  }
})();

