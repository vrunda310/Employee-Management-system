import React from 'react';
import { Box, Flex, Typography, SingleSelect, SingleSelectOption } from '@strapi/design-system';

export function Filters({
  viewMode,
  onViewModeChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  department,
  onDepartmentChange,
  departments = [],
  company,
  onCompanyChange,
  showEmployeeSelector,
  children,
  // Employee Table (Learning dashboard only)
  showEmployeeTable = false,
  search,
  onSearchChange,
  sortOrder,
  onSortOrderChange,
}) {
  const companies = [
    { value: '', label: 'All Companies' },
    { value: 'AIA', label: 'AIA' },
    { value: 'Vega', label: 'Vega' },
  ];

  return (
    <Box
      padding={4}
      background="neutral0"
      hasRadius
      shadow="tableShadow"
      borderColor="neutral200"
      borderWidth="1px"
      borderStyle="solid"
      marginBottom={4}
    >
      <Typography variant="sigma" textColor="neutral600" fontWeight="semiBold" style={{ marginBottom: 12 }}>
        Filters
      </Typography>
      <Flex gap={4} wrap="wrap" alignItems="end">
        <Box style={{ minWidth: 140 }}>
          <Typography variant="pi" textColor="neutral600" style={{ marginBottom: 4 }}>
            View
          </Typography>
          <SingleSelect value={viewMode} onChange={onViewModeChange}>
            <SingleSelectOption value="global">Global</SingleSelectOption>
            <SingleSelectOption value="personal">Personal</SingleSelectOption>
            {showEmployeeTable && (
              <SingleSelectOption value="table">Employee Table</SingleSelectOption>
            )}
          </SingleSelect>
        </Box>
        {showEmployeeSelector && viewMode === 'personal' && children}
        {viewMode === 'table' && (
          <Box style={{ minWidth: 200 }}>
            <Typography variant="pi" textColor="neutral600" style={{ marginBottom: 4 }}>
              Search Employee (ID or name)
            </Typography>
            <input
              type="text"
              value={search || ''}
              onChange={(e) => onSearchChange?.(e.target.value || '')}
              placeholder="ID, name, or email"
              style={{
                padding: '8px 12px',
                border: '1px solid #dcdce4',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '100%',
              }}
            />
          </Box>
        )}
        {viewMode === 'table' && (
          <Box style={{ minWidth: 140 }}>
            <Typography variant="pi" textColor="neutral600" style={{ marginBottom: 4 }}>
              Course Completion Time
            </Typography>
            <select
              value={sortOrder || 'desc'}
              onChange={(e) => onSortOrderChange?.(e.target.value)}
              style={{
                padding: '8px 12px',
                border: '1px solid #dcdce4',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '100%',
              }}
            >
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </select>
          </Box>
        )}
        {viewMode !== 'table' && (
          <>
            <Box>
              <Typography variant="pi" textColor="neutral600" style={{ marginBottom: 4 }}>
                Date From
              </Typography>
              <input
                type="date"
                value={dateFrom || ''}
                onChange={(e) => onDateFromChange(e.target.value || null)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #dcdce4',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </Box>
            <Box>
              <Typography variant="pi" textColor="neutral600" style={{ marginBottom: 4 }}>
                Date To
              </Typography>
              <input
                type="date"
                value={dateTo || ''}
                onChange={(e) => onDateToChange(e.target.value || null)}
                style={{
                  padding: '8px 12px',
                  border: '1px solid #dcdce4',
                  borderRadius: '4px',
                  fontSize: '14px',
                }}
              />
            </Box>
          </>
        )}
        {viewMode !== 'personal' && viewMode !== 'table' && departments.length > 0 && (
          <Box style={{ minWidth: 180 }}>
            <Typography variant="pi" textColor="neutral600" style={{ marginBottom: 4 }}>
              Department
            </Typography>
            <select
              value={department || ''}
              onChange={(e) => onDepartmentChange(e.target.value || '')}
              style={{
                padding: '8px 12px',
                border: '1px solid #dcdce4',
                borderRadius: '4px',
                fontSize: '14px',
                minWidth: '100%',
              }}
            >
              <option value="">All Departments</option>
              {departments.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </select>
          </Box>
        )}
        <Box style={{ minWidth: 140 }}>
          <Typography variant="pi" textColor="neutral600" style={{ marginBottom: 4 }}>
            Company
          </Typography>
          <select
            value={company || ''}
            onChange={(e) => onCompanyChange(e.target.value || '')}
            style={{
              padding: '8px 12px',
              border: '1px solid #dcdce4',
              borderRadius: '4px',
              fontSize: '14px',
              minWidth: '100%',
            }}
          >
            {companies.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </Box>
      </Flex>
    </Box>
  );
}
