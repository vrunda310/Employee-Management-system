'use strict';

/**
 * cluster controller
 */

const { createCoreController } = require('@strapi/strapi').factories;

module.exports = createCoreController('api::cluster.cluster');
