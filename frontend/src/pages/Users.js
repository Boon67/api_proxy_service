import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Users as UsersIcon, Plus, Edit2, Trash2, Shield, Mail, Calendar } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';
import ConfirmationModal from '../components/ConfirmationModal';
import { useAuth } from '../contexts/AuthContext';

const UserModal = ({ isOpen, onClose, user, onSave }) => {
  const [formData, setFormData] = useState({
    username: user?.USERNAME || '',
    password: '',
    firstName: user?.FIRST_NAME || '',
    lastName: user?.LAST_NAME || '',
    email: user?.EMAIL || '',
    contactNumber: user?.CONTACT_NUMBER || '',
    role: user?.ROLE || 'user',
    isActive: user?.IS_ACTIVE !== false
  });

  React.useEffect(() => {
    if (user) {
      setFormData({
        username: user.USERNAME || '',
        password: '',
        firstName: user.FIRST_NAME || '',
        lastName: user.LAST_NAME || '',
        email: user.EMAIL || '',
        contactNumber: user.CONTACT_NUMBER || '',
        role: user.ROLE || 'user',
        isActive: user.IS_ACTIVE !== false
      });
    } else {
      setFormData({
        username: '',
        password: '',
        firstName: '',
        lastName: '',
        email: '',
        contactNumber: '',
        role: 'user',
        isActive: true
      });
    }
  }, [user, isOpen]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }

    try {
      const userData = {
        username: formData.username,
        firstName: formData.firstName,
        lastName: formData.lastName,
        email: formData.email,
        contactNumber: formData.contactNumber,
        role: formData.role,
        isActive: formData.isActive
      };

      if (formData.password) {
        userData.password = formData.password;
      }

      await onSave(userData);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to save user');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-xl font-bold text-snowflake-900 mb-4">
            {user ? 'Edit User' : 'Create New User'}
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                Username
              </label>
              <input
                type="text"
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                required
                disabled={!!user}
                className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:bg-snowflake-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                {user ? 'New Password (leave blank to keep current)' : 'Password'}
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                required={!user}
                minLength={6}
                className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-snowflake-700 mb-1">
                  First Name
                </label>
                <input
                  type="text"
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-snowflake-700 mb-1">
                  Last Name
                </label>
                <input
                  type="text"
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                Contact Number
              </label>
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={(e) => setFormData({ ...formData, contactNumber: e.target.value })}
                placeholder="e.g., +1 (555) 123-4567"
                className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                Role
              </label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 border border-snowflake-300 rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="user">User</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            <div className="flex items-center">
              <input
                type="checkbox"
                id="isActive"
                checked={formData.isActive}
                onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-snowflake-300 rounded"
              />
              <label htmlFor="isActive" className="ml-2 block text-sm text-snowflake-700">
                Active
              </label>
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
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700"
              >
                {user ? 'Update' : 'Create'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

const Users = () => {
  const { user: currentUser } = useAuth();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);
  const queryClient = useQueryClient();

  const { data, isLoading, error } = useQuery(
    'users',
    apiService.getUsers,
    {
      enabled: currentUser?.role === 'admin'
    }
  );

  const createMutation = useMutation(apiService.createUser, {
    onSuccess: () => {
      queryClient.invalidateQueries('users');
      toast.success('User created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create user');
    }
  });

  const updateMutation = useMutation(
    ({ id, userData }) => apiService.updateUser(id, userData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('users');
        toast.success('User updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update user');
      }
    }
  );

  const deleteMutation = useMutation(apiService.deleteUser, {
    onSuccess: () => {
      queryClient.invalidateQueries('users');
      toast.success('User deleted successfully');
      setDeleteConfirmOpen(false);
      setUserToDelete(null);
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete user');
    }
  });

  const handleCreate = () => {
    setSelectedUser(null);
    setModalOpen(true);
  };

  const handleEdit = (user) => {
    setSelectedUser(user);
    setModalOpen(true);
  };

  const handleDelete = (user) => {
    setUserToDelete(user);
    setDeleteConfirmOpen(true);
  };

  const handleSave = async (userData) => {
    if (selectedUser) {
      await updateMutation.mutateAsync({ id: selectedUser.USER_ID, userData });
    } else {
      await createMutation.mutateAsync(userData);
    }
  };

  const handleConfirmDelete = () => {
    if (userToDelete) {
      deleteMutation.mutate(userToDelete.USER_ID);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString();
  };

  if (currentUser?.role !== 'admin') {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-lg border border-red-200 p-6">
          <div className="flex items-center">
            <Shield className="h-6 w-6 text-red-500 mr-3" />
            <div>
              <h3 className="text-lg font-medium text-snowflake-900">Access Denied</h3>
              <p className="text-sm text-snowflake-600 mt-1">
                You must be an administrator to access user management.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const users = data?.data || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">User Management</h1>
          <p className="mt-1 text-sm text-snowflake-600">
            Manage application users and their permissions
          </p>
        </div>
        <button
          onClick={handleCreate}
          className="btn btn-primary"
        >
          <Plus className="h-4 w-4 mr-2" />
          Create User
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-snowflake-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          </div>
        ) : error ? (
          <div className="p-6 text-center text-red-600">
            Failed to load users. Please try again.
          </div>
        ) : users.length === 0 ? (
          <div className="p-12 text-center">
            <UsersIcon className="mx-auto h-12 w-12 text-snowflake-400" />
            <h3 className="mt-4 text-sm font-medium text-snowflake-900">No users</h3>
            <p className="mt-2 text-sm text-snowflake-500">
              Get started by creating a new user.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-snowflake-200">
              <thead className="bg-snowflake-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Last Login
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-snowflake-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-snowflake-200">
                {users.map((user) => (
                  <tr key={user.USER_ID} className="hover:bg-snowflake-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-snowflake-900">
                        {user.USERNAME}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-snowflake-900">
                        {user.FIRST_NAME || user.LAST_NAME ? (
                          `${user.FIRST_NAME || ''} ${user.LAST_NAME || ''}`.trim()
                        ) : (
                          <span className="text-snowflake-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center text-sm text-snowflake-600">
                        {user.EMAIL ? (
                          <>
                            <Mail className="h-4 w-4 mr-2" />
                            {user.EMAIL}
                          </>
                        ) : (
                          <span className="text-snowflake-400">-</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-snowflake-600">
                        {user.CONTACT_NUMBER || <span className="text-snowflake-400">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.ROLE === 'admin' 
                          ? 'bg-purple-100 text-purple-800' 
                          : 'bg-blue-100 text-blue-800'
                      }`}>
                        {user.ROLE}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        user.IS_ACTIVE 
                          ? 'bg-green-100 text-green-800' 
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {user.IS_ACTIVE ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-snowflake-600">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDate(user.LAST_LOGIN)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-snowflake-600">
                      {formatDate(user.CREATED_AT)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end space-x-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-primary-600 hover:text-primary-900"
                          title="Edit user"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {user.USER_ID !== currentUser?.userId && (
                          <button
                            onClick={() => handleDelete(user)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete user"
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
        )}
      </div>

      {/* Modals */}
      <UserModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setSelectedUser(null);
        }}
        user={selectedUser}
        onSave={handleSave}
      />

      <ConfirmationModal
        isOpen={deleteConfirmOpen}
        onClose={() => {
          setDeleteConfirmOpen(false);
          setUserToDelete(null);
        }}
        onConfirm={handleConfirmDelete}
        title="Delete User"
        message={`Are you sure you want to delete user "${userToDelete?.USERNAME}"? This action cannot be undone.`}
        confirmText="Delete"
        confirmClass="bg-red-600 hover:bg-red-700"
      />
    </div>
  );
};

export default Users;
