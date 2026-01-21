module.exports = () => ({
  /**
   * Local admin plugin: Modules Sidebar
   *
   * - Adds an "All Modules" sidebar entry for business roles.
   * - Registers an admin permission action: plugin::modules-sidebar.read
   */
  'modules-sidebar': {
    enabled: true,
    resolve: './src/plugins/modules-sidebar',
  },
});

