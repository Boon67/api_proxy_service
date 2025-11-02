import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Plus, Server, Play, Power, PowerOff, Loader, Copy, Eye, Edit, Key, AlertCircle, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import TestEndpointModal from '../components/TestEndpointModal';
import toast from 'react-hot-toast';

const Endpoints = () => {
  const [testModalEndpoint, setTestModalEndpoint] = useState(null);
  const [updatingStatus, setUpdatingStatus] = useState({});
  const [deletingEndpoint, setDeletingEndpoint] = useState(null);
  const queryClient = useQueryClient();
  
  const { data: endpoints, isLoading, error } = useQuery(
    'endpoints',
    apiService.getEndpoints,
    { refetchInterval: 30000 }
  );

  const handleStatusToggle = async (endpoint) => {
    const currentStatus = endpoint.status || (endpoint.isActive ? 'active' : 'suspended');
    let newStatus;
    
    if (currentStatus === 'active') {
      newStatus = 'suspended';
    } else if (currentStatus === 'suspended') {
      newStatus = 'active';
    } else {
      // If draft, activate it
      newStatus = 'active';
    }

    setUpdatingStatus({ ...updatingStatus, [endpoint.id]: true });
    
    try {
      await apiService.updateEndpointStatus(endpoint.id, newStatus);
      toast.success(`Endpoint ${newStatus === 'active' ? 'activated' : 'suspended'} successfully`);
      // Refresh the endpoints list and activity
      queryClient.invalidateQueries('endpoints');
      queryClient.invalidateQueries('activity');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to update endpoint status');
    } finally {
      setUpdatingStatus({ ...updatingStatus, [endpoint.id]: false });
    }
  };

  const handleCopyLink = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Endpoint URL copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy URL');
    }
  };

  const handleGenerateAPIKey = async (endpointId) => {
    try {
      const response = await apiService.generateAPIKey(endpointId);
      if (response.success) {
        toast.success('API Key generated successfully!');
        // Show API key in a modal or alert (key is only shown once)
        if (response.data.token) {
          const userConfirmed = window.confirm(
            `Your API Key (shown only once):\n\n${response.data.token}\n\nCopy this API key now - it won't be shown again!`
          );
          if (userConfirmed) {
            await navigator.clipboard.writeText(response.data.token);
            toast.success('API Key copied to clipboard');
          }
        }
        // Refresh endpoints to update hasToken status
        queryClient.invalidateQueries('endpoints');
        queryClient.invalidateQueries('activity');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to generate API Key');
    }
  };

  const handleDelete = async (endpoint) => {
    if (!window.confirm(`Are you sure you want to delete the endpoint "${endpoint.name}"?\n\nThis action cannot be undone and will also revoke any associated API keys.`)) {
      return;
    }

    setDeletingEndpoint(endpoint.id);
    try {
      const response = await apiService.deleteEndpoint(endpoint.id);
      if (response.success) {
        toast.success('Endpoint deleted successfully');
        // Refresh endpoints list and activity
        queryClient.invalidateQueries('endpoints');
        queryClient.invalidateQueries('activity');
      } else {
        toast.error(response.error || 'Failed to delete endpoint');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'An error occurred while deleting the endpoint');
    } finally {
      setDeletingEndpoint(null);
    }
  };

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
                          endpoint.status === 'active' ? 'badge-success' : 
                          endpoint.status === 'suspended' ? 'badge-error' : 
                          'badge-warning'
                        }`}>
                          {endpoint.status === 'active' ? 'Active' : 
                           endpoint.status === 'suspended' ? 'Suspended' : 
                           'Draft'}
                        </span>
                        {!endpoint.hasToken && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            <AlertCircle className="h-3 w-3" />
                            No API Key
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-snowflake-500">
                        {endpoint.description || 'No description'}
                      </p>
                      <div className="mt-1 flex items-center text-xs text-snowflake-500">
                        <span className="mr-4">Type: {endpoint.type}</span>
                        <span className="mr-4">Method: {endpoint.method}</span>
                        <span>Rate Limit: {endpoint.rateLimit}/min</span>
                      </div>
                      {endpoint.tags && endpoint.tags.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {endpoint.tags.slice(0, 5).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: tag.color || '#3B82F6' }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {endpoint.tags.length > 5 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-snowflake-600 bg-snowflake-100">
                              +{endpoint.tags.length - 5} more
                            </span>
                          )}
                        </div>
                      )}
                      {endpoint.url && (
                        <div className="mt-2 flex items-center gap-2">
                          <code className="text-xs text-primary-600 bg-primary-50 px-2 py-1 rounded">
                            {endpoint.url}
                          </code>
                          <button
                            onClick={() => handleCopyLink(endpoint.url)}
                            className="p-1 text-primary-600 hover:text-primary-800 hover:bg-primary-100 rounded"
                            title="Copy endpoint URL"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                  {!endpoint.hasToken && (
                    <button
                      onClick={() => handleGenerateAPIKey(endpoint.id)}
                      className="p-2 rounded bg-yellow-100 text-yellow-600 hover:bg-yellow-200"
                      title="Generate API Key (required for activation)"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                  )}
                    {(endpoint.status === 'active' || endpoint.status === 'suspended' || endpoint.isActive !== undefined) && (
                      <button
                        onClick={() => handleStatusToggle(endpoint)}
                        disabled={updatingStatus[endpoint.id] || !endpoint.hasToken}
                        className={`p-2 rounded ${
                          endpoint.status === 'active' || (endpoint.isActive && endpoint.status !== 'suspended')
                            ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                        } disabled:opacity-50`}
              title={
                !endpoint.hasToken 
                  ? 'API Key required - generate API key first'
                  : endpoint.status === 'active' || (endpoint.isActive && endpoint.status !== 'suspended')
                  ? 'Suspend endpoint'
                  : 'Activate endpoint'
              }
                      >
                        {updatingStatus[endpoint.id] ? (
                          <Loader className="h-4 w-4 animate-spin" />
                        ) : endpoint.status === 'active' || (endpoint.isActive && endpoint.status !== 'suspended') ? (
                          <PowerOff className="h-4 w-4" />
                        ) : (
                          <Power className="h-4 w-4" />
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => setTestModalEndpoint(endpoint)}
                      className="p-2 rounded bg-primary-100 text-primary-600 hover:bg-primary-200"
                      title="Test endpoint"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <a
                      href={`/endpoints/${endpoint.id}`}
                      className="p-2 rounded bg-snowflake-100 text-snowflake-600 hover:bg-snowflake-200"
                      title="View endpoint"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <a
                      href={`/endpoints/${endpoint.id}/edit`}
                      className="p-2 rounded bg-snowflake-100 text-snowflake-600 hover:bg-snowflake-200"
                      title="Edit endpoint"
                    >
                      <Edit className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(endpoint)}
                      disabled={deletingEndpoint === endpoint.id}
                      className="p-2 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50"
                      title="Delete endpoint"
                    >
                      {deletingEndpoint === endpoint.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Test Endpoint Modal */}
      <TestEndpointModal
        isOpen={!!testModalEndpoint}
        onClose={() => setTestModalEndpoint(null)}
        endpoint={testModalEndpoint}
      />
    </div>
  );
};

export default Endpoints;
