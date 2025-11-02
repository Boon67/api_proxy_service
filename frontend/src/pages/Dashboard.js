import React from 'react';
import { useQuery } from 'react-query';
import {
  Server,
  Key,
  Activity,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  Settings,
  Tag,
} from 'lucide-react';
import { apiService } from '../services/api';
import StatsCard from '../components/StatsCard';
import RecentActivity from '../components/RecentActivity';
import EndpointChart from '../components/EndpointChart';

const Dashboard = () => {
  const { data: stats, isLoading: statsLoading } = useQuery(
    'stats',
    apiService.getStats,
    { refetchInterval: 30000 }
  );

  const { data: health, isLoading: healthLoading } = useQuery(
    'health',
    apiService.getHealth,
    { refetchInterval: 10000 }
  );

  const { data: endpoints, isLoading: endpointsLoading } = useQuery(
    'endpoints',
    apiService.getEndpoints,
    { refetchInterval: 30000 }
  );

  const { data: tagsResponse, isLoading: tagsLoading } = useQuery(
    'tags',
    apiService.getTags,
    { refetchInterval: 30000 }
  );
  const tags = tagsResponse?.data || [];

  if (statsLoading || healthLoading || endpointsLoading || tagsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  const systemStatus = health?.status === 'healthy' ? 'healthy' : 'degraded';
  const activeEndpoints = endpoints?.data?.filter(ep => ep.status === 'active') || [];
  // Dashboard uses stats from API, not filtering from endpoints array

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-snowflake-900">Dashboard</h1>
        <p className="mt-1 text-sm text-snowflake-600">
          Overview of your Snowflake API Proxy Service
        </p>
      </div>

      {/* System Status */}
      <div className="bg-white rounded-lg border border-snowflake-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            {systemStatus === 'healthy' ? (
              <CheckCircle className="h-8 w-8 text-green-500" />
            ) : (
              <AlertCircle className="h-8 w-8 text-yellow-500" />
            )}
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-snowflake-900">
              System Status: {systemStatus === 'healthy' ? 'Healthy' : 'Degraded'}
            </h3>
            <p className="text-sm text-snowflake-600">
              {systemStatus === 'healthy' 
                ? 'All services are running normally'
                : 'Some services may be experiencing issues'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
        <StatsCard
          title="Total Endpoints"
          value={stats?.data?.endpoints?.total || 0}
          icon={Server}
          color="blue"
          change={stats?.data?.endpoints?.change || 0}
          changeLabel="from last month"
        />
        <StatsCard
          title="Active Endpoints"
          value={stats?.data?.endpoints?.active || 0}
          icon={Activity}
          color="green"
          change={undefined}
          changeLabel={undefined}
        />
        <StatsCard
          title="Active API Keys"
          value={stats?.data?.tokens?.active || 0}
          icon={Key}
          color="purple"
          change={stats?.data?.tokens?.change || 0}
          changeLabel="from last month"
        />
        <StatsCard
          title="Total Tags"
          value={tags.length || 0}
          icon={Tag}
          color="indigo"
          change={undefined}
          changeLabel={undefined}
        />
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Endpoint Usage Chart */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <h3 className="text-lg font-medium text-snowflake-900 mb-4">
            Endpoint Usage
          </h3>
          <EndpointChart endpoints={activeEndpoints} />
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <h3 className="text-lg font-medium text-snowflake-900 mb-4">
            Recent Activity
          </h3>
          <RecentActivity />
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg border border-snowflake-200 p-6">
        <h3 className="text-lg font-medium text-snowflake-900 mb-4">
          Quick Actions
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <a
            href="/endpoints/new"
            className="relative block rounded-lg border-2 border-dashed border-snowflake-300 p-6 text-center hover:border-snowflake-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Server className="mx-auto h-8 w-8 text-snowflake-400" />
            <span className="mt-2 block text-sm font-medium text-snowflake-900">
              Create Endpoint
            </span>
          </a>
          <a
            href="/api-keys"
            className="relative block rounded-lg border-2 border-dashed border-snowflake-300 p-6 text-center hover:border-snowflake-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Key className="mx-auto h-8 w-8 text-snowflake-400" />
            <span className="mt-2 block text-sm font-medium text-snowflake-900">
              Manage API Keys
            </span>
          </a>
          <a
            href="/tags"
            className="relative block rounded-lg border-2 border-dashed border-snowflake-300 p-6 text-center hover:border-snowflake-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Tag className="mx-auto h-8 w-8 text-snowflake-400" />
            <span className="mt-2 block text-sm font-medium text-snowflake-900">
              Manage Tags
            </span>
          </a>
          <a
            href="/settings"
            className="relative block rounded-lg border-2 border-dashed border-snowflake-300 p-6 text-center hover:border-snowflake-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Settings className="mx-auto h-8 w-8 text-snowflake-400" />
            <span className="mt-2 block text-sm font-medium text-snowflake-900">
              Settings
            </span>
          </a>
          <button
            onClick={() => window.location.reload()}
            className="relative block rounded-lg border-2 border-dashed border-snowflake-300 p-6 text-center hover:border-snowflake-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          >
            <Activity className="mx-auto h-8 w-8 text-snowflake-400" />
            <span className="mt-2 block text-sm font-medium text-snowflake-900">
              Refresh Data
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
