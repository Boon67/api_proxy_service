import React from 'react';
import { useQuery } from 'react-query';
import { Plus, Server, Key, Settings } from 'lucide-react';
import { apiService } from '../services/api';

const Endpoints = () => {
  const { data: endpoints, isLoading, error } = useQuery(
    'endpoints',
    apiService.getEndpoints,
    { refetchInterval: 30000 }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-800">Error Loading Endpoints</h3>
        <p className="mt-2 text-sm text-red-600">
          {error.message || 'Failed to load endpoints. Please try again.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">API Endpoints</h1>
          <p className="mt-1 text-sm text-snowflake-600">
            Manage your Snowflake API endpoints
          </p>
        </div>
        <a
          href="/endpoints/new"
          className="btn btn-primary btn-md"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create Endpoint
        </a>
      </div>

      {/* Endpoints List */}
      {endpoints?.data?.length === 0 ? (
        <div className="text-center py-12">
          <Server className="mx-auto h-12 w-12 text-snowflake-400" />
          <h3 className="mt-2 text-sm font-medium text-snowflake-900">No endpoints</h3>
          <p className="mt-1 text-sm text-snowflake-500">
            Get started by creating a new API endpoint.
          </p>
          <div className="mt-6">
            <a
              href="/endpoints/new"
              className="btn btn-primary btn-md"
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Endpoint
            </a>
          </div>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-snowflake-200">
            {endpoints?.data?.map((endpoint) => (
              <li key={endpoint.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Server className="h-8 w-8 text-snowflake-400" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-snowflake-900">
                          {endpoint.name}
                        </h3>
                        <span className={`ml-2 badge ${
                          endpoint.isActive ? 'badge-success' : 'badge-error'
                        }`}>
                          {endpoint.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-snowflake-500">
                        {endpoint.description || 'No description'}
                      </p>
                      <div className="mt-1 flex items-center text-xs text-snowflake-500">
                        <span className="mr-4">Type: {endpoint.type}</span>
                        <span className="mr-4">Method: {endpoint.method}</span>
                        <span>Rate Limit: {endpoint.rateLimit}/min</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <a
                      href={`/endpoints/${endpoint.id}`}
                      className="btn btn-secondary btn-sm"
                    >
                      View
                    </a>
                    <a
                      href={`/endpoints/${endpoint.id}/edit`}
                      className="btn btn-secondary btn-sm"
                    >
                      Edit
                    </a>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default Endpoints;
