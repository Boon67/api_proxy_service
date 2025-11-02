import React, { useState } from 'react';
import { X, Database, CheckCircle, AlertCircle, Loader } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

const SnowflakeConfigModal = ({ isOpen, onClose, connectionStatus }) => {
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  if (!isOpen) return null;

  const testConnection = async () => {
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await apiService.testConnectionStatus();
      const snowflakeStatus = result.services?.snowflake;
      
      if (snowflakeStatus?.status === 'healthy') {
        setTestResult({ success: true, message: snowflakeStatus.message || 'Connection successful!' });
        toast.success('Snowflake connection test passed');
      } else {
        setTestResult({ success: false, message: snowflakeStatus?.message || 'Connection failed' });
        toast.error('Snowflake connection test failed');
      }
    } catch (error) {
      setTestResult({ success: false, message: error.message || 'Connection test failed' });
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        <div className="fixed inset-0 bg-snowflake-500 bg-opacity-75 transition-opacity" onClick={onClose}></div>

        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Database className="h-6 w-6 text-snowflake-400 mr-2" />
                <h3 className="text-lg font-medium text-snowflake-900">Snowflake Configuration</h3>
              </div>
              <button
                onClick={onClose}
                className="text-snowflake-400 hover:text-snowflake-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-snowflake-700 mb-2">
                  Connection Status
                </label>
                <div className="flex items-center">
                  {connectionStatus ? (
                    <>
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                      <span className="text-sm text-green-700">Connected</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                      <span className="text-sm text-red-700">Disconnected</span>
                    </>
                  )}
                </div>
              </div>

              <div className="bg-snowflake-50 rounded-lg p-4">
                <p className="text-sm text-snowflake-600 mb-3">
                  Snowflake connection is configured via environment variables or the configuration file.
                  The service automatically detects whether it's running in Snowflake Container Services (SPCS)
                  or locally and uses the appropriate authentication method.
                </p>
                <div className="text-xs text-snowflake-500 space-y-1">
                  <p><strong>Local:</strong> Uses <code>config/snowflake.json</code> with PAT token</p>
                  <p><strong>SPCS:</strong> Uses OAuth token from <code>/snowflake/session/token</code></p>
                </div>
              </div>

              {testResult && (
                <div className={`rounded-lg p-3 ${
                  testResult.success 
                    ? 'bg-green-50 border border-green-200' 
                    : 'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center">
                    {testResult.success ? (
                      <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                    ) : (
                      <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
                    )}
                    <p className={`text-sm ${
                      testResult.success ? 'text-green-700' : 'text-red-700'
                    }`}>
                      {testResult.message}
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50"
                >
                  Close
                </button>
                <button
                  onClick={testConnection}
                  disabled={testing}
                  className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                >
                  {testing ? (
                    <>
                      <Loader className="h-4 w-4 mr-2 animate-spin" />
                      Testing...
                    </>
                  ) : (
                    'Test Connection'
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

export default SnowflakeConfigModal;

