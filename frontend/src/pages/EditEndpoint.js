import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm, watch } from 'react-hook-form';
import { useQuery, useQueryClient } from 'react-query';
import { Save, ArrowLeft, Play, Loader, Key } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import TagSelector from '../components/TagSelector';
import APIKeyModal from '../components/APIKeyModal';
import ConfirmationModal from '../components/ConfirmationModal';

const EditEndpoint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm();
  const type = watch('type');
  const target = watch('target');
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [apiKeyModal, setApiKeyModal] = React.useState({ isOpen: false, apiKey: null, endpointName: null });
  const [replaceApiKeyModal, setReplaceApiKeyModal] = React.useState(false);
  const [isReplacingApiKey, setIsReplacingApiKey] = React.useState(false);

  const { data: tagsResponse } = useQuery('tags', apiService.getTags);
  const tags = tagsResponse?.data || [];

  const { data: endpoint, isLoading } = useQuery(
    ['endpoint', id],
    () => apiService.getEndpoint(id),
    { 
      enabled: !!id,
      onSuccess: (data) => {
        if (data?.data) {
          // Prepare form data - convert null path to empty string for form display
          const formData = {
            ...data.data,
            path: data.data.path ?? '' // Use nullish coalescing to handle null/undefined
          };
          reset(formData);
          // Set selected tags from endpoint
          if (data.data.tags) {
            setSelectedTags(data.data.tags.map(tag => tag.id));
          }
        }
      }
    }
  );

  const handleTestTarget = async () => {
    if (!type || !target) {
      toast.error('Please enter both Type and Target to test');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    try {
      const response = await apiService.testTarget(type, target);
      if (response.success) {
        setTestResult(response.data);
        toast.success(`Test successful! Returned ${response.data.rowCount} row(s)`);
      } else {
        toast.error(response.error || 'Test failed');
      }
    } catch (error) {
      toast.error(error.response?.data?.message || error.response?.data?.error || 'An error occurred while testing');
      setTestResult({ error: error.response?.data?.message || error.response?.data?.error || 'Test failed' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleReplaceApiKeyClick = () => {
    setReplaceApiKeyModal(true);
  };

  const handleReplaceApiKeyConfirm = async () => {
    setIsReplacingApiKey(true);
    try {
      const response = await apiService.generateAPIKey(id);
      if (response.success && response.data.token) {
        setApiKeyModal({
          isOpen: true,
          apiKey: response.data.token,
          endpointName: endpoint?.data?.name || null
        });
        // Refresh endpoint to update hasToken status
        queryClient.invalidateQueries(['endpoint', id]);
        queryClient.invalidateQueries('endpoints');
        queryClient.invalidateQueries('activity');
      } else {
        toast.error(response.error || 'Failed to replace API key');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'An error occurred while replacing the API key');
    } finally {
      setIsReplacingApiKey(false);
      setReplaceApiKeyModal(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      const response = await apiService.updateEndpoint(id, data);
      if (response.success) {
        // Update tags
        try {
          await apiService.setEndpointTags(id, selectedTags);
        } catch (tagError) {
          console.error('Failed to update tags:', tagError);
          // Don't fail the whole update if tags fail
        }
        
        toast.success('Endpoint updated successfully!');
        navigate('/endpoints');
      } else {
        toast.error(response.error || 'Failed to update endpoint');
      }
    } catch (error) {
      toast.error('An error occurred while updating the endpoint');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center">
        <button
          onClick={() => navigate('/endpoints')}
          className="mr-3 p-1.5 text-snowflake-400 hover:text-snowflake-600"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-snowflake-900">Edit Endpoint</h1>
          <p className="text-xs text-snowflake-600">
            Update endpoint configuration
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-snowflake-200 p-4">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
                Name *
              </label>
              <input
                {...register('name', { required: 'Name is required' })}
                className="input text-sm py-1.5"
                placeholder="Enter endpoint name"
              />
              {errors.name && (
                <p className="mt-0.5 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
                Type *
              </label>
              <select
                {...register('type', { required: 'Type is required' })}
                className="select text-sm py-1.5"
              >
                <option value="">Select type</option>
                <option value="query">SQL Query</option>
                <option value="stored_procedure">Stored Procedure</option>
                <option value="function">Function</option>
                <option value="table">Table</option>
              </select>
              {errors.type && (
                <p className="mt-0.5 text-xs text-red-600">{errors.type.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
              Description
            </label>
            <textarea
              {...register('description')}
              className="textarea text-sm py-1.5"
              rows={2}
              placeholder="Enter endpoint description"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
              Custom Path (Optional)
            </label>
            <input
              type="text"
              {...register('path', {
                pattern: {
                  value: /^[a-zA-Z0-9_-]+$/,
                  message: 'Path must contain only alphanumeric characters, hyphens, and underscores'
                }
              })}
              className="input text-sm py-1.5"
              placeholder="e.g., TB1 (leave empty to use UUID)"
            />
            <p className="mt-0.5 text-xs text-snowflake-500">
              Custom URL path for this endpoint. If set, use this instead of the UUID in the URL.
            </p>
            {errors.path && (
              <p className="mt-0.5 text-xs text-red-600">{errors.path.message}</p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-0.5">
              <label className="block text-xs font-medium text-snowflake-700">
                SQL Command *
              </label>
              <button
                type="button"
                onClick={handleTestTarget}
                disabled={!type || !target || isTesting}
                className="text-xs px-2 py-1 bg-primary-100 text-primary-700 rounded hover:bg-primary-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
              >
                {isTesting ? (
                  <>
                    <Loader className="h-3 w-3 animate-spin" />
                    Testing...
                  </>
                ) : (
                  <>
                    <Play className="h-3 w-3" />
                    Test Target
                  </>
                )}
              </button>
            </div>
            <textarea
              {...register('target', { required: 'SQL Command is required' })}
              className="textarea text-sm py-1.5 font-mono"
              rows={3}
              placeholder="Enter SQL query, procedure name, function name, or table name"
            />
            {errors.target && (
              <p className="mt-0.5 text-xs text-red-600">{errors.target.message}</p>
            )}
          </div>

          {testResult && (
            <div className={`p-2 rounded text-xs ${testResult.error ? 'bg-red-50 border border-red-200 text-red-800' : 'bg-green-50 border border-green-200 text-green-800'}`}>
              {testResult.error ? (
                <div>
                  <strong>Test Failed:</strong> {testResult.error}
                </div>
              ) : (
                <div>
                  <strong>Test Successful!</strong> Returned {testResult.rowCount || 0} row(s) in {testResult.testMetadata?.duration || 'N/A'}
                  {testResult.rows && testResult.rows.length > 0 && (
                    <details className="mt-1">
                      <summary className="cursor-pointer font-medium">View Results ({testResult.rows.length} rows)</summary>
                      <pre className="mt-1 text-xs bg-white p-2 rounded border max-h-40 overflow-auto">
                        {JSON.stringify(testResult.rows.slice(0, 5), null, 2)}
                        {testResult.rows.length > 5 && `\n... and ${testResult.rows.length - 5} more rows`}
                      </pre>
                    </details>
                  )}
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
              Tags
            </label>
            <TagSelector
              tags={tags}
              selectedTagIds={selectedTags}
              onChange={setSelectedTags}
            />
            <p className="mt-1 text-xs text-snowflake-500">
              Select tags to organize this endpoint. Use search to find tags quickly.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
                Method *
              </label>
              <select
                {...register('method', { required: 'Method is required' })}
                className="select text-sm py-1.5"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              {errors.method && (
                <p className="mt-0.5 text-xs text-red-600">{errors.method.message}</p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
                Rate Limit (req/min)
              </label>
              <input
                {...register('rateLimit', { 
                  valueAsNumber: true,
                  min: 1,
                  max: 10000
                })}
                type="number"
                className="input text-sm py-1.5"
                placeholder="100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
                Status *
              </label>
              <select
                {...register('status', { required: 'Status is required' })}
                className="select text-sm py-1.5"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
              {errors.status && (
                <p className="mt-0.5 text-xs text-red-600">{errors.status.message}</p>
              )}
            </div>
          </div>

          {/* Replace API Key Section */}
          <div className="border-t border-snowflake-200 pt-4 mt-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
                  API Key Management
                </label>
                <p className="text-xs text-snowflake-500">
                  Replace the API key for this endpoint. The current key will be revoked.
                </p>
              </div>
              <button
                type="button"
                onClick={handleReplaceApiKeyClick}
                disabled={isReplacingApiKey}
                className="btn btn-secondary btn-sm"
              >
                {isReplacingApiKey ? (
                  <>
                    <Loader className="h-3 w-3 mr-1.5 animate-spin" />
                    Replacing...
                  </>
                ) : (
                  <>
                    <Key className="h-3 w-3 mr-1.5" />
                    Replace API Key
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={() => navigate('/endpoints')}
              className="btn btn-secondary btn-sm"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-sm"
            >
              <Save className="h-3 w-3 mr-1.5" />
              Save Changes
            </button>
          </div>
        </form>
      </div>

      {/* API Key Modal */}
      <APIKeyModal
        isOpen={apiKeyModal.isOpen}
        onClose={() => setApiKeyModal({ isOpen: false, apiKey: null, endpointName: null })}
        apiKey={apiKeyModal.apiKey}
        endpointName={apiKeyModal.endpointName}
      />

      {/* Replace API Key Confirmation Modal */}
      <ConfirmationModal
        isOpen={replaceApiKeyModal}
        onClose={() => setReplaceApiKeyModal(false)}
        onConfirm={handleReplaceApiKeyConfirm}
        title="Replace API Key"
        message="Are you sure you want to replace the API key? The current key will be revoked and cannot be used anymore."
        confirmText="Replace"
        cancelText="Cancel"
        variant="warning"
      />
    </div>
  );
};

export default EditEndpoint;
