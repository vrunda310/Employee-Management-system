import React, { useState, useEffect, useCallback } from 'react';
import { Page, Layouts } from '@strapi/admin/strapi-admin';
import { Box, Flex, Typography, Loader } from '@strapi/design-system';
import { useAnalytics } from '../../hooks/useAnalytics';
import { StatCard } from '../../components/StatCard';
import { DonutChart } from '../../components/DonutChart';
import { BarChart } from '../../components/BarChart';
import { Filters } from '../../components/Filters';
import { EmployeeSearch } from '../../components/EmployeeSearch';

export default function OverallAnalyticsPage() {
  const { fetchOverallGlobal, fetchOverallPersonal, fetchDepartments } = useAnalytics();
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

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  const loadData = useCallback(() => {
    setLoading(true);
    setError(null);
    const params = {};
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo) params.dateTo = dateTo;
    if (company) params.company = company;

    const fetcher = viewMode === 'personal' && employeeId
      ? () => fetchOverallPersonal({ ...params, userId: employeeId })
      : () => fetchOverallGlobal(params);

    fetcher()
      .then(setData)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [viewMode, employeeId, dateFrom, dateTo, company]);

  useEffect(() => {
    if (viewMode === 'global' || (viewMode === 'personal' && employeeId)) {
      loadData();
    } else {
      setData(null);
      setLoading(false);
    }
  }, [viewMode, employeeId, dateFrom, dateTo, company]);

  const kpis = data?.kpis || {};
  const isPersonal = viewMode === 'personal';

  return (
    <>
      <Page.Title>Overall Analytics</Page.Title>
      <Page.Main>
        <Layouts.Header
          title="Overall Analytics"
          subtitle={isPersonal ? 'Personal portal engagement' : 'Global portal engagement'}
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

            {!loading && data && (
              <>
                {/* KPIs */}
                <Flex gap={4} marginBottom={6} wrap="wrap">
                  <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <StatCard label="Total Users" value={kpis.totalUsers} colorIndex={0} />
                  </Box>
                  <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <StatCard label="Holidays" value={kpis.totalHolidays} colorIndex={1} />
                  </Box>
                  <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <StatCard label="News Items" value={kpis.totalNews} colorIndex={2} />
                  </Box>
                  <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <StatCard label="Events" value={kpis.totalEvents} colorIndex={3} />
                  </Box>
                  <Box style={{ flex: '1 1 200px', minWidth: 180 }}>
                    <StatCard label="Townhalls" value={kpis.totalTownhalls} colorIndex={4} />
                  </Box>
                </Flex>

                {/* Holidays by Month + Employees by Company */}
                <Flex gap={4} marginBottom={6} wrap="wrap">
                  {data.holidayByMonth?.length > 0 && (
                    <Box style={{ flex: '1 1 300px', minWidth: 280 }}>
                      <DonutChart
                        data={data.holidayByMonth}
                        title="Holidays by Month"
                        height={260}
                      />
                    </Box>
                  )}
                  {data.employeesByCompany?.length > 0 && (
                    <Box style={{ flex: '1 1 300px', minWidth: 280 }}>
                      <DonutChart
                        data={data.employeesByCompany}
                        title="Employees by Company"
                        height={260}
                        showActiveInTooltip
                      />
                    </Box>
                  )}
                </Flex>

                {/* Bar Charts */}
                <Flex gap={4} marginBottom={6} wrap="wrap">
                  {data.newsByCategory?.length > 0 && (
                    <Box style={{ flex: '1 1 350px', minWidth: 280 }}>
                      <BarChart
                        data={data.newsByCategory}
                        title="News by Category"
                        nameKey="name"
                        dataKey="value"
                        height={260}
                      />
                    </Box>
                  )}
                  {data.eventsByType?.length > 0 && (
                    <Box style={{ flex: '1 1 350px', minWidth: 280 }}>
                      <BarChart
                        data={data.eventsByType}
                        title="Events by Type"
                        nameKey="name"
                        dataKey="value"
                        height={260}
                      />
                    </Box>
                  )}
                  {data.townhallByContentType?.length > 0 && (
                    <Box style={{ flex: '1 1 350px', minWidth: 280 }}>
                      <BarChart
                        data={data.townhallByContentType}
                        title="Townhall Matrix (by Content Type)"
                        nameKey="name"
                        dataKey="value"
                        height={260}
                      />
                    </Box>
                  )}
                </Flex>
              </>
            )}

            {!loading && !data && viewMode === 'personal' && !employeeId && (
              <Box padding={6} background="neutral100" hasRadius>
                <Typography textColor="neutral600">
                  Search for an employee by ID or email to view personal overall analytics.
                </Typography>
              </Box>
            )}
          </Box>
        </Layouts.Content>
      </Page.Main>
    </>
  );
}
