import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { Server, Edit, Trash2, Play, Copy, ExternalLink } from 'lucide-react';
import { apiService } from '../services/api';
import TestEndpointModal from '../components/TestEndpointModal';
import toast from 'react-hot-toast';

const EndpointDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { data: endpoint, isLoading, error } = useQuery(
    ['endpoint', id],
    () => apiService.getEndpoint(id),
    { enabled: !!id }
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error || !endpoint?.data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <h3 className="text-lg font-medium text-red-800">Endpoint Not Found</h3>
        <p className="mt-2 text-sm text-red-600">
          The requested endpoint could not be found.
        </p>
      </div>
    );
  }

  const endpointData = endpoint.data;

  const handleDelete = async () => {
    if (!window.confirm(`Are you sure you want to delete the endpoint "${endpointData.name}"?\n\nThis action cannot be undone and will also revoke any associated API keys.`)) {
      return;
    }

    setIsDeleting(true);
    try {
      const response = await apiService.deleteEndpoint(id);
      if (response.success) {
        toast.success('Endpoint deleted successfully');
        // Invalidate queries to refresh data
        queryClient.invalidateQueries('endpoints');
        queryClient.invalidateQueries('activity');
        // Navigate back to endpoints list
        navigate('/endpoints');
      } else {
        toast.error(response.error || 'Failed to delete endpoint');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'An error occurred while deleting the endpoint');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">{endpointData.name}</h1>
          <p className="mt-1 text-sm text-snowflake-600">
            {endpointData.description || 'No description'}
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => setTestModalOpen(true)}
            className="btn btn-primary btn-md"
          >
            <Play className="h-4 w-4 mr-2" />
            Test Endpoint
          </button>
          <a
            href={`/endpoints/${id}/edit`}
            className="btn btn-secondary btn-md"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </a>
          <button 
            onClick={handleDelete}
            disabled={isDeleting}
            className="btn btn-danger btn-md"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="bg-white rounded-lg border border-snowflake-200 p-6">
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <Server className="h-8 w-8 text-snowflake-400" />
          </div>
          <div className="ml-3">
            <h3 className="text-lg font-medium text-snowflake-900">
              Status: {endpointData.status === 'active' ? 'Active' : 
                       endpointData.status === 'suspended' ? 'Suspended' : 'Draft'}
            </h3>
            <p className="text-sm text-snowflake-600">
              {endpointData.status === 'active' 
                ? 'This endpoint is currently active and accepting requests'
                : endpointData.status === 'suspended'
                ? 'This endpoint is suspended and not accepting requests'
                : 'This endpoint is in draft mode and not accepting requests'
              }
            </p>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <h3 className="text-lg font-medium text-snowflake-900 mb-4">Configuration</h3>
          <dl className="space-y-3">
            <div>
              <dt className="text-sm font-medium text-snowflake-500">Type</dt>
              <dd className="text-sm text-snowflake-900">{endpointData.type}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-snowflake-500">Method</dt>
              <dd className="text-sm text-snowflake-900">{endpointData.method}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-snowflake-500">Rate Limit</dt>
              <dd className="text-sm text-snowflake-900">{endpointData.rateLimit} requests/minute</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-snowflake-500">Created</dt>
              <dd className="text-sm text-snowflake-900">
                {new Date(endpointData.createdAt).toLocaleString()}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <h3 className="text-lg font-medium text-snowflake-900 mb-4">Endpoint URL</h3>
          {endpointData.url ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={endpointData.url}
                  className="flex-1 px-3 py-2 border border-snowflake-300 rounded-md bg-snowflake-50 text-sm font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(endpointData.url);
                    toast.success('URL copied to clipboard!');
                  }}
                  className="px-3 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50 flex items-center"
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={endpointData.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50 flex items-center"
                  title="Open URL"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="text-xs text-snowflake-500">
                Use this URL with an API Key in the Authorization header or as a ?token= query parameter
              </p>
            </div>
          ) : (
            <p className="text-sm text-snowflake-500">URL not available</p>
          )}
        </div>

        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <h3 className="text-lg font-medium text-snowflake-900 mb-4">Target</h3>
          <div className="bg-snowflake-50 rounded-md p-3">
            <code className="text-sm text-snowflake-900 break-all">
              {endpointData.target}
            </code>
          </div>
        </div>

        {endpointData.tags && endpointData.tags.length > 0 && (
          <div className="bg-white rounded-lg border border-snowflake-200 p-6">
            <h3 className="text-lg font-medium text-snowflake-900 mb-4">Tags</h3>
            <div className="flex flex-wrap gap-2">
              {endpointData.tags.map((tag) => (
                <span
                  key={tag.id}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium text-white"
                  style={{ backgroundColor: tag.color || '#3B82F6' }}
                >
                  {tag.name}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Parameters */}
      {endpointData.parameters && endpointData.parameters.length > 0 && (
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <h3 className="text-lg font-medium text-snowflake-900 mb-4">Parameters</h3>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Required</th>
                  <th>Description</th>
                </tr>
              </thead>
              <tbody>
                {endpointData.parameters.map((param, index) => (
                  <tr key={index}>
                    <td className="font-medium">{param.name}</td>
                    <td>{param.type}</td>
                    <td>
                      <span className={`badge ${
                        param.required ? 'badge-error' : 'badge-info'
                      }`}>
                        {param.required ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{param.description || 'No description'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Test Endpoint Modal */}
      <TestEndpointModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        endpoint={endpointData}
      />
    </div>
  );
};

export default EndpointDetail;
