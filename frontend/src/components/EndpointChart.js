import React, { useState, useMemo } from 'react';
import { useQuery } from 'react-query';
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { apiService } from '../services/api';

const EndpointChart = ({ endpoints }) => {
  const [selectedDays, setSelectedDays] = useState(7); // Default to 7 days
  
  // Color palette for different endpoints
  const colorPalette = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
    '#F97316', // Orange
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Violet
  ];
  
  const { data: usageData, isLoading } = useQuery(
    ['endpointUsage', selectedDays],
    () => apiService.getEndpointUsage(selectedDays),
    { refetchInterval: 60000 } // Refresh every minute
  );

  // Create a map of endpoint ID to usage
  const usageMap = useMemo(() => {
    const map = {};
  if (usageData?.data) {
    usageData.data.forEach(item => {
        map[item.endpointId] = item.usage;
    });
  }
    return map;
  }, [usageData]);

  // Map endpoints to chart data with real usage and colors
  const chartData = useMemo(() => {
    return endpoints.map((endpoint, index) => ({
    name: endpoint.name.length > 15 
      ? `${endpoint.name.substring(0, 15)}...` 
      : endpoint.name,
      fullName: endpoint.name,
    usage: usageMap[endpoint.id] || 0,
    type: endpoint.type,
      color: colorPalette[index % colorPalette.length],
    }));
  }, [endpoints, usageMap]);

  // Calculate date range
  const dateRange = useMemo(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - selectedDays);
    
    const formatDate = (date) => {
      return date.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        year: date.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    };
    
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  }, [selectedDays]);

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white p-3 border border-snowflake-200 rounded-lg shadow-lg">
          <p className="font-medium text-snowflake-900">{data.fullName || label}</p>
          <p className="text-sm text-snowflake-600">
            Usage: <span className="font-medium">{payload[0].value}</span> requests
          </p>
          <p className="text-sm text-snowflake-600">
            Type: <span className="font-medium">{data.type}</span>
          </p>
          <p className="text-xs text-snowflake-500 mt-1">
            Period: {dateRange}
          </p>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-snowflake-500">
        <div className="text-center">
          <p className="text-lg font-medium">No endpoints available</p>
          <p className="text-sm">Create your first endpoint to see usage data</p>
        </div>
      </div>
    );
  }

  const timeRanges = [
    { label: '1 Day', value: 1 },
    { label: '7 Days', value: 7 },
    { label: '30 Days', value: 30 },
    { label: '90 Days', value: 90 },
  ];

  return (
    <div>
      {/* Time Range Selector and Date Range */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium text-snowflake-700">Time Range:</span>
          <div className="flex space-x-1">
            {timeRanges.map((range) => (
              <button
                key={range.value}
                onClick={() => setSelectedDays(range.value)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  selectedDays === range.value
                    ? 'bg-primary-600 text-white'
                    : 'bg-snowflake-100 text-snowflake-700 hover:bg-snowflake-200'
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        <div className="text-sm text-snowflake-500 font-medium">
          {dateRange}
        </div>
      </div>

      {/* Chart */}
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={chartData}
          margin={{
            top: 20,
            right: 30,
            left: 20,
            bottom: 5,
          }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis 
            dataKey="name" 
            stroke="#64748b"
            fontSize={12}
            angle={-45}
            textAnchor="end"
            height={60}
          />
          <YAxis 
            stroke="#64748b"
            fontSize={12}
            tickFormatter={(value) => value.toLocaleString()}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar 
            dataKey="usage" 
            radius={[2, 2, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>

      {/* Legend */}
      {chartData.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3">
          {chartData.map((endpoint, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: endpoint.color }}
              />
              <span className="text-xs text-snowflake-600">{endpoint.fullName}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EndpointChart;
