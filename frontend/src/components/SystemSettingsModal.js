import React, { useState, useEffect } from 'react';
import { useQuery } from 'react-query';
import { X, Settings as SettingsIcon, CheckCircle } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

const SystemSettingsModal = ({ isOpen, onClose }) => {
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    logLevel: 'info',
    rateLimitDefault: 100,
    enableAuditLog: true,
    sessionTimeout: 3600,
  });

  // Load settings when modal opens
  const { data: settingsData, isLoading, refetch } = useQuery(
    'systemSettings',
    apiService.getSystemSettings,
    { 
      enabled: isOpen,
      refetchOnWindowFocus: false,
      onSuccess: (data) => {
        if (data?.data) {
          setSettings(data.data);
        }
      }
    }
  );

  useEffect(() => {
    if (isOpen && settingsData?.data) {
      setSettings(settingsData.data);
    }
  }, [isOpen, settingsData]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      await apiService.updateSystemSettings(settings);
      toast.success('System settings updated successfully');
      refetch(); // Refresh settings
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to update settings');
    } finally {
      setSaving(false);
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
                <SettingsIcon className="h-6 w-6 text-snowflake-400 mr-2" />
                <h3 className="text-lg font-medium text-snowflake-900">System Settings</h3>
              </div>
              <button
                onClick={onClose}
                className="text-snowflake-400 hover:text-snowflake-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-snowflake-700 mb-1">
                    Log Level
                  </label>
                  <select
                    value={settings.logLevel || 'info'}
                    onChange={(e) => setSettings({...settings, logLevel: e.target.value})}
                    className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="error">Error</option>
                    <option value="warn">Warning</option>
                    <option value="info">Info</option>
                    <option value="debug">Debug</option>
                  </select>
                  <p className="text-xs text-snowflake-500 mt-1">
                    Controls the verbosity of application logs
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-snowflake-700 mb-1">
                    Default Rate Limit (requests per minute)
                  </label>
                  <input
                    type="number"
                    value={settings.rateLimitDefault || 100}
                    onChange={(e) => setSettings({...settings, rateLimitDefault: parseInt(e.target.value) || 100})}
                    className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="1"
                    max="10000"
                  />
                  <p className="text-xs text-snowflake-500 mt-1">
                    Applied to new endpoints (can be customized per endpoint)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-snowflake-700 mb-1">
                    Session Timeout (seconds)
                  </label>
                  <input
                    type="number"
                    value={settings.sessionTimeout || 3600}
                    onChange={(e) => setSettings({...settings, sessionTimeout: parseInt(e.target.value) || 3600})}
                    className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                    min="300"
                    max="86400"
                  />
                  <p className="text-xs text-snowflake-500 mt-1">
                    JWT token expiration time (300 seconds = 5 min, 3600 = 1 hour, 86400 = 24 hours)
                  </p>
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="enableAuditLog"
                    checked={settings.enableAuditLog !== false}
                    onChange={(e) => setSettings({...settings, enableAuditLog: e.target.checked})}
                    className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-snowflake-300 rounded"
                  />
                  <label htmlFor="enableAuditLog" className="ml-2 block text-sm text-snowflake-700">
                    Enable Audit Logging
                  </label>
                </div>
                <p className="text-xs text-snowflake-500 -mt-2 ml-6">
                  Logs all API requests to API_AUDIT_LOG table
                </p>

                <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-start">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-2 mt-0.5" />
                  <p className="text-xs text-green-700">
                    <strong>Settings are saved to the database</strong> and take effect immediately.
                    Log level changes apply to new log entries.
                  </p>
                </div>

                <div className="flex justify-end space-x-3 pt-4">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving || isLoading}
                    className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemSettingsModal;

