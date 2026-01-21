'use strict';

/**
 * Local plugin (server part)
 *
 * - Registers an Administration Panel permission action that we can assign to roles.
 * - This is upgrade-safe and does NOT touch Strapi core or node_modules.
 */

module.exports = {
  register({ strapi }) {
    /**
     * Register a custom admin permission action.
     *
     * Admin permissions live under "Settings → Administration Panel → Roles".
     * We'll use this permission to control who can see the "All Modules" sidebar entry.
     */
    strapi.admin.services.permission.actionProvider.registerMany([
      {
        section: 'plugins',
        displayName: 'Access All Modules sidebar',
        uid: 'read', // action uid => plugin::modules-sidebar.read
        pluginName: 'modules-sidebar',
      },
    ]);
  },
};

