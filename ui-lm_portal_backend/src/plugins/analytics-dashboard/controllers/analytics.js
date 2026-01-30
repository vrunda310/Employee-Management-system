'use strict';

/**
 * Analytics Controller - Handles analytics API requests
 */

module.exports = ({ strapi }) => {
  const getAnalyticsService = () => {
    const analyticsService = require('../services/analytics')({ strapi });
    return analyticsService;
  };

  const getQueryParams = (ctx) => ({
    userId: ctx.query.userId || ctx.query.user_id,
    dateFrom: ctx.query.dateFrom || ctx.query.date_from,
    dateTo: ctx.query.dateTo || ctx.query.date_to,
    department: ctx.query.department,
    company: ctx.query.company,
    courseCategory: ctx.query.courseCategory || ctx.query.course_category,
    search: ctx.query.search,
    sortBy: ctx.query.sortBy || ctx.query.sort_by,
    sortOrder: ctx.query.sortOrder || ctx.query.sort_order,
    page: ctx.query.page,
    pageSize: ctx.query.pageSize || ctx.query.page_size,
  });

  return {
    async learningGlobal(ctx) {
      try {
        const params = getQueryParams(ctx);
        const service = getAnalyticsService();
        const data = await service.getLearningGlobal(params);

        // Include quiz data
        const quizData = await service.getQuizGlobal(params);
        data.quiz = quizData;

        ctx.body = data;
      } catch (error) {
        strapi.log.error('Analytics learningGlobal error:', error);
        ctx.throw(500, error.message);
      }
    },

    async learningPersonal(ctx) {
      try {
        const params = getQueryParams(ctx);
        const userId = params.userId;

        if (!userId) {
          return ctx.badRequest('userId is required for personal analytics');
        }

        const service = getAnalyticsService();
        const data = await service.getLearningPersonal(userId, params);

        if (!data) {
          return ctx.notFound('No learning data found for this user');
        }

        // Include quiz data
        const quizData = await service.getQuizPersonal(userId, params);
        data.quiz = quizData;

        ctx.body = data;
      } catch (error) {
        strapi.log.error('Analytics learningPersonal error:', error);
        ctx.throw(500, error.message);
      }
    },

    async learningEmployeeTable(ctx) {
      try {
        const params = getQueryParams(ctx);
        const service = getAnalyticsService();
        const data = await service.getLearningEmployeeTable(params);
        ctx.body = data;
      } catch (error) {
        strapi.log.error('Analytics learningEmployeeTable error:', error);
        ctx.throw(500, error.message);
      }
    },

    async overallGlobal(ctx) {
      try {
        const params = getQueryParams(ctx);
        const service = getAnalyticsService();
        const data = await service.getOverallGlobal(params);
        ctx.body = data;
      } catch (error) {
        strapi.log.error('Analytics overallGlobal error:', error);
        ctx.throw(500, error.message);
      }
    },

    async overallPersonal(ctx) {
      try {
        const params = getQueryParams(ctx);
        const userId = params.userId;

        if (!userId) {
          return ctx.badRequest('userId is required for personal analytics');
        }

        const service = getAnalyticsService();
        const data = await service.getOverallPersonal(userId, params);

        if (!data) {
          return ctx.notFound('No overall data found for this user');
        }

        ctx.body = data;
      } catch (error) {
        strapi.log.error('Analytics overallPersonal error:', error);
        ctx.throw(500, error.message);
      }
    },

    async employeesList(ctx) {
      try {
        const params = getQueryParams(ctx);
        const service = getAnalyticsService();
        const data = await service.getEmployeesList(params);
        ctx.body = data;
      } catch (error) {
        strapi.log.error('Analytics employeesList error:', error);
        ctx.throw(500, error.message);
      }
    },

    async departmentsList(ctx) {
      try {
        const service = getAnalyticsService();
        const data = await service.getDepartmentsList();
        ctx.body = data;
      } catch (error) {
        strapi.log.error('Analytics departmentsList error:', error);
        ctx.throw(500, error.message);
      }
    },
  };
};
