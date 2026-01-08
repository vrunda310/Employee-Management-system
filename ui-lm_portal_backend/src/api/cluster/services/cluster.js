'use strict';

/**
 * cluster service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::cluster.cluster');
