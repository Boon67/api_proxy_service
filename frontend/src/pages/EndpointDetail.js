import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from 'react-query';
import { Server, Edit, Trash2, Play, Copy, ExternalLink } from 'lucide-react';
import { apiService } from '../services/api';
import TestEndpointModal from '../components/TestEndpointModal';
import ConfirmationModal from '../components/ConfirmationModal';
import toast from 'react-hot-toast';

const EndpointDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [testModalOpen, setTestModalOpen] = useState(false);
  const [deleteConfirmModal, setDeleteConfirmModal] = useState(false);
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

  // Helper function to get the correct endpoint URL based on environment
  const getCorrectEndpointUrl = (url) => {
    if (!url) return url;
    
    if (typeof window !== 'undefined') {
      const isLocalhost = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1' ||
                         window.location.hostname.includes('localhost');
      
      if (!isLocalhost) {
        // Replace the base URL with the current window origin
        // Extract the path from the endpoint URL (everything after /api/proxy/)
        const urlMatch = url.match(/\/api\/proxy\/(.+)$/);
        if (urlMatch) {
          // Use current window origin and rebuild the URL
          return `${window.location.origin}/api/proxy/${urlMatch[1]}`;
        }
      }
    }
    
    return url;
  };

  const displayUrl = getCorrectEndpointUrl(endpointData.url);

  const handleDeleteClick = () => {
    setDeleteConfirmModal(true);
  };

  const handleDeleteConfirm = async () => {
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
      setDeleteConfirmModal(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">{endpointData.name}</h1>
          <div className="mt-2 flex items-center justify-between text-sm text-snowflake-600">
            <span><span className="font-medium text-snowflake-700">Type:</span> {endpointData.type || 'N/A'}</span>
            <div className="flex items-center gap-4">
              <span><span className="font-medium text-snowflake-700">Method:</span> {endpointData.method || 'GET'}</span>
              <span><span className="font-medium text-snowflake-700">Rate Limit:</span> {endpointData.rateLimit || 0}/min</span>
            </div>
          </div>
          <p className="mt-2 text-xs text-snowflake-600">
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
            onClick={handleDeleteClick}
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
          {displayUrl ? (
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={displayUrl}
                  className="flex-1 px-3 py-2 border border-snowflake-300 rounded-md bg-snowflake-50 text-sm font-mono"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(displayUrl);
                    toast.success('URL copied to clipboard!');
                  }}
                  className="px-3 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50 flex items-center"
                  title="Copy URL"
                >
                  <Copy className="h-4 w-4" />
                </button>
                <a
                  href={displayUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50 flex items-center"
                  title="Open URL"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
              <p className="text-xs text-snowflake-500">
                Use this URL with an API Key in the X-API-Key header or as a ?API_KEY= query parameter
              </p>
            </div>
          ) : (
            <p className="text-sm text-snowflake-500">URL not available</p>
          )}
        </div>

        {/* Sample Code */}
        {displayUrl && (
          <div className="bg-white rounded-lg border border-snowflake-200 p-6">
            <h3 className="text-lg font-medium text-snowflake-900 mb-4">Sample Code</h3>
            {(() => {
              const endpointUrl = displayUrl;
              const apiKeyPlaceholder = 'YOUR_API_KEY';
              
              // Generate sample commands with placeholder
              const curlWithHeader = `curl -X ${endpointData.method || 'GET'} "${endpointUrl}" \\
  -H "X-API-Key: ${apiKeyPlaceholder}"`;
              
              const curlWithQuery = `curl -X ${endpointData.method || 'GET'} "${endpointUrl}?API_KEY=${apiKeyPlaceholder}"`;

              const pythonWithHeader = `import requests

api_key = "${apiKeyPlaceholder}"
url = "${endpointUrl}"
headers = {"X-API-Key": api_key}

response = requests.${endpointData.method === 'POST' ? 'post' : 'get'}(url, headers=headers)
print(response.json())`;

              const pythonWithQuery = `import requests

api_key = "${apiKeyPlaceholder}"
url = "${endpointUrl}" + "?API_KEY=" + api_key

response = requests.${endpointData.method === 'POST' ? 'post' : 'get'}(url)
print(response.json())`;

              return (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-snowflake-700">cURL (X-API-Key Header)</h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(curlWithHeader);
                          toast.success('cURL command copied!');
                        }}
                        className="px-2 py-1 text-xs font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded hover:bg-snowflake-50 flex items-center"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </button>
                    </div>
                    <div className="bg-snowflake-50 rounded-md p-3 border border-snowflake-200">
                      <pre className="text-xs text-snowflake-900 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                        {curlWithHeader}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-snowflake-700">cURL (Query Parameter)</h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(curlWithQuery);
                          toast.success('cURL command copied!');
                        }}
                        className="px-2 py-1 text-xs font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded hover:bg-snowflake-50 flex items-center"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </button>
                    </div>
                    <div className="bg-snowflake-50 rounded-md p-3 border border-snowflake-200">
                      <pre className="text-xs text-snowflake-900 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                        {curlWithQuery}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-snowflake-700">Python (X-API-Key Header)</h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pythonWithHeader);
                          toast.success('Python code copied!');
                        }}
                        className="px-2 py-1 text-xs font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded hover:bg-snowflake-50 flex items-center"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </button>
                    </div>
                    <div className="bg-snowflake-50 rounded-md p-3 border border-snowflake-200">
                      <pre className="text-xs text-snowflake-900 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                        {pythonWithHeader}
                      </pre>
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-sm font-medium text-snowflake-700">Python (Query Parameter)</h4>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(pythonWithQuery);
                          toast.success('Python code copied!');
                        }}
                        className="px-2 py-1 text-xs font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded hover:bg-snowflake-50 flex items-center"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy
                      </button>
                    </div>
                    <div className="bg-snowflake-50 rounded-md p-3 border border-snowflake-200">
                      <pre className="text-xs text-snowflake-900 font-mono whitespace-pre-wrap break-all overflow-x-auto">
                        {pythonWithQuery}
                      </pre>
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

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

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal}
        onClose={() => setDeleteConfirmModal(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Endpoint"
        message={endpointData ? `Are you sure you want to delete the endpoint "${endpointData.name}"?\n\nThis action cannot be undone and will also revoke any associated API keys.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default EndpointDetail;
