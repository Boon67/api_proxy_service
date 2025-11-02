import React from 'react';
import { useQuery } from 'react-query';
import { Key, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

const APIKeys = () => {
  const { data: apiKeys, isLoading, refetch } = useQuery(
    'apiKeys',
    apiService.getAPIKeys,
    { refetchInterval: 30000 }
  );

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('API Key copied to clipboard!');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">API Keys</h1>
          <p className="mt-1 text-sm text-snowflake-600">
            Manage API keys for endpoint access
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary btn-md"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* API Keys List */}
      {apiKeys?.data?.length === 0 ? (
        <div className="text-center py-12">
          <Key className="mx-auto h-12 w-12 text-snowflake-400" />
          <h3 className="mt-2 text-sm font-medium text-snowflake-900">No API Keys</h3>
          <p className="mt-1 text-sm text-snowflake-500">
            Create an endpoint to generate API keys.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <ul className="divide-y divide-snowflake-200">
            {apiKeys?.data?.map((apiKey) => (
              <li key={apiKey.id}>
                <div className="px-4 py-4 flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="flex-shrink-0">
                      <Key className="h-8 w-8 text-snowflake-400" />
                    </div>
                    <div className="ml-4">
                      <div className="flex items-center">
                        <h3 className="text-sm font-medium text-snowflake-900">
                          {apiKey.metadata?.endpointName || 'Unknown Endpoint'}
                        </h3>
                        <span className={`ml-2 badge ${
                          apiKey.isActive ? 'badge-success' : 'badge-error'
                        }`}>
                          {apiKey.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                      <p className="text-sm text-snowflake-500">
                        Created: {new Date(apiKey.createdAt).toLocaleString()}
                      </p>
                      <div className="mt-1 flex items-center text-xs text-snowflake-500">
                        <span className="mr-4">Usage: {apiKey.usageCount} requests</span>
                        <span>Last used: {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleString() : 'Never'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => copyToClipboard(apiKey.token)}
                      className="btn btn-secondary btn-sm"
                    >
                      <Copy className="h-4 w-4 mr-1" />
                      Copy
                    </button>
                    <button className="btn btn-danger btn-sm">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Revoke
                    </button>
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

export default APIKeys;
