import React, { useState } from 'react';
import { X, Play, Loader, CheckCircle, AlertCircle, Copy } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
// Use a simple JSON display if react-json-pretty is not available
const JsonDisplay = ({ data }) => {
  if (!data || data.length === 0) return <p className="text-sm text-snowflake-500">No data</p>;
  
  return (
    <div className="bg-snowflake-900 rounded p-3 overflow-auto max-h-96">
      <pre className="text-xs text-green-400 font-mono">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
};

const TestEndpointModal = ({ isOpen, onClose, endpoint }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [parameters, setParameters] = useState({});
  const [limit, setLimit] = useState(10);
  const [offset, setOffset] = useState(0);

  if (!isOpen || !endpoint) return null;

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const options = {
        allowInactive: !endpoint.isActive, // Allow testing inactive endpoints
      };

      if (endpoint.type === 'table') {
        options.limit = limit;
        options.offset = offset;
      }

      const result = await apiService.testEndpoint(
        endpoint.id,
        Object.entries(parameters).map(([key, value]) => ({ name: key, value })),
        options
      );

      if (result.success) {
        setTestResult(result.data);
        toast.success('Endpoint test completed successfully');
      } else {
        setTestResult({ error: result.error || result.message || 'Test failed' });
        toast.error(result.error || 'Test failed');
      }
    } catch (error) {
      setTestResult({ error: error.message || 'Test execution failed' });
      toast.error(error.message || 'Test execution failed');
    } finally {
      setTesting(false);
    }
  };

  const handleParameterChange = (paramName, value) => {
    setParameters({ ...parameters, [paramName]: value });
  };

  const copyResults = () => {
    if (testResult && testResult.rows) {
      navigator.clipboard.writeText(JSON.stringify(testResult.rows, null, 2));
      toast.success('Results copied to clipboard');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-snowflake-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Play className="h-6 w-6 text-snowflake-400 mr-2" />
                <h3 className="text-lg font-medium text-snowflake-900">
                  Test Endpoint: {endpoint.name}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-snowflake-400 hover:text-snowflake-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Endpoint Info */}
              <div className="bg-snowflake-50 rounded-lg p-3">
                <div className="text-sm">
                  <p><strong>Type:</strong> {endpoint.type}</p>
                  <p><strong>Target:</strong> <code className="text-xs">{endpoint.target}</code></p>
                  {!endpoint.isActive && (
                    <p className="text-orange-600 mt-1">
                      <AlertCircle className="h-4 w-4 inline mr-1" />
                      Endpoint is inactive - testing will still proceed
                    </p>
                  )}
                </div>
              </div>

              {/* Parameters */}
              {endpoint.parameters && endpoint.parameters.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-snowflake-700 mb-2">Parameters</h4>
                  <div className="space-y-2">
                    {endpoint.parameters.map((param, index) => (
                      <div key={index}>
                        <label className="block text-sm text-snowflake-600 mb-1">
                          {param.name}
                          {param.required && <span className="text-red-500 ml-1">*</span>}
                          <span className="text-snowflake-400 ml-2">({param.type})</span>
                        </label>
                        <input
                          type="text"
                          value={parameters[param.name] || ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          placeholder={param.description || `Enter ${param.name}`}
                          className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                          required={param.required}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Table-specific options */}
              {endpoint.type === 'table' && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-snowflake-700 mb-1">
                      Limit (rows)
                    </label>
                    <input
                      type="number"
                      value={limit}
                      onChange={(e) => setLimit(parseInt(e.target.value) || 10)}
                      min="1"
                      max="1000"
                      className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-snowflake-700 mb-1">
                      Offset
                    </label>
                    <input
                      type="number"
                      value={offset}
                      onChange={(e) => setOffset(parseInt(e.target.value) || 0)}
                      min="0"
                      className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>
              )}

              {/* Test Results */}
              {testResult && (
                <div className="border-t border-snowflake-200 pt-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="text-sm font-medium text-snowflake-700">Test Results</h4>
                    {testResult.rows && (
                      <button
                        onClick={copyResults}
                        className="text-xs text-primary-600 hover:text-primary-700 flex items-center"
                      >
                        <Copy className="h-3 w-3 mr-1" />
                        Copy JSON
                      </button>
                    )}
                  </div>

                  {testResult.error ? (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex items-center">
                        <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                        <p className="text-sm text-red-700">{testResult.error}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex items-center">
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                          <p className="text-sm text-green-700">
                            Test completed successfully
                            {testResult.testMetadata && (
                              <span className="ml-2">
                                ({testResult.testMetadata.duration})
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      {testResult.testMetadata && (
                        <div className="bg-snowflake-50 rounded-lg p-3 text-xs text-snowflake-600">
                          <p><strong>Rows returned:</strong> {testResult.rowCount || testResult.rows?.length || 0}</p>
                          <p><strong>Duration:</strong> {testResult.testMetadata.duration}</p>
                          {testResult.testMetadata.parameters && testResult.testMetadata.parameters.length > 0 && (
                            <p><strong>Parameters:</strong> {JSON.stringify(testResult.testMetadata.parameters)}</p>
                          )}
                        </div>
                      )}

                      {testResult.rows && testResult.rows.length > 0 ? (
                        <div className="border border-snowflake-200 rounded-lg overflow-hidden">
                          <div className="bg-snowflake-50 px-3 py-2 border-b border-snowflake-200">
                            <p className="text-xs font-medium text-snowflake-700">
                              Data ({testResult.rows.length} {testResult.rows.length === 1 ? 'row' : 'rows'})
                            </p>
                          </div>
                          <div className="overflow-auto max-h-96">
                            <JsonDisplay data={testResult.rows} />
                          </div>
                        </div>
                      ) : (
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                          <p className="text-sm text-yellow-700">
                            No rows returned
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-snowflake-200">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50"
                >
                  Close
                </button>
                <button
                  onClick={handleTest}
                  disabled={testing}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {testing ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 mr-2" />
                      Test Endpoint
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TestEndpointModal;

