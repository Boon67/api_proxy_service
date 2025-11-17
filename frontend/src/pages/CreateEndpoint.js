import React from 'react';
import { useForm, watch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { Plus, ArrowLeft, Copy, Check, X, Play, Loader } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import TagSelector from '../components/TagSelector';
import APIKeyModal from '../components/APIKeyModal';

const CreateEndpoint = () => {
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, watch } = useForm();
  const type = watch('type');
  const target = watch('target');

  const [createdEndpoint, setCreatedEndpoint] = React.useState(null);
  const [showUrlModal, setShowUrlModal] = React.useState(false);
  const [apiKeyModal, setApiKeyModal] = React.useState({ isOpen: false, apiKey: null, endpointName: null });
  const [isTesting, setIsTesting] = React.useState(false);
  const [testResult, setTestResult] = React.useState(null);
  const [selectedTags, setSelectedTags] = React.useState([]);
  const [generateApiKey, setGenerateApiKey] = React.useState(false);

  const { data: tagsResponse } = useQuery('tags', apiService.getTags);
  const tags = tagsResponse?.data || [];

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

  const onSubmit = async (data) => {
    try {
      // Include generateApiKey flag in the request
      const requestData = {
        ...data,
        generateApiKey: generateApiKey
      };
      
      const response = await apiService.createEndpoint(requestData);
      if (response.success) {
        const endpointId = response.data.id;
        
        // Set tags if any are selected
        if (selectedTags.length > 0) {
          try {
            await apiService.setEndpointTags(endpointId, selectedTags);
          } catch (tagError) {
            console.error('Failed to set tags:', tagError);
            // Don't fail the whole creation if tags fail
          }
        }
        
        setCreatedEndpoint(response.data);
        
        // Show API key modal if token was generated
        if (response.data.token) {
          setApiKeyModal({
            isOpen: true,
            apiKey: response.data.token,
            endpointName: response.data.name
          });
        } else {
          // Otherwise show the URL modal
          setShowUrlModal(true);
        }
        
        toast.success('Endpoint created successfully!');
      } else {
        // Show error message if available, otherwise show error field
        const errorMessage = response.message || response.error || 'Failed to create endpoint';
        toast.error(errorMessage);
      }
    } catch (error) {
      // Show error message from response if available
      const errorMessage = error.response?.data?.message || 
                          error.response?.data?.error || 
                          error.message || 
                          'An error occurred while creating the endpoint';
      toast.error(errorMessage);
    }
  };

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
          <h1 className="text-xl font-bold text-snowflake-900">Create Endpoint</h1>
          <p className="text-xs text-snowflake-600">
            Create a new API endpoint for Snowflake access
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
                defaultValue={100}
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-snowflake-700 mb-0.5">
                Status *
              </label>
              <select
                {...register('status', { required: 'Status is required' })}
                className="select text-sm py-1.5"
                defaultValue="draft"
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

          {/* Generate API Key Option */}
          <div className="flex items-start">
            <div className="flex items-center h-5">
              <input
                id="generateApiKey"
                type="checkbox"
                checked={generateApiKey}
                onChange={(e) => setGenerateApiKey(e.target.checked)}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-snowflake-300 rounded"
              />
            </div>
            <div className="ml-3 text-sm">
              <label htmlFor="generateApiKey" className="font-medium text-snowflake-700">
                Generate API Key
              </label>
              <p className="text-xs text-snowflake-500">
                Create an API key for this endpoint. The key will be shown only once after creation.
              </p>
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
              <Plus className="h-3 w-3 mr-1.5" />
              Create Endpoint
            </button>
          </div>
        </form>
      </div>

      {/* Endpoint URL Modal */}
      {showUrlModal && createdEndpoint && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 bg-snowflake-500 bg-opacity-75 transition-opacity" onClick={() => { setShowUrlModal(false); navigate('/endpoints'); }}></div>

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-medium text-snowflake-900">
                    Endpoint Created Successfully!
                  </h3>
                  <button
                    onClick={() => { setShowUrlModal(false); navigate('/endpoints'); }}
                    className="text-snowflake-400 hover:text-snowflake-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm text-green-800">
                      <strong>{createdEndpoint.name}</strong> has been created successfully.
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-snowflake-700 mb-1">
                      Endpoint URL
                    </label>
                    <div className="flex items-center space-x-2">
                      <input
                        type="text"
                        readOnly
                        value={createdEndpoint.url || ''}
                        className="flex-1 px-3 py-2 border border-snowflake-300 rounded-md bg-snowflake-50 text-sm font-mono"
                      />
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(createdEndpoint.url);
                          toast.success('URL copied to clipboard!');
                        }}
                        className="px-3 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50 flex items-center"
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copy
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-snowflake-500">
                      Use this URL with an API Key (Authorization header or ?token= query parameter)
                    </p>
                  </div>

                  <div className="flex justify-end space-x-3 pt-4">
                    <button
                      onClick={() => { setShowUrlModal(false); navigate(`/endpoints/${createdEndpoint.id}`); }}
                      className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
                    >
                      View Endpoint
                    </button>
                    <button
                      onClick={() => { setShowUrlModal(false); navigate('/endpoints'); }}
                      className="px-4 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50"
                    >
                      Close
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* API Key Modal */}
      <APIKeyModal
        isOpen={apiKeyModal.isOpen}
        onClose={() => {
          setApiKeyModal({ isOpen: false, apiKey: null, endpointName: null });
          // After closing API key modal, show URL modal or navigate
          if (createdEndpoint) {
            setShowUrlModal(true);
          } else {
            navigate('/endpoints');
          }
        }}
        apiKey={apiKeyModal.apiKey}
        endpointName={apiKeyModal.endpointName}
      />
    </div>
  );
};

export default CreateEndpoint;
