import React, { useState } from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { Link } from 'react-router-dom';
import { Key, Copy, RefreshCw, Trash2 } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';

const APIKeys = () => {
  const queryClient = useQueryClient();
  const { data: apiKeys, isLoading, refetch } = useQuery(
    'apiKeys',
    apiService.getAPIKeys,
    { refetchInterval: 30000 }
  );
  const [revokeModal, setRevokeModal] = useState({ isOpen: false, tokenId: null, tokenName: null });
  const [isRevoking, setIsRevoking] = useState(false);
  const [deleteModal, setDeleteModal] = useState({ isOpen: false, tokenId: null, tokenName: null });
  const [isDeleting, setIsDeleting] = useState(false);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('API Key copied to clipboard!');
  };

  const handleRevokeClick = (apiKey) => {
    setRevokeModal({
      isOpen: true,
      tokenId: apiKey.id,
      tokenName: apiKey.metadata?.endpointName || 'Unknown Endpoint'
    });
  };

  const handleRevokeConfirm = async () => {
    setIsRevoking(true);
    try {
      const response = await apiService.revokeAPIKey(revokeModal.tokenId);
      if (response.success) {
        toast.success('API key revoked successfully');
        queryClient.invalidateQueries('apiKeys');
        queryClient.invalidateQueries('endpoints');
        queryClient.invalidateQueries('activity');
        setRevokeModal({ isOpen: false, tokenId: null, tokenName: null });
      } else {
        toast.error(response.error || 'Failed to revoke API key');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'An error occurred while revoking the API key');
    } finally {
      setIsRevoking(false);
    }
  };

  const handleDeleteClick = (apiKey) => {
    setDeleteModal({
      isOpen: true,
      tokenId: apiKey.id,
      tokenName: apiKey.metadata?.endpointName || 'Unknown Endpoint'
    });
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      const response = await apiService.deleteAPIKey(deleteModal.tokenId);
      if (response.success) {
        toast.success('API key permanently deleted');
        queryClient.invalidateQueries('apiKeys');
        queryClient.invalidateQueries('endpoints');
        queryClient.invalidateQueries('activity');
        setDeleteModal({ isOpen: false, tokenId: null, tokenName: null });
      } else {
        toast.error(response.error || 'Failed to delete API key');
      }
    } catch (error) {
      toast.error(error.response?.data?.error || 'An error occurred while deleting the API key');
    } finally {
      setIsDeleting(false);
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">API Keys</h1>
          <p className="mt-1 text-sm text-snowflake-600">
            Manage API keys for endpoint access
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="btn btn-secondary btn-md"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </button>
      </div>

      {/* API Keys Table */}
      {apiKeys?.data?.length === 0 ? (
        <div className="text-center py-12">
          <Key className="mx-auto h-12 w-12 text-snowflake-400" />
          <h3 className="mt-2 text-sm font-medium text-snowflake-900">No API Keys</h3>
          <p className="mt-1 text-sm text-snowflake-500">
            Create an endpoint to generate API keys.
          </p>
        </div>
      ) : (
        <div className="bg-white shadow overflow-hidden sm:rounded-md">
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Endpoint</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Usage</th>
                  <th>Last Used</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
            {apiKeys?.data?.map((apiKey) => (
                  <tr key={apiKey.id}>
                    <td>
                      {apiKey.endpointId ? (
                        <Link
                          to={`/endpoints/${apiKey.endpointId}`}
                          className="text-sm font-medium text-primary-600 hover:text-primary-900 hover:underline"
                        >
                          {apiKey.metadata?.endpointName || 'Unknown Endpoint'}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-snowflake-900">
                          {apiKey.metadata?.endpointName || 'Unknown Endpoint'}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${
                          apiKey.isActive ? 'badge-success' : 'badge-error'
                        }`}>
                          {apiKey.isActive ? 'Active' : 'Inactive'}
                        </span>
                    </td>
                    <td className="text-sm text-snowflake-600">
                      {new Date(apiKey.createdAt).toLocaleString()}
                    </td>
                    <td className="text-sm text-snowflake-600">
                      {apiKey.usageCount || 0} requests
                    </td>
                    <td className="text-sm text-snowflake-600">
                      {apiKey.lastUsed ? new Date(apiKey.lastUsed).toLocaleString() : 'Never'}
                    </td>
                    <td>
                      <div className="flex items-center justify-end space-x-2">
                        {apiKey.isActive && (
                    <button
                      onClick={() => copyToClipboard(apiKey.token)}
                            className="p-2 text-snowflake-600 hover:text-snowflake-900 hover:bg-snowflake-100 rounded-md transition-colors"
                            title="Copy API Key"
                    >
                            <Copy className="h-4 w-4" />
                          </button>
                        )}
                        {apiKey.isActive && (
                          <button
                            onClick={() => handleRevokeClick(apiKey)}
                            disabled={isRevoking}
                            className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Revoke API Key"
                          >
                            <Trash2 className="h-4 w-4" />
                    </button>
                        )}
                        {!apiKey.isActive && (
                          <button
                            onClick={() => handleDeleteClick(apiKey)}
                            disabled={isDeleting}
                            className="p-2 text-red-700 hover:text-red-900 hover:bg-red-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Permanently Delete API Key"
                          >
                            <Trash2 className="h-4 w-4" />
                    </button>
                        )}
                  </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
                </div>
        </div>
      )}

      {/* Revoke Confirmation Modal */}
      <ConfirmationModal
        isOpen={revokeModal.isOpen}
        onClose={() => setRevokeModal({ isOpen: false, tokenId: null, tokenName: null })}
        onConfirm={handleRevokeConfirm}
        title="Revoke API Key"
        message={revokeModal.tokenName ? `Are you sure you want to revoke the API key for "${revokeModal.tokenName}"?\n\nThis action cannot be undone and the key will immediately stop working.` : 'Are you sure you want to revoke this API key?'}
        confirmText="Revoke"
        cancelText="Cancel"
        variant="danger"
        isLoading={isRevoking}
      />

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={() => setDeleteModal({ isOpen: false, tokenId: null, tokenName: null })}
        onConfirm={handleDeleteConfirm}
        title="Permanently Delete API Key"
        message={deleteModal.tokenName ? `Are you sure you want to permanently delete the API key for "${deleteModal.tokenName}"?\n\nThis action cannot be undone and the token will be completely removed from the system.` : 'Are you sure you want to permanently delete this API key?'}
        confirmText="Delete Permanently"
        cancelText="Cancel"
        variant="danger"
        isLoading={isDeleting}
      />
    </div>
  );
};

export default APIKeys;
