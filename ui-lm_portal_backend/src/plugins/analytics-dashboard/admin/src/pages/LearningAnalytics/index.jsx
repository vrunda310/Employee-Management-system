import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Page, Layouts } from '@strapi/admin/strapi-admin';
import { Box, Flex, Typography, Loader } from '@strapi/design-system';
import { useAnalytics } from '../../hooks/useAnalytics';
import { StatCard } from '../../components/StatCard';
import { DonutChart } from '../../components/DonutChart';
import { BarChart } from '../../components/BarChart';
import { LineChart } from '../../components/LineChart';
import { DataTable } from '../../components/DataTable';
import { Filters } from '../../components/Filters';
import { EmployeeSearch } from '../../components/EmployeeSearch';

export default function LearningAnalyticsPage() {
  const { fetchLearningGlobal, fetchLearningPersonal, fetchLearningEmployeeTable, fetchDepartments } = useAnalytics();
  const [viewMode, setViewMode] = useState('global');
  const [dateFrom, setDateFrom] = useState(null);
  const [dateTo, setDateTo] = useState(null);
  const [department, setDepartment] = useState('');
  const [company, setCompany] = useState('');
  const [employeeId, setEmployeeId] = useState(null);
  const [departments, setDepartments] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // Employee Table specific
  const [search, setSearch] = useState('');
  const [searchDebounced, setSearchDebounced] = useState('');
  const [sortOrder, setSortOrder] = useState('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const searchTimeoutRef = useRef(null);

  useEffect(() => {
    if (viewMode !== 'table') return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setSearchDebounced(search);
    }, 400);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [search, viewMode]);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (viewMode === 'global') {
      if (department) params.department = department;
    }
    if (company) params.company = company;

    let fetcher;
    if (viewMode === 'table') {
      const tableParams = {
        ...params,
        sortBy: 'courseCompletionTimeMinutes',
        sortOrder,
        page,
        pageSize,
      };
      const searchVal = searchDebounced?.trim();
      if (searchVal) tableParams.search = searchVal;
      fetcher = () => fetchLearningEmployeeTable(tableParams);
    } else if (viewMode === 'personal' && employeeId) {
      fetcher = () => fetchLearningPersonal({ ...params, userId: employeeId });
    } else {
      fetcher = () => fetchLearningGlobal(params);
    }

    fetcher()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [viewMode, employeeId, dateFrom, dateTo, department, company, searchDebounced, sortOrder, page, pageSize]);

  useEffect(() => {
    if (viewMode === 'table') setPage(1);
  }, [viewMode, searchDebounced, company]);

  useEffect(() => {
    if (viewMode === 'table' || viewMode === 'global' || (viewMode === 'personal' && employeeId)) {
      loadData();
    } else {
      setData(null);
      setLoading(false);
    }
  }, [viewMode, employeeId, dateFrom, dateTo, department, company, searchDebounced, sortOrder, page, pageSize]);

  const kpis = data?.kpis || {};
  const quiz = data?.quiz || {};
  const isPersonal = viewMode === 'personal';

  return (
    <>
      <Page.Title>Learning Analytics</Page.Title>
      <Page.Main>
      <Layouts.Header
        title="Learning Analytics"
        subtitle={isPersonal ? 'Personal learning metrics' : 'Global learning metrics'}
        as="h2"
      />
      <Layouts.Content>
        <Box paddingLeft={8} paddingRight={8} paddingTop={6} paddingBottom={8}>
          <Filters
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            department={department}
            onDepartmentChange={setDepartment}
            departments={departments}
            company={company}
            onCompanyChange={setCompany}
            showEmployeeSelector
            showEmployeeTable
            search={search}
            onSearchChange={setSearch}
            sortOrder={sortOrder}
            onSortOrderChange={setSortOrder}
          >
            <EmployeeSearch value={employeeId} onChange={setEmployeeId} />
          </Filters>

          {loading && (
            <Flex justifyContent="center" padding={8}>
              <Loader>Loading analytics...</Loader>
            </Flex>
          )}

          {error && (
            <Box padding={4} background="danger100" hasRadius marginBottom={4}>
              <Typography textColor="danger700">{error}</Typography>
            </Box>
          )}

          {!loading && data && viewMode === 'table' && (
            <Box marginBottom={6}>
              <DataTable
                data={data.rows || []}
                title="Employee Learning Summary"
                pagination={
                  data.total != null && data.total > 0
                    ? {
                        page: data.page || 1,
                        pageSize: data.pageSize || 10,
                        total: data.total,
                        onPageChange: setPage,
                        onPageSizeChange: (v) => {
                          setPageSize(Number(v));
                          setPage(1);
                        },
                      }
                    : null
                }
                columns={[
                  { key: 'employeeName', label: 'Employee Name' },
                  { key: 'company', label: 'Company' },
                  { key: 'coursesEnrolled', label: 'Courses Enrolled' },
                  {
                    key: 'courseCompletionTimeMinutes',
                    label: 'Course Completion Time (min)',
                  },
                  { key: 'totalModulesDone', label: 'Total Modules Done' },
                  {
                    key: 'progressPercent',
                    label: 'Progress %',
                    render: (v) => `${v ?? 0}%`,
                  },
                  {
                    key: 'quizPassRate',
                    label: 'Quiz Pass Rate',
                    render: (v) => `${v ?? 0}%`,
                  },
                  {
                    key: 'avgScore',
                    label: 'Avg Quiz Score',
                  },
                ]}
              />
            </Box>
          )}

          {!loading && data && viewMode !== 'table' && (
            <>
              {/* KPIs */}
              <Flex gap={4} marginBottom={6} wrap="wrap">
                <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                  <StatCard
                    label={isPersonal ? 'Total Courses' : 'Total Progress Records'}
                    value={kpis.totalAssignments ?? kpis.totalCourses}
                    colorIndex={0}
                  />
                </Box>
                <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                  <StatCard label="Completion Rate" value={`${kpis.completionRate ?? 0}%`} colorIndex={1} />
                </Box>
                <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                  <StatCard
                    label="Avg Time Spent"
                    value={`${kpis.avgTimeSpentMinutes ?? 0} min`}
                    subtext="per course"
                    colorIndex={2}
                  />
                </Box>
                <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                  <StatCard
                    label={isPersonal ? 'Certificates Earned' : 'Completed with Certificate'}
                    value={kpis.certificatesIssued ?? kpis.certificatesEarned ?? 0}
                    colorIndex={3}
                  />
                </Box>
              </Flex>

              {/* Quiz Stats (when available) */}
              {(quiz.passRate !== undefined || quiz.avgScore !== undefined) && (
                <Flex gap={4} marginBottom={6} wrap="wrap">
                  <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <StatCard label="Quiz Pass Rate" value={`${quiz.passRate ?? 0}%`} colorIndex={4} />
                  </Box>
                  <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <StatCard label="Quiz Avg Score" value={quiz.avgScore ?? 0} colorIndex={5} />
                  </Box>
                </Flex>
              )}

              {/* Charts Row 1 */}
              <Flex gap={4} marginBottom={6} wrap="wrap">
                <Box style={{ flex: '1 1 300px', minWidth: 280 }}>
                  <DonutChart
                    data={data.statusDistribution}
                    title="Course Status Distribution"
                    height={260}
                  />
                </Box>
                <Box style={{ flex: '1 1 400px', minWidth: 320 }}>
                  <LineChart
                    data={data.monthlyCompletions}
                    title="Completion Trend Over Time"
                    nameKey="month"
                    dataKey="value"
                    height={260}
                  />
                </Box>
              </Flex>

              {/* Charts Row 2 */}
              <Flex gap={4} marginBottom={6} wrap="wrap">
                <Box style={{ flex: '1 1 350px', minWidth: 280 }}>
                  <BarChart
                    data={data.categoryDistribution}
                    title="Courses by Category"
                    nameKey="name"
                    dataKey="value"
                    height={260}
                  />
                </Box>
                <Box style={{ flex: '1 1 350px', minWidth: 280 }}>
                  <BarChart
                    data={data.departmentDistribution}
                    title="Course Progress by Department"
                    nameKey="name"
                    dataKey="value"
                    height={260}
                  />
                </Box>
              </Flex>

              {/* Course Progress Table (Personal only) */}
              {isPersonal && data.courseProgress && data.courseProgress.length > 0 && (
                <Box marginBottom={6}>
                  <DataTable
                    data={data.courseProgress}
                    title="My Course Progress"
                    columns={[
                      { key: 'courseTitle', label: 'Course' },
                      { key: 'status', label: 'Status' },
                      { key: 'percentage', label: 'Progress %', render: (v) => `${v}%` },
                      { key: 'timeSpentMinutes', label: 'Time (min)' },
                      {
                        key: 'certificateIssued',
                        label: 'Certificate',
                        render: (v) => (v ? 'Yes' : 'No'),
                      },
                    ]}
                  />
                </Box>
              )}
            </>
          )}

          {!loading && !data && viewMode === 'table' && (
            <Box padding={6} background="neutral100" hasRadius>
              <Typography textColor="neutral600">
                No employees found. Try adjusting filters or search.
              </Typography>
            </Box>
          )}

          {!loading && !data && viewMode === 'personal' && !employeeId && (
            <Box padding={6} background="neutral100" hasRadius>
              <Typography textColor="neutral600">
                Search for an employee by ID or email to view personal learning analytics.
              </Typography>
            </Box>
          )}
        </Box>
      </Layouts.Content>
    </Page.Main>
    </>
  );
}
