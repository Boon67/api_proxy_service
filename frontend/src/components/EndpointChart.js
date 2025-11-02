import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const EndpointChart = ({ endpoints }) => {
  // Mock data - in a real app, this would come from analytics API
  const chartData = endpoints.map((endpoint, index) => ({
    name: endpoint.name.length > 15 
      ? `${endpoint.name.substring(0, 15)}...` 
      : endpoint.name,
    usage: Math.floor(Math.random() * 1000) + 100, // Mock usage data
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
