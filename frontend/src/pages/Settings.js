import React from 'react';
import { Settings as SettingsIcon, Database, Key, Shield } from 'lucide-react';

const Settings = () => {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-snowflake-900">Settings</h1>
        <p className="mt-1 text-sm text-snowflake-600">
          Configure your Snowflake API Proxy Service
        </p>
      </div>

      {/* Settings Sections */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Snowflake Configuration */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <div className="flex items-center mb-4">
            <Database className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">Snowflake Configuration</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            Configure your Snowflake connection settings.
          </p>
          <button className="btn btn-secondary btn-sm">
            Configure Snowflake
          </button>
        </div>

        {/* Security Settings */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <div className="flex items-center mb-4">
            <Shield className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">Security Settings</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            Manage authentication and security settings.
          </p>
          <button className="btn btn-secondary btn-sm">
            Security Settings
          </button>
        </div>

        {/* Token Management */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <div className="flex items-center mb-4">
            <Key className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">Token Management</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            Manage API tokens and access controls.
          </p>
          <button className="btn btn-secondary btn-sm">
            Manage Tokens
          </button>
        </div>

        {/* System Settings */}
        <div className="bg-white rounded-lg border border-snowflake-200 p-6">
          <div className="flex items-center mb-4">
            <SettingsIcon className="h-6 w-6 text-snowflake-400 mr-3" />
            <h3 className="text-lg font-medium text-snowflake-900">System Settings</h3>
          </div>
          <p className="text-sm text-snowflake-600 mb-4">
            Configure system-wide settings and preferences.
          </p>
          <button className="btn btn-secondary btn-sm">
            System Settings
          </button>
        </div>
      </div>

      {/* Configuration Status */}
      <div className="bg-white rounded-lg border border-snowflake-200 p-6">
        <h3 className="text-lg font-medium text-snowflake-900 mb-4">Configuration Status</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-snowflake-600">Snowflake Connection</span>
            <span className="badge badge-success">Connected</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-snowflake-600">Authentication</span>
            <span className="badge badge-success">Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-snowflake-600">API Endpoints</span>
            <span className="badge badge-info">0 Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-snowflake-600">Tokens</span>
            <span className="badge badge-info">0 Generated</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
