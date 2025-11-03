import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Plus, Server, Play, Power, PowerOff, Loader, Copy, Eye, Edit, Key, AlertCircle, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import TestEndpointModal from '../components/TestEndpointModal';
import APIKeyModal from '../components/APIKeyModal';
import ConfirmationModal from '../components/ConfirmationModal';
import toast from 'react-hot-toast';

const Endpoints = () => {
  const [testModalEndpoint, setTestModalEndpoint] = useState(null);
  const [apiKeyModal, setApiKeyModal] = useState({ isOpen: false, apiKey: null, endpointName: null });
  const [deleteConfirmModal, setDeleteConfirmModal] = useState({ isOpen: false, endpoint: null });
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
      // Find the endpoint name for the modal
      const endpoint = endpoints?.data?.find(e => e.id === endpointId);
      const response = await apiService.generateAPIKey(endpointId);
      if (response.success) {
        // Show API key in modal (key is only shown once)
        if (response.data.token) {
          setApiKeyModal({
            isOpen: true,
            apiKey: response.data.token,
            endpointName: endpoint?.name || null
          });
        }
        // Refresh endpoints to update hasToken status
        queryClient.invalidateQueries('endpoints');
        queryClient.invalidateQueries('activity');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to generate API Key');
    }
  };

  const handleDeleteClick = (endpoint) => {
    setDeleteConfirmModal({ isOpen: true, endpoint });
  };

  const handleDeleteConfirm = async () => {
    const { endpoint } = deleteConfirmModal;
    if (!endpoint) return;

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
      setDeleteConfirmModal({ isOpen: false, endpoint: null });
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
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Type</th>
                  <th>Method</th>
                  <th>Rate Limit</th>
                  <th>Tags</th>
                  <th>API Key</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
            {endpoints?.data?.map((endpoint) => (
                  <tr key={endpoint.id}>
                    <td>
                      <div className="flex items-center">
                        <Server className="h-5 w-5 text-snowflake-400 mr-2" />
                        <div>
                          {endpoint.description ? (
                            <div 
                              className="text-sm font-small text-snowflake-900 cursor-help relative group"
                              title={endpoint.description}
                            >
                              {endpoint.name}
                            </div>
                          ) : (
                            <div className="text-sm font-small text-snowflake-900">
                              {endpoint.name}
                            </div>
                          )}
                          {endpoint.url && (
                            <div className="mt-1 flex items-center gap-1">
                              <code className="text-xs text-primary-600 bg-primary-50 px-1.5 py-0.5 rounded">
                                {endpoint.url.length > 40 ? `${endpoint.url.substring(0, 40)}...` : endpoint.url}
                              </code>
                              <button
                                onClick={() => handleCopyLink(endpoint.url)}
                                className="p-0.5 text-primary-600 hover:text-primary-800 hover:bg-primary-100 rounded"
                                title="Copy endpoint URL"
                              >
                                <Copy className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${
                          endpoint.status === 'active' ? 'badge-success' : 
                          endpoint.status === 'suspended' ? 'badge-error' : 
                          'badge-warning'
                        }`}>
                          {endpoint.status === 'active' ? 'Active' : 
                           endpoint.status === 'suspended' ? 'Suspended' : 
                           'Draft'}
                        </span>
                    </td>
                    <td className="text-sm text-snowflake-600">
                      {endpoint.type || 'N/A'}
                    </td>
                    <td className="text-sm text-snowflake-600">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-snowflake-100 text-snowflake-800">
                        {endpoint.method || 'GET'}
                          </span>
                    </td>
                    <td className="text-sm text-snowflake-600">
                      {endpoint.rateLimit || 0}/min
                    </td>
                     <td>
                      {endpoint.tags && endpoint.tags.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {endpoint.tags.slice(0, 3).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-white"
                              style={{ backgroundColor: tag.color || '#3B82F6' }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {endpoint.tags.length > 3 && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium text-snowflake-600 bg-snowflake-100">
                              +{endpoint.tags.length - 3}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-snowflake-400">No tags</span>
                      )}
                    </td>
                    <td>
                      {endpoint.hasToken ? (
                        <div className="inline-flex items-center justify-center w-6 h-6" title="API Key exists">
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center justify-center w-6 h-6" title="No API Key">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                        </div>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center justify-end space-x-1">
                  {!endpoint.hasToken && (
                    <button
                      onClick={() => handleGenerateAPIKey(endpoint.id)}
                            className="p-2 rounded bg-yellow-100 text-yellow-600 hover:bg-yellow-200 transition-colors"
                      title="Generate API Key (required for activation)"
                    >
                      <Key className="h-4 w-4" />
                    </button>
                  )}
                    {(endpoint.status === 'active' || endpoint.status === 'suspended' || endpoint.isActive !== undefined) && (
                      <button
                        onClick={() => handleStatusToggle(endpoint)}
                        disabled={updatingStatus[endpoint.id] || !endpoint.hasToken}
                            className={`p-2 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          endpoint.status === 'active' || (endpoint.isActive && endpoint.status !== 'suspended')
                            ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                            : 'bg-green-100 text-green-600 hover:bg-green-200'
                            }`}
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
                          className="p-2 rounded bg-primary-100 text-primary-600 hover:bg-primary-200 transition-colors"
                      title="Test endpoint"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                    <a
                      href={`/endpoints/${endpoint.id}`}
                          className="p-2 rounded bg-snowflake-100 text-snowflake-600 hover:bg-snowflake-200 transition-colors"
                      title="View endpoint"
                    >
                      <Eye className="h-4 w-4" />
                    </a>
                    <a
                      href={`/endpoints/${endpoint.id}/edit`}
                          className="p-2 rounded bg-snowflake-100 text-snowflake-600 hover:bg-snowflake-200 transition-colors"
                      title="Edit endpoint"
                    >
                      <Edit className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteClick(endpoint)}
                      disabled={deletingEndpoint === endpoint.id}
                          className="p-2 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      title="Delete endpoint"
                    >
                      {deletingEndpoint === endpoint.id ? (
                        <Loader className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
                </div>
        </div>
      )}

      {/* Test Endpoint Modal */}
      <TestEndpointModal
        isOpen={!!testModalEndpoint}
        onClose={() => setTestModalEndpoint(null)}
        endpoint={testModalEndpoint}
      />

      {/* API Key Modal */}
      <APIKeyModal
        isOpen={apiKeyModal.isOpen}
        onClose={() => setApiKeyModal({ isOpen: false, apiKey: null, endpointName: null })}
        apiKey={apiKeyModal.apiKey}
        endpointName={apiKeyModal.endpointName}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, endpoint: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Endpoint"
        message={deleteConfirmModal.endpoint ? `Are you sure you want to delete the endpoint "${deleteConfirmModal.endpoint.name}"?\n\nThis action cannot be undone and will also revoke any associated API keys.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default Endpoints;
