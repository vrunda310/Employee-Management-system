'use strict';

/**
 * quiz-question service
 */

const { createCoreService } = require('@strapi/strapi').factories;

module.exports = createCoreService('api::quiz-question.quiz-question');
