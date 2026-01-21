/**
 * modules-sidebar (Admin)
 *
 * This is a Strapi v5 admin plugin (JavaScript only).
 *
 * - Adds ONE sidebar entry: "All Modules"
 * - Clicking it opens a page with collapsible sections (HR Module, Learning Module)
 * - Each item links to real Content Manager routes (Content Manager itself remains untouched)
 *
 * Important limitation (Strapi v5 public APIs):
 * - Strapi's built-in Content Manager sidebar link is registered with `permissions: []`,
 *   which means it is always visible. There is no public API to remove/hide core menu items.
 * - We therefore control **access** via RBAC (roles/permissions), and provide a separate
 *   "All Modules" entry for business roles.
 */

import pluginPkg from '../../package.json';
import { PLUGIN_ID } from './pluginId';

// Icon components must be React components (NOT strings).
// Use an available icon from @strapi/icons
import { PuzzlePiece } from '@strapi/icons';

const name = pluginPkg.strapi.name;

// Global helper: control Content Manager visibility per role and source
// Wrap in try-catch to prevent breaking the admin panel if there's an error
if (typeof window !== 'undefined') {
  try {
    const ensureStyle = () => {
    const id = 'modules-sidebar-hide-cm';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      /* Hide Content Manager nav & sidebar when body flag is set */
      /* Only hide the main Content Manager link in sidebar, NOT collection type links */
      body[data-hide-cm-sidebar="true"] nav a[href="/admin/content-manager"],
      body[data-hide-cm-sidebar="true"] nav a[href="/content-manager"],
      body[data-hide-cm-sidebar="true"] aside a[href="/admin/content-manager"],
      body[data-hide-cm-sidebar="true"] aside a[href="/content-manager"],
      body[data-hide-cm-sidebar="true"] [class*="Sidebar"] a[href="/admin/content-manager"],
      body[data-hide-cm-sidebar="true"] [class*="Sidebar"] a[href="/content-manager"],
      body[data-hide-cm-sidebar="true"] [data-hidden-by-modules-sidebar="true"] {
        display: none !important;
        visibility: hidden !important;
      }
      body[data-hide-cm-sidebar="true"] nav[aria-label*="Content Manager"],
      body[data-hide-cm-sidebar="true"] nav[aria-label*="content manager"],
      body[data-hide-cm-sidebar="true"] [data-testid="content-manager-sidebar"],
      body[data-hide-cm-sidebar="true"] [class*="LeftMenu"],
      body[data-hide-cm-sidebar="true"] [class*="sideNav"],
      body[data-hide-cm-sidebar="true"] [class*="SideNav"],
      body[data-hide-cm-sidebar="true"] [class*="LeftNav"],
      body[data-hide-cm-sidebar="true"] [class*="CollectionTypes"],
      body[data-hide-cm-sidebar="true"] [class*="CollectionTypesList"],
      body[data-hide-cm-sidebar="true"] [class*="Layouts-Root"] > nav:first-child,
      body[data-hide-cm-sidebar="true"] [class*="Layouts-Root"] > aside:first-child,
      body[data-hide-cm-sidebar="true"] [data-hidden-by-modules-sidebar="true"] {
        display: none !important;
        visibility: hidden !important;
        opacity: 0 !important;
        width: 0 !important;
        height: 0 !important;
        overflow: hidden !important;
      }
      body[data-hide-cm-sidebar="true"] [class*="Layouts-Root"] > *:not([data-hidden-by-modules-sidebar="true"]):last-child,
      body[data-hide-cm-sidebar="true"] [class*="Layouts-Root"] > *:not([data-hidden-by-modules-sidebar="true"]):nth-child(2) {
        width: 100% !important;
        max-width: 100% !important;
        flex: 1 1 100% !important;
        margin-left: 0 !important;
        padding-left: 0 !important;
      }
    `;
    document.head.appendChild(style);
  };

  // Cache for roles to avoid repeated API calls
  let cachedRoles = null;
  let rolesFetchPromise = null;
  let roleFlagsCache = null;
  let lastToken = null;
  let lastUserId = null;
  let isInitialLoad = true; // Track if this is the first load after page refresh
  
  // Clear cache when token or user changes (user logged out/in)
  // Also clear on initial load to ensure fresh role detection
  const clearCacheIfUserChanged = () => {
    try {
      const state = window.strapi?.store?.getState?.() || {};
      const currentToken = state?.admin_app?.token;
      const currentUserId = state?.admin_app?.user?.id || 
                           state?.auth?.user?.id ||
                           null;
      
      // On initial load, always clear cache to ensure fresh detection
      if (isInitialLoad) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[CM Hide] Initial load, clearing cache for fresh role detection');
        }
        cachedRoles = null;
        roleFlagsCache = null;
        rolesFetchPromise = null;
        delete window.__MODULES_SIDEBAR_ROLES__;
        delete window.__lastRoleLogKey;
        delete window.__lastShouldHide;
        delete window.__lastSidebarLogKey;
        try {
          sessionStorage.removeItem('__modules_sidebar_roles__');
        } catch (e) {
          // Ignore
        }
        isInitialLoad = false;
        lastToken = currentToken;
        lastUserId = currentUserId;
        return;
      }
      
      // Clear if:
      // 1. User ID actually changed (different user logged in)
      // 2. Token went from existing to null (logout)
      // 3. User ID went from existing to null (logout)
      // 4. Token changed from null to something (login after logout)
      // 5. Token changed from something to something different (new session)
      const userChanged = currentUserId !== null && currentUserId !== lastUserId && lastUserId !== null;
      const isLoggedOut = (!currentToken && lastToken) || (currentUserId === null && lastUserId !== null);
      const isLoggedIn = (currentToken && !lastToken) || (currentUserId !== null && lastUserId === null);
      const tokenChanged = currentToken !== lastToken && lastToken !== null && currentToken !== null;
      
      if (userChanged || isLoggedOut || isLoggedIn || tokenChanged) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[CM Hide] User/token changed, clearing cache', { 
            userChanged, 
            isLoggedOut, 
            isLoggedIn, 
            tokenChanged,
            currentUserId,
            lastUserId,
            hasToken: !!currentToken,
            hadToken: !!lastToken
          });
        }
        cachedRoles = null;
        roleFlagsCache = null;
        rolesFetchPromise = null;
        // Reset initial load flag on login to force fresh API fetch
        if (isLoggedIn || userChanged || tokenChanged) {
          isInitialLoad = true;
          // Aggressively clear window/sessionStorage roles on login to prevent stale data
          delete window.__MODULES_SIDEBAR_ROLES__;
          try {
            sessionStorage.removeItem('__modules_sidebar_roles__');
          } catch (e) {
            // Ignore
          }
        }
        lastToken = currentToken;
        lastUserId = currentUserId;
        // Also clear debug flags
        delete window.__lastRoleLogKey;
        delete window.__lastShouldHide;
        delete window.__lastSidebarLogKey;
      } else {
        // Update token/user tracking without clearing cache (token refresh)
        lastToken = currentToken;
        lastUserId = currentUserId;
      }
    } catch (e) {
      // Ignore errors
    }
  };
  
  // Also try to get roles from window (set by AllModules page)
  const getRolesFromWindow = () => {
    try {
      // Check if AllModules page has set roles in window
      if (window.__MODULES_SIDEBAR_ROLES__) {
        return window.__MODULES_SIDEBAR_ROLES__;
      }
      // Check if roles are in sessionStorage (set by AllModules)
      const stored = sessionStorage.getItem('__modules_sidebar_roles__');
      if (stored) {
        try {
          return JSON.parse(stored);
        } catch (e) {
          // Ignore parse errors
        }
      }
    } catch (e) {
      // Ignore errors
    }
    return null;
  };

  const getRoles = async () => {
    // Check if user/token changed (user logged out/in) - this clears cache
    clearCacheIfUserChanged();
    
    // On initial load or after login, ALWAYS skip cache and window/sessionStorage
    // Force fresh API fetch to ensure we get correct roles for the current user
    if (isInitialLoad) {
      // Clear any stale window/sessionStorage roles on initial load
      delete window.__MODULES_SIDEBAR_ROLES__;
      try {
        sessionStorage.removeItem('__modules_sidebar_roles__');
      } catch (e) {
        // Ignore
      }
      // Skip cache and window roles - go straight to Redux/API
    } else {
      // Not initial load - check if we have valid cached roles
      // But verify they match the current user by checking token/user ID
      const state = window.strapi?.store?.getState?.() || {};
      const currentToken = state?.admin_app?.token;
      const currentUserId = state?.admin_app?.user?.id || state?.auth?.user?.id || null;
      
      // If token/user changed since cache was set, invalidate cache
      if (cachedRoles && (currentToken !== lastToken || currentUserId !== lastUserId)) {
        if (process.env.NODE_ENV === 'development') {
          console.log('[CM Hide] Token/user mismatch, invalidating cache');
        }
        cachedRoles = null;
        roleFlagsCache = null;
        rolesFetchPromise = null;
        isInitialLoad = true; // Force fresh fetch
      } else if (cachedRoles) {
        // Cache is valid - use it
        return cachedRoles;
      }
    }

    // Try window/sessionStorage ONLY if not initial load (set by AllModules page)
    // On initial load, we skip this to force fresh API fetch
    if (!isInitialLoad) {
      const windowRoles = getRolesFromWindow();
      if (windowRoles && windowRoles.length > 0) {
        cachedRoles = windowRoles;
        return cachedRoles;
      }
    }

    // If fetch is in progress, return the promise
    if (rolesFetchPromise) {
      return rolesFetchPromise;
    }

    // Try Redux store - check multiple times with a short delay to catch store initialization
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const state =
          window.strapi?.store?.getState?.() ||
          window?.__STRAPI_ADMIN_STATE__ ||
          {};
        const adminUser = state?.admin_app?.user;
        const authUser = state?.auth?.user || state?.auth?.userInfo;
        const reduxRoles = 
          adminUser?.roles ||
          authUser?.roles ||
          window?.strapi?.user?.roles ||
          window?.strapi?.currentUser?.roles;
        
        if (reduxRoles && reduxRoles.length > 0) {
          // On initial load, don't use Redux roles - force API fetch to ensure fresh roles
          // This prevents using stale roles from previous session
          if (isInitialLoad) {
            if (process.env.NODE_ENV === 'development') {
              console.log('[CM Hide] Initial load: skipping Redux roles, will fetch from API');
            }
            // Continue to API fetch
          } else {
            // Not initial load - use Redux roles
            cachedRoles = reduxRoles;
            if (process.env.NODE_ENV === 'development') {
              console.log('[CM Hide] Found roles from Redux:', cachedRoles);
            }
            return reduxRoles;
          }
        }
        
        // If no roles found and this is not the last attempt, wait a bit
        if (attempt < 2) {
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development' && attempt === 2) {
          console.log('[CM Hide] Redux error:', e);
        }
      }
    }

    // Fallback to API if Redux doesn't have roles
    rolesFetchPromise = (async () => {
      try {
        // Wait a bit for Redux store to be ready
        let attempts = 0;
        let state = {};
        let token = null;
        
        while (attempts < 10 && !token) {
          state = window.strapi?.store?.getState?.() || window?.__STRAPI_ADMIN_STATE__ || {};
          token = state?.admin_app?.token;
          if (!token) {
            await new Promise(resolve => setTimeout(resolve, 100));
            attempts++;
          }
        }
        
        if (!token) {
          // Token still not available - might be on login page or store not ready
          return [];
        }
        
        const baseURL = window.strapi?.backendURL || 'http://localhost:1337';
        const response = await fetch(`${baseURL}/admin/users/me?populate=roles`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          credentials: 'include',
        });
        
        if (response.ok) {
          const responseData = await response.json();
          const userData = responseData?.data || responseData;
          const roles = userData?.roles || [];
          if (roles.length > 0) {
            cachedRoles = Array.isArray(roles) ? roles : [roles];
            // Mark initial load as complete after successful API fetch
            isInitialLoad = false;
            if (process.env.NODE_ENV === 'development') {
              console.log('[CM Hide] Fetched roles from API:', cachedRoles.map(r => ({ name: r?.name, code: r?.code })));
            }
            return cachedRoles;
          } else {
            // API returned empty roles - try Redux as fallback
            if (isInitialLoad) {
              const state = window.strapi?.store?.getState?.() || {};
              const adminUser = state?.admin_app?.user;
              const authUser = state?.auth?.user || state?.auth?.userInfo;
              const reduxRoles = adminUser?.roles || authUser?.roles;
              if (reduxRoles && reduxRoles.length > 0) {
                cachedRoles = reduxRoles;
                isInitialLoad = false;
                if (process.env.NODE_ENV === 'development') {
                  console.log('[CM Hide] API returned empty, using Redux roles as fallback:', cachedRoles);
                }
                return cachedRoles;
              }
            }
          }
        }
      } catch (e) {
        if (process.env.NODE_ENV === 'development') {
          console.error('[CM Hide] API fetch error:', e);
        }
        // On error, try Redux as fallback if initial load
        if (isInitialLoad) {
          try {
            const state = window.strapi?.store?.getState?.() || {};
            const adminUser = state?.admin_app?.user;
            const authUser = state?.auth?.user || state?.auth?.userInfo;
            const reduxRoles = adminUser?.roles || authUser?.roles;
            if (reduxRoles && reduxRoles.length > 0) {
              cachedRoles = reduxRoles;
              isInitialLoad = false;
              if (process.env.NODE_ENV === 'development') {
                console.log('[CM Hide] API error, using Redux roles as fallback:', cachedRoles);
              }
              return cachedRoles;
            }
          } catch (e2) {
            // Ignore
          }
        }
      }
      return [];
    })();

    const roles = await rolesFetchPromise;
    rolesFetchPromise = null;
    return roles;
  };

  // Helper function to calculate role flags from roles array
  const getRoleFlagsFromRoles = (roles) => {
    try {
      if (!roles || roles.length === 0) {
        return { isSuper: false, isHR: false, isLM: false };
      }
      
      const hasName = (needle) =>
        roles.some((r) => {
          const name = (r?.name || '').toLowerCase();
          return name === needle.toLowerCase();
        });
      const hasCode = (needle) =>
        roles.some((r) => {
          const code = (r?.code || '').toLowerCase();
          return code === needle.toLowerCase();
        });
      const hasInc = (needle) =>
        roles.some(
          (r) => {
            const name = (r?.name || '').toLowerCase();
            const code = (r?.code || '').toLowerCase();
            return name.includes(needle.toLowerCase()) || code.includes(needle.toLowerCase());
          }
        );

      // Exact role names: "Super Admin", "HR Admin", "LM Admin"
      const isSuper = 
        hasName('super admin') || 
        hasCode('strapi-super-admin') || 
        hasInc('super admin') ||
        hasInc('super-admin');
      const isHR = 
        hasName('hr admin') || 
        hasInc('hr admin') ||
        (hasInc('hr') && !hasInc('lm')); // Only match "hr" if it doesn't contain "lm"
      const isLM = 
        hasName('lm admin') || 
        hasInc('lm admin') ||
        (hasInc('lm') && !hasInc('hr')); // Only match "lm" if it doesn't contain "hr"
      
      if (process.env.NODE_ENV === 'development') {
        console.log('[CM Hide] Role detection:', { 
          roles: roles.map(r => ({ name: r?.name, code: r?.code })),
          isSuper, 
          isHR, 
          isLM 
        });
      }
      
      return { isSuper, isHR, isLM };
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[CM Hide] Error calculating role flags:', error);
      }
      return { isSuper: false, isHR: false, isLM: false };
    }
  };

  const getRoleFlags = async () => {
    try {
      const roles = await getRoles();
      return getRoleFlagsFromRoles(roles);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error('[CM Hide] Error getting role flags:', error);
      }
      return { isSuper: false, isHR: false, isLM: false };
    }
  };

  const hideContentManagerSidebar = async () => {
    ensureStyle();
    
    // Check if user changed first (before getting roles) - this clears cache on logout/login
    clearCacheIfUserChanged();
    
    const params = new URLSearchParams(window.location.search);
    const fromModules = params.get('fromModules') === 'true';
    const flag = window.sessionStorage.getItem('hideCmSidebar') === 'true';
    
    // Get roles first
    const currentRoles = await getRoles();
    
    // Get role flags (always refresh if cache was cleared or if we have roles but cached flags are all false)
    let roleFlags = roleFlagsCache;
    
    // Only use cached flags if:
    // 1. We have cached flags
    // 2. We have cached roles
    // 3. Current roles match cached roles (same length and same content)
    // 4. Cached flags are not all false (which means they were cached when roles were empty)
    const rolesMatch = cachedRoles && currentRoles && 
                       cachedRoles.length === currentRoles.length &&
                       cachedRoles.length > 0 &&
                       cachedRoles.every((r, i) => {
                         const curr = currentRoles[i];
                         return (r?.id && curr?.id && r.id === curr.id) || 
                                (r?.name && curr?.name && r.name === curr.name) ||
                                (r?.code && curr?.code && r.code === curr.code);
                       });
    const cachedFlagsValid = roleFlags && cachedRoles && cachedRoles.length > 0 && 
                            (roleFlags.isSuper || roleFlags.isHR || roleFlags.isLM);
    
    if (!roleFlags || !cachedRoles || !rolesMatch || !cachedFlagsValid) {
      // Recalculate flags - either no cache, roles changed, or flags were cached when roles were empty
      // Pass currentRoles directly to avoid calling getRoles() again
      roleFlags = await getRoleFlagsFromRoles(currentRoles);
      // Only cache flags if we have actual roles (not empty)
      if (currentRoles && currentRoles.length > 0) {
        roleFlagsCache = roleFlags;
      } else {
        // Don't cache false flags when roles are empty - they'll be recalculated when roles arrive
        roleFlagsCache = null;
      }
    }
    const { isSuper, isHR, isLM } = roleFlags;
    const isHRorLM = (!isSuper) && (isHR || isLM);
    
    // Debug logging (only log once per role change, not on every interval)
    const logKey = `${isSuper}-${isHR}-${isLM}-${fromModules}-${flag}`;
    if (process.env.NODE_ENV === 'development' && window.__lastRoleLogKey !== logKey) {
      // Only log when roles are actually detected (not empty)
      if (cachedRoles && cachedRoles.length > 0) {
        console.log('[CM Hide] Role flags:', { isSuper, isHR, isLM, isHRorLM, fromModules, flag });
      }
      window.__lastRoleLogKey = logKey;
    }

    // Set body flag for global CSS hide/show
    // IMPORTANT: Super Admin should NEVER have hide flag set, even if fromModules is true
    let shouldHide = false;
    
    // For Super Admin: ALWAYS show CM and sidebar; clear any stored hide flag
    // This check must come FIRST, before any other logic
    if (isSuper) {
      shouldHide = false;
      document.body.dataset.hideCmSidebar = 'false';
      try {
        window.sessionStorage.removeItem('hideCmSidebar');
        // Also clear fromModules flag from URL if Super Admin navigated from All Modules
        const url = new URL(window.location.href);
        if (url.searchParams.get('fromModules') === 'true') {
          url.searchParams.delete('fromModules');
          window.history.replaceState({}, '', url);
        }
      } catch (e) {
        /* ignore */
      }
    } else if (isHRorLM && (isHR || isLM)) {
      // Valid role detection - HR or LM Admin
      // Always hide CM icon and sidebar for HR/LM Admin
      shouldHide = true;
      document.body.dataset.hideCmSidebar = 'true';
    } else if (!isSuper && !isHR && !isLM) {
      // Roles not detected yet (empty array or still loading)
      // IMPORTANT: Default to showing CM when roles are unknown
      // This prevents accidentally hiding CM for Super Admin while roles are loading
      // Only hide if we have explicit indication (fromModules flag AND on CM page)
      const isOnCMPage = window.location.pathname.includes('/content-manager/collection-types') ||
                       window.location.pathname.includes('/content-manager/single-types');
      if ((fromModules || flag) && isOnCMPage) {
        // User came from All Modules and is on CM page - likely HR/LM Admin
        // But only hide if we're sure (not Super Admin)
        shouldHide = true;
        document.body.dataset.hideCmSidebar = 'true';
      } else {
        // Default: show CM when roles are unknown (safer default - prevents hiding for Super Admin)
        shouldHide = false;
        document.body.dataset.hideCmSidebar = 'false';
      }
    } else {
      // Default: don't hide (fallback)
      shouldHide = false;
      document.body.dataset.hideCmSidebar = 'false';
    }
    
    // Only log when value changes AND roles are detected
    if (process.env.NODE_ENV === 'development' && window.__lastShouldHide !== shouldHide && cachedRoles && cachedRoles.length > 0) {
      console.log('[CM Hide] Final shouldHide:', shouldHide, 'body flag:', document.body.dataset.hideCmSidebar, 'isSuper:', isSuper);
      window.__lastShouldHide = shouldHide;
    }

    // Hide Content Manager sidebar ONLY for HR Admin and LM Admin (not Super Admin)
    const shouldHideCMSidebar = shouldHide;
    // Also hide sidebar when coming from All Modules, but NOT for Super Admin
    // If fromModules flag is set, hide sidebar (user came from All Modules, so likely HR/LM Admin)
    // OR if we have valid role detection for HR/LM
    const shouldHideFromModules = (fromModules || flag) && (isHRorLM || (!isSuper && !isHR && !isLM)) && !isSuper;
    
    // Only log when values change AND roles are detected
    const sidebarLogKey = `${shouldHide}-${shouldHideCMSidebar}-${shouldHideFromModules}`;
    if (process.env.NODE_ENV === 'development' && window.__lastSidebarLogKey !== sidebarLogKey && cachedRoles && cachedRoles.length > 0) {
      console.log('[CM Hide] Sidebar hide flags:', { shouldHide, shouldHideCMSidebar, shouldHideFromModules, fromModules, flag, isSuper });
      window.__lastSidebarLogKey = sidebarLogKey;
    }

    // Hide CM menu link for HR/LM - be very aggressive
    // BUT: Super Admin should NEVER have CM hidden, even if other flags are set
    // Force hide if we have valid HR/LM role detection (even if shouldHide is false)
    const forceHideForHRorLM = (isHR || isLM) && !isSuper;
    const shouldActuallyHide = (shouldHide || forceHideForHRorLM) && !isSuper; // Ensure Super Admin is never hidden
    
    // For Super Admin: Always show and unhide any previously hidden elements
    // This MUST run every time, even if roles are temporarily empty
    // Check if user is Super Admin from multiple sources to be safe
    let isSuperAdminSafe = isSuper;
    
    // If not detected from roleFlags, check other sources
    if (!isSuperAdminSafe) {
      // Check current roles
      if (currentRoles && currentRoles.length > 0) {
        isSuperAdminSafe = currentRoles.some(r => {
          const name = (r?.name || '').toLowerCase();
          return name === 'super admin' || name.includes('super admin');
        });
      }
      
      // Check window roles (set by AllModules page)
      if (!isSuperAdminSafe && window.__MODULES_SIDEBAR_ROLES__) {
        isSuperAdminSafe = window.__MODULES_SIDEBAR_ROLES__.some(r => {
          const name = (r?.name || '').toLowerCase();
          return name === 'super admin' || name.includes('super admin');
        });
      }
      
      // Check Redux store as last resort
      if (!isSuperAdminSafe) {
        try {
          const state = window.strapi?.store?.getState?.() || {};
          const adminUser = state?.admin_app?.user;
          const authUser = state?.auth?.user || state?.auth?.userInfo;
          const reduxRoles = adminUser?.roles || authUser?.roles || [];
          if (reduxRoles.length > 0) {
            isSuperAdminSafe = reduxRoles.some(r => {
              const name = (r?.name || '').toLowerCase();
              return name === 'super admin' || name.includes('super admin');
            });
          }
        } catch (e) {
          // Ignore
        }
      }
    }
    
    if (isSuperAdminSafe) {
      // Super Admin: Always show CM icon - unhide aggressively
      document.querySelectorAll('a').forEach((el) => {
        const href = el.getAttribute('href') || '';
        // Match any /admin/content-manager or /content-manager URL (with or without query params)
        const isMainCMLink = 
          (href.startsWith('/admin/content-manager') || href.startsWith('/content-manager')) &&
          !href.includes('/content-manager/collection-types') &&
          !href.includes('/content-manager/single-types') &&
          href !== '/admin/content-manager/collection-types' &&
          href !== '/admin/content-manager/single-types';
        
        if (isMainCMLink) {
          // Unhide CM link for Super Admin
          el.style.removeProperty('display');
          el.style.removeProperty('visibility');
          el.style.removeProperty('opacity');
          el.removeAttribute('data-hidden-by-modules-sidebar');
          
          // Also unhide parent elements
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            if (parent.hasAttribute('data-hidden-by-modules-sidebar')) {
              parent.style.removeProperty('display');
              parent.style.removeProperty('visibility');
              parent.style.removeProperty('opacity');
              parent.removeAttribute('data-hidden-by-modules-sidebar');
            }
            parent = parent.parentElement;
            depth++;
          }
        }
      });
    } else if (shouldActuallyHide) {
      // Find ALL links first, then filter
      const allLinks = document.querySelectorAll('a');
      allLinks.forEach((el) => {
        const href = el.getAttribute('href') || '';
        const text = (el.textContent || '').toLowerCase().trim();
        const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();
        const title = (el.getAttribute('title') || '').toLowerCase();
        
        // Check if this is the MAIN Content Manager link (not collection type links)
        // Match any /admin/content-manager or /content-manager URL (with or without query params)
        const isMainCMLink = 
          (href.startsWith('/admin/content-manager') || href.startsWith('/content-manager')) &&
          !href.includes('/content-manager/collection-types') &&
          !href.includes('/content-manager/single-types') &&
          href !== '/admin/content-manager/collection-types' &&
          href !== '/admin/content-manager/single-types';
        
        // Check if it's in the left sidebar (main navigation)
        const isInLeftSidebar = el.closest('nav[class*="MainNav"]') ||
                               el.closest('aside[class*="MainNav"]') ||
                               el.closest('[class*="MainNav"]') ||
                               el.closest('nav:first-of-type') ||
                               (el.closest('nav') && !el.closest('[class*="Layouts-Root"] > *:not(:first-child)'));
        
        // Exclude if in main content area or All Modules page
        const isInMainContent = el.closest('[class*="Layouts-Root"] > *:not(:first-child)');
        const isInAllModules = el.closest('[class*="AllModules"]') || 
                               el.closest('[data-modules-sidebar]') ||
                               window.location.pathname.includes('/plugins/modules-sidebar');
        
        if (isMainCMLink && isInLeftSidebar && !isInMainContent && !isInAllModules) {
          // Hide for HR/LM Admin - be very aggressive
          el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important;';
          el.setAttribute('data-hidden-by-modules-sidebar', 'true');
          
          // Also hide parent list item and any parent containers
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            if (parent.tagName === 'LI' || parent.classList.toString().includes('Nav')) {
              parent.style.cssText = 'display: none !important; visibility: hidden !important;';
              parent.setAttribute('data-hidden-by-modules-sidebar', 'true');
            }
            parent = parent.parentElement;
            depth++;
          }
          
          // Removed verbose logging - only log once per link
          if (process.env.NODE_ENV === 'development' && !el.hasAttribute('data-logged-hidden')) {
            console.log('[CM Hide] Hid Content Manager link:', href);
            el.setAttribute('data-logged-hidden', 'true');
          }
        }
      });
    } else if (isSuper) {
      // Show for Super Admin - remove any hiding
      document.querySelectorAll('[data-hidden-by-modules-sidebar="true"]').forEach((el) => {
        const href = el.getAttribute('href') || '';
        if (href === '/admin/content-manager' || href === '/content-manager') {
          el.style.removeProperty('display');
          el.style.removeProperty('visibility');
          el.style.removeProperty('opacity');
          el.removeAttribute('data-hidden-by-modules-sidebar');
          
          let parent = el.parentElement;
          let depth = 0;
          while (parent && depth < 5) {
            if (parent.hasAttribute('data-hidden-by-modules-sidebar')) {
              parent.style.removeProperty('display');
              parent.style.removeProperty('visibility');
              parent.removeAttribute('data-hidden-by-modules-sidebar');
            }
            parent = parent.parentElement;
            depth++;
          }
        }
      });
    }

    // Hide CM left sidebar ONLY for HR Admin and LM Admin (Super Admin keeps it visible)
    // Use more comprehensive selectors
    const sidebarSelectors = [
      'nav[aria-label*="Content Manager"]',
      'nav[aria-label*="content manager"]',
      '[data-testid="content-manager-sidebar"]',
      '[class*="LeftMenu"]',
      '[class*="sideNav"]',
      '[class*="SideNav"]',
      '[class*="LeftNav"]',
      '[class*="CollectionTypes"]',
      '[class*="CollectionTypesList"]',
      'aside[class*="Sidebar"]',
      'nav[class*="Sidebar"]',
    ];
    
    // Also check Layouts-Root children
    const layoutsRoot = document.querySelector('[class*="Layouts-Root"]');
    if (layoutsRoot) {
      const children = Array.from(layoutsRoot.children);
      children.forEach((child, index) => {
        // First child is usually the sidebar
        if (index === 0) {
          const hasCollectionLinks = 
            child.querySelector('a[href*="/content-manager/collection-types"]') ||
            child.querySelector('a[href*="/content-manager/single-types"]') ||
            child.textContent?.includes('COLLECTION TYPES') ||
            child.textContent?.includes('SINGLE TYPES') ||
            child.querySelector('[class*="CollectionTypes"]');
          
          if (hasCollectionLinks || index === 0) {
            // Always check first child - it's likely the sidebar
            // Force hide if we have valid HR/LM role detection
            // BUT: Super Admin should NEVER have sidebar hidden
            const forceHideForHRorLM = (isHR || isLM) && !isSuper;
            const shouldActuallyHideSidebar = (forceHideForHRorLM || shouldHide || shouldHideFromModules) && !isSuper;
            
            if (shouldActuallyHideSidebar) {
              // Hide sidebar for HR/LM Admin - be very aggressive
              child.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; width: 0 !important; height: 0 !important; overflow: hidden !important;';
              child.setAttribute('data-hidden-by-modules-sidebar', 'true');
              
              // Expand main content to full width
              children.slice(1).forEach((mainContent) => {
                mainContent.style.cssText += 'width: 100% !important; max-width: 100% !important; flex: 1 1 100% !important; margin-left: 0 !important; padding-left: 0 !important;';
              });
            }
            
            // For Super Admin: Always show sidebar (run this check separately to ensure it always runs)
            if (isSuper) {
              // Show sidebar for Super Admin - be very aggressive
              child.style.removeProperty('display');
              child.style.removeProperty('visibility');
              child.style.removeProperty('opacity');
              child.style.removeProperty('width');
              child.style.removeProperty('height');
              child.style.removeProperty('overflow');
              child.removeAttribute('data-hidden-by-modules-sidebar');
              
              // Reset main content width
              children.slice(1).forEach((mainContent) => {
                mainContent.style.removeProperty('width');
                mainContent.style.removeProperty('max-width');
                mainContent.style.removeProperty('flex');
                mainContent.style.removeProperty('margin-left');
                mainContent.style.removeProperty('padding-left');
              });
            }
          }
        }
      });
    }
    
    // Also hide using specific selectors
    sidebarSelectors.forEach((selector) => {
      const elements = document.querySelectorAll(selector);
      elements.forEach((el) => {
        const hasCollectionLinks = 
          el.querySelector('a[href*="/content-manager/collection-types"]') ||
          el.querySelector('a[href*="/content-manager/single-types"]') ||
          el.textContent?.includes('COLLECTION TYPES') ||
          el.textContent?.includes('SINGLE TYPES');
        
        if (hasCollectionLinks) {
          if (shouldHide || shouldHideFromModules) {
            // Aggressively hide sidebar
            el.style.cssText = 'display: none !important; visibility: hidden !important; opacity: 0 !important; width: 0 !important; height: 0 !important; overflow: hidden !important;';
            el.setAttribute('data-hidden-by-modules-sidebar', 'true');
            
            // Also expand any main content siblings
            const parent = el.parentElement;
            if (parent) {
              Array.from(parent.children).forEach((sibling) => {
                if (sibling !== el) {
                  sibling.style.cssText += 'width: 100% !important; max-width: 100% !important; flex: 1 1 100% !important;';
                }
              });
            }
          } else if (isSuper) {
            el.style.removeProperty('display');
            el.style.removeProperty('visibility');
            el.style.removeProperty('opacity');
            el.style.removeProperty('width');
            el.style.removeProperty('height');
            el.style.removeProperty('overflow');
            el.removeAttribute('data-hidden-by-modules-sidebar');
          }
        }
      });
    });
  };

  // Run periodically to catch route changes
  // Run immediately when DOM is ready
  const runHideLogic = () => {
    hideContentManagerSidebar().catch(() => {
      // Ignore errors
    });
  };

  // Run immediately and multiple times to catch early role detection
  // This ensures roles are detected as soon as Redux store is ready
  const runImmediate = () => {
    runHideLogic();
    // Run again after short delays to catch store initialization
    setTimeout(runHideLogic, 50);
    setTimeout(runHideLogic, 100);
    setTimeout(runHideLogic, 200);
    setTimeout(runHideLogic, 300);
    setTimeout(runHideLogic, 500);
    setTimeout(runHideLogic, 800);
    setTimeout(runHideLogic, 1200);
  };

  // Also try to subscribe to Redux store changes if available
  try {
    const store = window.strapi?.store;
    if (store && typeof store.subscribe === 'function') {
      store.subscribe(() => {
        // Use proper cache clearing logic (only clears on user/token change)
        clearCacheIfUserChanged();
        // Also check window roles immediately (set by AllModules page)
        const windowRoles = getRolesFromWindow();
        if (windowRoles && windowRoles.length > 0 && !isInitialLoad) {
          cachedRoles = windowRoles;
        }
        runHideLogic();
      });
    }
  } catch (e) {
    // Ignore errors
  }
  
  // Also watch for window.__MODULES_SIDEBAR_ROLES__ changes (set by AllModules page)
  let lastWindowRoles = null;
  const checkWindowRoles = () => {
    const currentRoles = window.__MODULES_SIDEBAR_ROLES__;
    if (currentRoles !== lastWindowRoles && currentRoles && Array.isArray(currentRoles) && currentRoles.length > 0) {
      lastWindowRoles = currentRoles;
      cachedRoles = currentRoles;
      roleFlagsCache = null; // Force recalculation
      runHideLogic();
    }
  };
  
  // Check window roles frequently
  setInterval(checkWindowRoles, 200);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runImmediate);
  } else {
    runImmediate();
  }
  
  // Clear cache on page visibility change (user might have logged in another tab)
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      // Page became visible - clear cache to refresh roles
      cachedRoles = null;
      roleFlagsCache = null;
      lastToken = null;
      lastUserId = null;
      runHideLogic();
    }
  });
  
  // Clear cache on storage event (sessionStorage changes from other tabs)
  window.addEventListener('storage', (e) => {
    if (e.key === '__modules_sidebar_roles__' || e.key === null) {
      cachedRoles = null;
      roleFlagsCache = null;
      runHideLogic();
    }
  });
  
  // Run on interval (less frequent to reduce load, but still catch changes)
  setInterval(runHideLogic, 500);
  
  // Run on navigation
  window.addEventListener('popstate', () => {
    setTimeout(runHideLogic, 100);
  });
  
  // Also run on hashchange
  window.addEventListener('hashchange', () => {
    setTimeout(runHideLogic, 100);
  });
  
  // Run when route changes (for SPA navigation)
  let lastUrl = location.href;
  new MutationObserver(() => {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
      lastUrl = currentUrl;
      // Clear cache on route change to catch role updates (especially login/logout)
      if (currentUrl.includes('/auth/login') || currentUrl.includes('/logout')) {
        // User is logging in/out - clear everything and reset initial load
        cachedRoles = null;
        roleFlagsCache = null;
        rolesFetchPromise = null;
        isInitialLoad = true;
        lastToken = null;
        lastUserId = null;
        delete window.__MODULES_SIDEBAR_ROLES__;
        try {
          sessionStorage.removeItem('__modules_sidebar_roles__');
        } catch (e) {
          // Ignore
        }
      } else if (currentUrl.includes('/admin') && !lastUrl.includes('/admin')) {
        // User just navigated to admin (likely after login) - force fresh fetch
        cachedRoles = null;
        roleFlagsCache = null;
        rolesFetchPromise = null;
        isInitialLoad = true;
        delete window.__MODULES_SIDEBAR_ROLES__;
        try {
          sessionStorage.removeItem('__modules_sidebar_roles__');
        } catch (e) {
          // Ignore
        }
      }
      setTimeout(runHideLogic, 100);
    }
  }).observe(document, { subtree: true, childList: true });
  } catch (error) {
    // Silently fail - don't break the admin panel if our code has an error
    if (process.env.NODE_ENV === 'development') {
      console.error('[modules-sidebar] Error in global script:', error);
    }
  }
}

export default {
  register(app) {
    // Register the plugin (required for Strapi admin to recognize it)
    app.registerPlugin({
      id: PLUGIN_ID,
      name,
    });

    /**
     * Add "All Modules" to the left sidebar.
     *
     * permissions:
     * - This ties visibility to our custom admin permission action:
     *   `plugin::modules-sidebar.read`
     * - Grant this permission to HR Admin / LM Admin / Manager roles.
     * - Super Admin can also have it, but typically they'll use Content Manager directly.
     */
    app.addMenuLink({
      // IMPORTANT: Strapi expects a relative path like `plugins/<pluginId>` (no leading slash)
      // See @strapi/plugin-cloud implementation in node_modules.
      to: `plugins/${PLUGIN_ID}`,
      icon: PuzzlePiece,
      intlLabel: {
        id: `${PLUGIN_ID}.menu.all-modules`,
        defaultMessage: 'All Modules',
      },
      permissions: [
        {
          action: `plugin::${PLUGIN_ID}.read`,
          subject: null,
        },
      ],
      /**
       * IMPORTANT: Strapi v5 requires `Component` to return:
       *   Promise<{ default: React.ComponentType }>
       * Returning the component directly will crash the Admin UI (blank screen).
       */
      // Import the JSX page entry (Vite needs .jsx for JSX parsing)
      Component: () => import('./pages/AllModules/index.jsx'),
    });

    // No need to manually add routes here: `addMenuLink` already mounts the route via `Component`.
    // Adding routes incorrectly can also break the Admin router.
  },
};

