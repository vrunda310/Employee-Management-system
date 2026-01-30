'use strict';

/**
 * Analytics Service - Aggregates data for analytics dashboards
 */

module.exports = ({ strapi }) => ({
  /**
   * Build base filters from query params
   */
  buildFilters(params) {
    const filters = {};

    // Date filter on last_accessed_at (captures all activity, not just completions)
    if (params.dateFrom || params.dateTo) {
      filters.last_accessed_at = {};
      if (params.dateFrom) filters.last_accessed_at.$gte = params.dateFrom;
      if (params.dateTo) filters.last_accessed_at.$lte = params.dateTo;
    }

    // Merge user filters (department + company)
    if (params.department || params.company) {
      filters.user = {};
      if (params.department) filters.user.department = { id: params.department };
      if (params.company) filters.user.company = params.company;
    }

    if (params.courseCategory) {
      filters.course = { course_category: { id: params.courseCategory } };
    }

    return filters;
  },

  /**
   * LEARNING ANALYTICS - Global (all employees)
   */
  async getLearningGlobal(params = {}) {
    const filters = this.buildFilters(params);

    // Fetch user progress with relations
    const progresses = await strapi.documents('api::user-progress.user-progress').findMany({
      filters,
      status: 'published',
      populate: ['user', 'course', 'course.course_category'],
      pagination: { limit: 5000 },
    });

    // Build userId -> department name map (user.department may not populate via Document Service for plugin::users-permissions)
    const userIds = [...new Set(progresses.map((p) => p.user?.id ?? p.user?.documentId).filter(Boolean))];
    const departmentByUserId = {};
    if (userIds.length > 0) {
      const users = await strapi.db.query('plugin::users-permissions.user').findMany({
        where: { id: { $in: userIds } },
        populate: ['department'],
      });
      (users || []).forEach((u) => {
        const deptName = u.department?.name;
        if (deptName) departmentByUserId[u.id] = deptName;
      });
    }

    // Aggregate by status
    const statusCounts = { Not_started: 0, In_progress: 0, Completed: 0, Failed: 0 };
    let totalTimeSpent = 0;
    let certificatesIssued = 0;
    const categoryCounts = {};
    const departmentCounts = {};
    const monthlyCompletions = {};

    progresses.forEach((p) => {
      statusCounts[p.progress_status] = (statusCounts[p.progress_status] || 0) + 1;
      totalTimeSpent += p.time_spent_minutes || 0;
      if (p.certificate_issued) certificatesIssued++;

      if (p.course?.course_category?.name) {
        categoryCounts[p.course.course_category.name] = (categoryCounts[p.course.course_category.name] || 0) + 1;
      }

      const userId = p.user?.id ?? p.user?.documentId;
      const deptName = p.user?.department?.name ?? (userId ? departmentByUserId[userId] : null);
      if (deptName) {
        departmentCounts[deptName] = (departmentCounts[deptName] || 0) + 1;
      }

      if (p.completed_at && p.progress_status === 'Completed') {
        const month = p.completed_at.slice(0, 7);
        monthlyCompletions[month] = (monthlyCompletions[month] || 0) + 1;
      }
    });

    const total = progresses.length;
    const completed = statusCounts.Completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgTimeSpent = total > 0 ? Math.round(totalTimeSpent / total) : 0;

    return {
      kpis: {
        totalAssignments: total,
        completionRate,
        avgTimeSpentMinutes: avgTimeSpent,
        certificatesIssued,
      },
      statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      categoryDistribution: Object.entries(categoryCounts).map(([name, value]) => ({ name, value })),
      departmentDistribution: Object.entries(departmentCounts).map(([name, value]) => ({ name, value })),
      monthlyCompletions: Object.entries(monthlyCompletions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, value })),
    };
  },

  /**
   * LEARNING ANALYTICS - Personal (single employee)
   */
  async getLearningPersonal(userId, params = {}) {
    if (!userId) return null;

    const filters = this.buildFilters(params);
    filters.user = { id: userId };

    const progresses = await strapi.documents('api::user-progress.user-progress').findMany({
      filters,
      status: 'published',
      populate: ['course', 'course.course_category'],
      pagination: { limit: 500 },
    });

    const statusCounts = { Not_started: 0, In_progress: 0, Completed: 0, Failed: 0 };
    let totalTimeSpent = 0;
    const courseProgress = [];
    const monthlyCompletions = {};

    progresses.forEach((p) => {
      statusCounts[p.progress_status] = (statusCounts[p.progress_status] || 0) + 1;
      totalTimeSpent += p.time_spent_minutes || 0;

      courseProgress.push({
        courseTitle: p.course?.title || 'Unknown',
        status: p.progress_status,
        percentage: p.progress_percentage || 0,
        timeSpentMinutes: p.time_spent_minutes || 0,
        completedAt: p.completed_at,
        certificateIssued: p.certificate_issued,
      });

      if (p.completed_at && p.progress_status === 'Completed') {
        const month = p.completed_at.slice(0, 7);
        monthlyCompletions[month] = (monthlyCompletions[month] || 0) + 1;
      }
    });

    const total = progresses.length;
    const completed = statusCounts.Completed;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgTimeSpent = total > 0 ? Math.round(totalTimeSpent / total) : 0;

    return {
      kpis: {
        totalCourses: total,
        completionRate,
        avgTimeSpentMinutes: avgTimeSpent,
        certificatesEarned: progresses.filter((p) => p.certificate_issued).length,
      },
      statusDistribution: Object.entries(statusCounts).map(([name, value]) => ({ name, value })),
      courseProgress,
      monthlyCompletions: Object.entries(monthlyCompletions)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, value]) => ({ month, value })),
    };
  },

  /**
   * QUIZ ANALYTICS - Global
   */
  async getQuizGlobal(params = {}) {
    const filters = {};

    if (params.userId) filters.submitted_by = { id: params.userId };
    if (params.dateFrom || params.dateTo) {
      filters.submitted_at = {};
      if (params.dateFrom) filters.submitted_at.$gte = params.dateFrom;
      if (params.dateTo) filters.submitted_at.$lte = params.dateTo;
    }

    const submissions = await strapi.documents('api::quiz-submission.quiz-submission').findMany({
      filters,
      status: 'published',
      populate: ['quiz'],
      pagination: { limit: 5000 },
    });

    const passed = submissions.filter((s) => s.passed).length;
    const total = submissions.length;
    const passRate = total > 0 ? Math.round((passed / total) * 100) : 0;
    const avgScore = total > 0 ? Math.round(submissions.reduce((sum, s) => sum + (s.score || 0), 0) / total) : 0;

    return {
      passRate,
      avgScore,
      totalAttempts: total,
      passed,
      failed: total - passed,
    };
  },

  /**
   * QUIZ ANALYTICS - Personal
   */
  async getQuizPersonal(userId, params = {}) {
    return this.getQuizGlobal({ ...params, userId });
  },

  /**
   * OVERALL ANALYTICS - Global
   */
  async getOverallGlobal(params = {}) {
    const filters = {};

    if (params.dateFrom || params.dateTo) {
      filters.publishedAt = {};
      if (params.dateFrom) filters.publishedAt.$gte = params.dateFrom;
      if (params.dateTo) filters.publishedAt.$lte = params.dateTo;
    }

    if (params.company) filters.company = { name: params.company };

    // Count users (all non-blocked)
    const totalUsersWhere = { blocked: { $eq: false } };
    if (params.company) totalUsersWhere.company = params.company;
    const totalUsers = await strapi.db.query('plugin::users-permissions.user').count({
      where: totalUsersWhere,
    });

    // Count active users (non-blocked + is_active)
    const activeUsersCountWhere = { blocked: { $eq: false }, is_active: { $eq: true } };
    if (params.company) activeUsersCountWhere.company = params.company;
    const totalActiveUsers = await strapi.db.query('plugin::users-permissions.user').count({
      where: activeUsersCountWhere,
    });

    // Active users by company (for company-wise breakdown)
    const activeUsersWhere = { blocked: { $eq: false }, is_active: { $eq: true } };
    if (params.company) activeUsersWhere.company = params.company;
    const activeUsers = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: activeUsersWhere,
      select: ['company'],
    });
    const activeUsersByCompany = {};
    activeUsers.forEach((u) => {
      const company = u.company || 'Unassigned';
      activeUsersByCompany[company] = (activeUsersByCompany[company] || 0) + 1;
    });

    // Holidays - by month
    const holidays = await strapi.documents('api::holiday.holiday').findMany({
      filters,
      status: 'published',
      pagination: { limit: 1000 },
    });
    const totalHolidays = holidays.length;
    const holidayByMonth = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    holidays.forEach((h) => {
      if (h.date) {
        const d = new Date(h.date);
        const monthKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        holidayByMonth[monthKey] = (holidayByMonth[monthKey] || 0) + 1;
      }
    });

    // Employees by company (all non-blocked)
    const employeesWhere = { blocked: { $eq: false } };
    if (params.company) employeesWhere.company = params.company;
    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: employeesWhere,
      select: ['company'],
    });
    const employeesByCompany = {};
    users.forEach((u) => {
      const company = u.company || 'Unassigned';
      employeesByCompany[company] = (employeesByCompany[company] || 0) + 1;
    });

    // News
    const newsItems = await strapi.documents('api::news.news').findMany({
      filters,
      status: 'published',
      populate: ['news_category'],
      pagination: { limit: 1000 },
    });
    const newsByCategory = {};
    newsItems.forEach((n) => {
      const cat = n.news_category?.name || 'Uncategorized';
      newsByCategory[cat] = (newsByCategory[cat] || 0) + 1;
    });

    // Events
    const events = await strapi.documents('api::event.event').findMany({
      filters,
      status: 'published',
      pagination: { limit: 500 },
    });
    const eventsByType = {};
    events.forEach((e) => {
      const t = e.event_type || 'Other';
      eventsByType[t] = (eventsByType[t] || 0) + 1;
    });

    // Townhall matrix (by content type: Video vs Pdf) - townhall has no company field, use date filters only
    const townhallFilters = {};
    if (params.dateFrom || params.dateTo) {
      townhallFilters.publishedAt = {};
      if (params.dateFrom) townhallFilters.publishedAt.$gte = params.dateFrom;
      if (params.dateTo) townhallFilters.publishedAt.$lte = params.dateTo;
    }
    const townhalls = await strapi.documents('api::townhall.townhall').findMany({
      filters: townhallFilters,
      status: 'published',
      pagination: { limit: 500 },
    });
    const townhallByContentType = {};
    townhalls.forEach((t) => {
      const type = t.meeting_content_type || 'Other';
      townhallByContentType[type] = (townhallByContentType[type] || 0) + 1;
    });

    return {
      kpis: {
        totalUsers,
        totalActiveUsers,
        totalHolidays,
        totalNews: newsItems.length,
        totalEvents: events.length,
        totalTownhalls: townhalls.length,
      },
      holidayByMonth: Object.entries(holidayByMonth)
        .sort(([a], [b]) => {
          const parseMonth = (s) => {
            const [mon, year] = s.split(' ');
            const m = monthNames.indexOf(mon);
            return parseInt(year, 10) * 12 + m;
          };
          return parseMonth(a) - parseMonth(b);
        })
        .map(([name, value]) => ({ name, value })),
      employeesByCompany: Object.entries(employeesByCompany).map(([name, value]) => ({
        name,
        value,
        activeValue: activeUsersByCompany[name] || 0,
      })),
      activeUsersByCompany: Object.entries(activeUsersByCompany).map(([name, value]) => ({ name, value })),
      newsByCategory: Object.entries(newsByCategory).map(([name, value]) => ({ name, value })),
      eventsByType: Object.entries(eventsByType).map(([name, value]) => ({ name, value })),
      townhallByContentType: Object.entries(townhallByContentType).map(([name, value]) => ({ name, value })),
    };
  },

  /**
   * OVERALL ANALYTICS - Personal
   */
  async getOverallPersonal(userId, params = {}) {
    if (!userId) return null;

    const filters = {};
    if (params.dateFrom || params.dateTo) {
      filters.publishedAt = {};
      if (params.dateFrom) filters.publishedAt.$gte = params.dateFrom;
      if (params.dateTo) filters.publishedAt.$lte = params.dateTo;
    }
    if (params.company) filters.company = { name: params.company };

    const holidays = await strapi.documents('api::holiday.holiday').findMany({
      filters,
      status: 'published',
      pagination: { limit: 500 },
    });

    const totalHolidays = holidays.length;
    const holidayByMonth = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    holidays.forEach((h) => {
      if (h.date) {
        const d = new Date(h.date);
        const monthKey = `${monthNames[d.getMonth()]} ${d.getFullYear()}`;
        holidayByMonth[monthKey] = (holidayByMonth[monthKey] || 0) + 1;
      }
    });

    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: { blocked: { $eq: false } },
      select: ['company'],
    });
    const employeesByCompany = {};
    users.forEach((u) => {
      const company = u.company || 'Unassigned';
      employeesByCompany[company] = (employeesByCompany[company] || 0) + 1;
    });

    return {
      kpis: {
        totalHolidays,
      },
      holidayByMonth: Object.entries(holidayByMonth)
        .sort(([a], [b]) => {
          const parseMonth = (s) => {
            const [mon, year] = s.split(' ');
            const m = monthNames.indexOf(mon);
            return parseInt(year, 10) * 12 + m;
          };
          return parseMonth(a) - parseMonth(b);
        })
        .map(([name, value]) => ({ name, value })),
      employeesByCompany: Object.entries(employeesByCompany).map(([name, value]) => ({ name, value })),
    };
  },

  /**
   * LEARNING ANALYTICS - Employee Table (Option B: one row per employee, aggregated)
   */
  async getLearningEmployeeTable(params = {}) {
    const userWhere = { blocked: { $eq: false } };
    if (params.company) userWhere.company = params.company;
    if (params.search && String(params.search).trim()) {
      const search = String(params.search).trim();
      const numericId = parseInt(search, 10);
      if (!Number.isNaN(numericId) && String(numericId) === search) {
        userWhere.id = numericId;
      } else {
        userWhere.$or = [
          { employee_name: { $containsi: search } },
          { email: { $containsi: search } },
          { username: { $containsi: search } },
        ];
      }
    }

    const page = Math.max(1, parseInt(params.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(5, parseInt(params.pageSize, 10) || 10));
    const offset = (page - 1) * pageSize;

    const totalCount = await strapi.db.query('plugin::users-permissions.user').count({
      where: userWhere,
    });

    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where: userWhere,
      select: ['id', 'employee_name', 'username', 'email', 'company'],
      limit: pageSize,
      offset,
    });
    const userList = Array.isArray(users) ? users : [];
    const userIds = userList.map((u) => u.id).filter(Boolean);
    if (userIds.length === 0) return { rows: [], total: totalCount, page, pageSize };

    const progressFilters = { user: { id: { $in: userIds } } };
    if (params.dateFrom || params.dateTo) {
      progressFilters.last_accessed_at = {};
      if (params.dateFrom) progressFilters.last_accessed_at.$gte = params.dateFrom;
      if (params.dateTo) progressFilters.last_accessed_at.$lte = params.dateTo;
    }

    const progressesRaw = await strapi.db.query('api::user-progress.user-progress').findMany({
      where: progressFilters,
      limit: 10000,
    });
    const progresses = Array.isArray(progressesRaw) ? progressesRaw : [];

    const submissionsRaw = await strapi.db.query('api::quiz-submission.quiz-submission').findMany({
      where: { submitted_by: { id: { $in: userIds } } },
      limit: 5000,
    });
    const submissions = Array.isArray(submissionsRaw) ? submissionsRaw : [];

    const progressByUser = {};
    const submissionByUser = {};
    userIds.forEach((id) => {
      progressByUser[id] = [];
      submissionByUser[id] = [];
    });
    progresses.forEach((p) => {
      const uid = p.user_id ?? p.user?.id ?? p.user?.documentId;
      if (uid != null && progressByUser[uid]) progressByUser[uid].push(p);
    });
    submissions.forEach((s) => {
      const uid = s.submitted_by_id ?? s.submitted_by?.id ?? s.submitted_by?.documentId;
      if (uid != null && submissionByUser[uid]) submissionByUser[uid].push(s);
    });

    const rows = userList.map((u) => {
      const progs = progressByUser[u.id] || [];
      const subs = submissionByUser[u.id] || [];
      const coursesEnrolled = progs.length;
      const totalTimeSpent = progs.reduce((sum, p) => sum + (p.time_spent_minutes || 0), 0);
      const totalModulesDone = progs.reduce((sum, p) => {
        const cm = p.completed_modules;
        return sum + (Array.isArray(cm) ? cm.length : 0);
      }, 0);
      const avgProgress = coursesEnrolled > 0
        ? Math.round(progs.reduce((s, p) => s + (p.progress_percentage || 0), 0) / coursesEnrolled)
        : 0;
      const quizPassed = subs.filter((s) => s.passed).length;
      const quizPassRate = subs.length > 0 ? Math.round((quizPassed / subs.length) * 100) : 0;
      const avgScore = subs.length > 0
        ? Math.round(subs.reduce((s, x) => s + (x.score || 0), 0) / subs.length)
        : 0;

      return {
        employeeId: u.id,
        employeeName: u.employee_name || u.username || u.email || `User ${u.id}`,
        company: u.company || '—',
        coursesEnrolled,
        courseCompletionTimeMinutes: totalTimeSpent,
        totalModulesDone,
        progressPercent: avgProgress,
        quizPassRate,
        avgScore,
      };
    });

    const sortBy = params.sortBy || 'courseCompletionTimeMinutes';
    const sortOrder = (params.sortOrder || 'desc').toLowerCase();
    rows.sort((a, b) => {
      const key = sortBy === 'courseCompletionTime' ? 'courseCompletionTimeMinutes' : sortBy;
      const av = a[key] ?? 0;
      const bv = b[key] ?? 0;
      if (typeof av === 'string') return sortOrder === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      return sortOrder === 'asc' ? av - bv : bv - av;
    });

    return { rows, total: totalCount, page, pageSize };
  },

  /**
   * Get employee list for filter dropdown
   */
  async getEmployeesList(params = {}) {
    const where = { blocked: { $eq: false } };
    if (params.company) where.company = params.company;
    if (params.department) where.department = { id: params.department };

    // Search by ID or email (for personal view) (for personal view)
    if (params.search && String(params.search).trim()) {
      const search = String(params.search).trim();
      const numericId = parseInt(search, 10);
      if (!Number.isNaN(numericId) && String(numericId) === search) {
        where.id = numericId;
      } else {
        where.email = { $containsi: search };
      }
    }

    const users = await strapi.db.query('plugin::users-permissions.user').findMany({
      where,
      populate: ['department'],
      orderBy: { employee_name: 'asc' },
      limit: params.search ? 1 : 500,
    });

    return users.map((u) => ({
      id: u.id,
      employee_name: u.employee_name || u.username || u.email,
      email: u.email,
      department: u.department?.name,
      company: u.company,
    }));
  },

  /**
   * Get department list for filter dropdown
   */
  async getDepartmentsList() {
    const departments = await strapi.documents('api::department.department').findMany({
      sort: [{ name: 'asc' }],
      pagination: { limit: 200 },
    });
    return departments.map((d) => ({ id: d.id, name: d.name }));
  },
});
