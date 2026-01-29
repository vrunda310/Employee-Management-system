'use strict';

/**
 * Local plugin (server part)
 *
 * - Registers an Administration Panel permission action that we can assign to roles.
 * - This is upgrade-safe and does NOT touch Strapi core or node_modules.
 * - Adds a custom upload route that allows direct file uploads without Media Library permissions.
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
      {
        section: 'plugins',
        displayName: 'Direct upload files',
        uid: 'upload', // action uid => plugin::modules-sidebar.upload
        pluginName: 'modules-sidebar',
      },
    ]);
  },

  bootstrap({ strapi }) {
    /**
     * Custom upload route that bypasses Media Library permissions
     * This allows HR/LM Admin to upload files directly without accessing Media Library
     */
    strapi.server.routes([
      {
        method: 'POST',
        path: '/modules-sidebar/upload',
        handler: async (ctx) => {
          try {
            // Check if user is authenticated (required for any upload)
            if (!ctx.state.user) {
              return ctx.unauthorized('You must be authenticated to upload files');
            }

            // Get uploaded files from the request
            const { files } = ctx.request;
            
            if (!files || !files.files) {
              return ctx.badRequest('No files provided');
            }

            // Use Strapi's upload service to handle the file upload
            // This bypasses Media Library permission checks
            const uploadedFiles = await strapi.plugin('upload').service('upload').upload({
              data: ctx.request.body.fileInfo ? JSON.parse(ctx.request.body.fileInfo) : {},
              files: Array.isArray(files.files) ? files.files : [files.files],
            });

            // Return the uploaded file(s) in the same format as Media Library
            ctx.body = Array.isArray(uploadedFiles) ? uploadedFiles : [uploadedFiles];
          } catch (error) {
            strapi.log.error('Direct upload error:', error);
            ctx.throw(500, `Upload failed: ${error.message}`);
          }
        },
        config: {
          auth: {
            scope: ['authenticated'], // Require authentication
          },
          policies: [],
        },
      },
    ]);
  },
};

