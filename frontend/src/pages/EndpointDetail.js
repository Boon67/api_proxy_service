import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Server, Key, Settings, Edit, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';

const EndpointDetail = () => {
  const { id } = useParams();
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
          <a
            href={`/endpoints/${id}/edit`}
            className="btn btn-secondary btn-md"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </a>
          <button className="btn btn-danger btn-md">
            <Trash2 className="h-4 w-4 mr-2" />
            Delete
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
              Status: {endpointData.isActive ? 'Active' : 'Inactive'}
            </h3>
            <p className="text-sm text-snowflake-600">
              {endpointData.isActive 
                ? 'This endpoint is currently active and accepting requests'
                : 'This endpoint is inactive and not accepting requests'
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
          <h3 className="text-lg font-medium text-snowflake-900 mb-4">Target</h3>
          <div className="bg-snowflake-50 rounded-md p-3">
            <code className="text-sm text-snowflake-900 break-all">
              {endpointData.target}
            </code>
          </div>
        </div>
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
    </div>
  );
};

export default EndpointDetail;
