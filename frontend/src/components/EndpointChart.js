import React from 'react';
import { useQuery } from 'react-query';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiService } from '../services/api';

const EndpointChart = ({ endpoints }) => {
  const { data: usageData, isLoading } = useQuery(
    'endpointUsage',
    apiService.getEndpointUsage,
    { refetchInterval: 60000 } // Refresh every minute
  );

  // Create a map of endpoint ID to usage
  const usageMap = {};
  if (usageData?.data) {
    usageData.data.forEach(item => {
      usageMap[item.endpointId] = item.usage;
    });
  }

  // Map endpoints to chart data with real usage
  const chartData = endpoints.map((endpoint) => ({
    name: endpoint.name.length > 15 
      ? `${endpoint.name.substring(0, 15)}...` 
      : endpoint.name,
    usage: usageMap[endpoint.id] || 0,
    type: endpoint.type,
  }));

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-snowflake-200 rounded-lg shadow-lg">
          <p className="font-medium text-snowflake-900">{label}</p>
          <p className="text-sm text-snowflake-600">
            Usage: <span className="font-medium">{payload[0].value}</span> requests
          </p>
          <p className="text-sm text-snowflake-600">
            Type: <span className="font-medium">{payload[0].payload.type}</span>
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

  return (
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
            fill="#3b82f6"
            radius={[2, 2, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default EndpointChart;
