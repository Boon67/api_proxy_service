import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useNavigate } from 'react-router-dom';
import { Settings as SettingsIcon, Database, Key, Shield, X, CheckCircle, AlertCircle } from 'lucide-react';
import { apiService } from '../services/api';
import SnowflakeConfigModal from '../components/SnowflakeConfigModal';
import SecuritySettingsModal from '../components/SecuritySettingsModal';
import SystemSettingsModal from '../components/SystemSettingsModal';

const Settings = () => {
  const navigate = useNavigate();
  const [snowflakeModalOpen, setSnowflakeModalOpen] = useState(false);
  const [securityModalOpen, setSecurityModalOpen] = useState(false);
  const [systemModalOpen, setSystemModalOpen] = useState(false);

  // Fetch real-time status data
  const { data: health, isLoading: healthLoading } = useQuery(
    'health',
    apiService.getHealth,
    { refetchInterval: 10000 }
  );

  const { data: stats, isLoading: statsLoading } = useQuery(
    'stats',
    apiService.getStats,
    { refetchInterval: 30000 }
  );

  const { data: endpoints, isLoading: endpointsLoading } = useQuery(
    'endpoints',
    apiService.getEndpoints,
    { refetchInterval: 30000 }
  );

  const { data: tokens, isLoading: tokensLoading } = useQuery(
    'tokens',
    apiService.getTokens,
    { refetchInterval: 30000 }
  );

  // Determine connection status
  const isConnected = health?.status === 'healthy';
  const activeEndpoints = endpoints?.data?.filter(ep => ep.isActive)?.length || 0;
  const totalEndpoints = endpoints?.data?.length || 0;
  const activeTokens = tokens?.data?.filter(t => t.isActive)?.length || 0;
  const totalTokens = tokens?.data?.length || 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-snowflake-900">Settings</h1>
        <p className="mt-1 text-sm text-snowflake-600">
          Configure your Snowflake API Proxy Service
        </p>
      </div>

      {/* Configuration Options */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Snowflake Configuration */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <Database className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">Snowflake Configuration</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            View your Snowflake connection settings and test the connection.
          </p>
          <button 
            onClick={() => setSnowflakeModalOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            Configure Snowflake
          </button>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <Shield className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">Security Settings</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            Manage authentication and security settings.
          </p>
          <button 
            onClick={() => setSecurityModalOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            Security Settings
          </button>
        </div>

        {/* Token Management */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <Key className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">Token Management</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            Manage API tokens and access controls.
          </p>
          <button 
            onClick={() => navigate('/tokens')}
            className="btn btn-secondary btn-sm"
          >
            Manage Tokens
          </button>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6 hover:shadow-md transition-shadow">
          <div className="flex items-center mb-4">
            <SettingsIcon className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">System Settings</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            Configure system-wide settings and preferences.
          </p>
          <button 
            onClick={() => setSystemModalOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            System Settings
          </button>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="bg-white rounded-lg border border-snowflake-200 p-6">
        <h3 className="text-lg font-medium text-snowflake-900 mb-4">Configuration Status</h3>
        {healthLoading || statsLoading || endpointsLoading || tokensLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-snowflake-600">Snowflake Connection</span>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                isConnected 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-red-100 text-red-800'
              }`}>
                {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-snowflake-600">Authentication</span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-snowflake-600">API Endpoints</span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                {activeEndpoints} Active{totalEndpoints > 0 ? ` of ${totalEndpoints}` : ''}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-snowflake-600">Tokens</span>
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                {activeTokens} Active{totalTokens > 0 ? ` of ${totalTokens}` : ''}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      <SnowflakeConfigModal 
        isOpen={snowflakeModalOpen}
        onClose={() => setSnowflakeModalOpen(false)}
        connectionStatus={isConnected}
      />
      
      <SecuritySettingsModal 
        isOpen={securityModalOpen}
        onClose={() => setSecurityModalOpen(false)}
      />
      
      <SystemSettingsModal 
        isOpen={systemModalOpen}
        onClose={() => setSystemModalOpen(false)}
      />
    </div>
  );
};

export default Settings;
