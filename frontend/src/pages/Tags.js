import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Plus, Edit, Trash2, Save, X, Tag } from 'lucide-react';
import { apiService } from '../services/api';
import ConfirmationModal from '../components/ConfirmationModal';
import toast from 'react-hot-toast';

const Tags = () => {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newTag, setNewTag] = useState({ name: '', color: '#3B82F6', description: '' });
  const [editTag, setEditTag] = useState({ name: '', color: '#3B82F6', description: '' });

  const { data: tagsResponse, isLoading } = useQuery('tags', apiService.getTags);
  const tags = tagsResponse?.data || [];

  const createMutation = useMutation(apiService.createTag, {
    onSuccess: () => {
      queryClient.invalidateQueries('tags');
      setIsCreating(false);
      setNewTag({ name: '', color: '#3B82F6', description: '' });
      toast.success('Tag created successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to create tag');
    }
  });

  const updateMutation = useMutation(
    ({ id, data }) => apiService.updateTag(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('tags');
        setEditingId(null);
        setEditTag({ name: '', color: '#3B82F6', description: '' });
        toast.success('Tag updated successfully');
      },
      onError: (error) => {
        toast.error(error.response?.data?.error || 'Failed to update tag');
      }
    }
  );

  const deleteMutation = useMutation(apiService.deleteTag, {
    onSuccess: () => {
      queryClient.invalidateQueries('tags');
      toast.success('Tag deleted successfully');
    },
    onError: (error) => {
      toast.error(error.response?.data?.error || 'Failed to delete tag');
    }
  });

  const handleCreate = () => {
    if (!newTag.name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    createMutation.mutate(newTag);
  };

  const handleEdit = (tag) => {
    setEditingId(tag.id);
    setEditTag({ name: tag.name, color: tag.color || '#3B82F6', description: tag.description || '' });
  };

  const handleUpdate = () => {
    if (!editTag.name.trim()) {
      toast.error('Tag name is required');
      return;
    }
    updateMutation.mutate({ id: editingId, data: editTag });
  };

  const [deleteConfirmModal, setDeleteConfirmModal] = React.useState({ isOpen: false, tag: null });

  const handleDeleteClick = (tag) => {
    setDeleteConfirmModal({ isOpen: true, tag });
  };

  const handleDeleteConfirm = () => {
    if (deleteConfirmModal.tag) {
      deleteMutation.mutate(deleteConfirmModal.tag.id);
      setDeleteConfirmModal({ isOpen: false, tag: null });
    }
  };

  const presetColors = [
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#8B5CF6', // Purple
    '#EC4899', // Pink
    '#06B6D4', // Cyan
    '#84CC16', // Lime
  ];

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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">Tags</h1>
          <p className="mt-1 text-sm text-snowflake-600">
            Manage tags for organizing endpoints and tokens
          </p>
        </div>
        {!isCreating && (
          <button
            onClick={() => setIsCreating(true)}
            className="btn btn-primary btn-md"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Tag
          </button>
        )}
      </div>

      {/* Create Form */}
      {isCreating && (
        <div className="bg-white rounded-lg border border-snowflake-200 p-4">
          <h2 className="text-lg font-semibold text-snowflake-900 mb-4">Create New Tag</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                Tag Name *
              </label>
              <input
                type="text"
                value={newTag.name}
                onChange={(e) => setNewTag({ ...newTag, name: e.target.value })}
                className="input"
                placeholder="Enter tag name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={newTag.color}
                  onChange={(e) => setNewTag({ ...newTag, color: e.target.value })}
                  className="h-10 w-20 border border-snowflake-300 rounded cursor-pointer"
                />
                <div className="flex space-x-2">
                  {presetColors.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setNewTag({ ...newTag, color })}
                      className="w-8 h-8 rounded border-2 border-snowflake-300 hover:border-snowflake-500"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700 mb-1">
                Description
              </label>
              <textarea
                value={newTag.description}
                onChange={(e) => setNewTag({ ...newTag, description: e.target.value })}
                className="textarea"
                rows={2}
                placeholder="Enter tag description (optional)"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewTag({ name: '', color: '#3B82F6', description: '' });
                }}
                className="btn btn-secondary btn-md"
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={createMutation.isLoading}
                className="btn btn-primary btn-md"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Tag
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tags Table */}
      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        {tags.length === 0 ? (
          <div className="p-12 text-center text-snowflake-500">
            <Tag className="h-12 w-12 mx-auto mb-3 text-snowflake-300" />
            <p>No tags created yet. Create your first tag to get started.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Color</th>
                  <th>Description</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
            {tags.map((tag) => (
                  <tr key={tag.id}>
                {editingId === tag.id ? (
                      <>
                        <td colSpan="4" className="p-4">
                          <div className="space-y-4 bg-snowflake-50 p-4 rounded-lg border border-snowflake-200">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-snowflake-700 mb-1">
                        Tag Name *
                      </label>
                      <input
                        type="text"
                        value={editTag.name}
                        onChange={(e) => setEditTag({ ...editTag, name: e.target.value })}
                        className="input"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-snowflake-700 mb-1">
                        Color
                      </label>
                      <div className="flex items-center space-x-3">
                        <input
                          type="color"
                          value={editTag.color}
                          onChange={(e) => setEditTag({ ...editTag, color: e.target.value })}
                          className="h-10 w-20 border border-snowflake-300 rounded cursor-pointer"
                        />
                        <div className="flex space-x-2">
                          {presetColors.map((color) => (
                            <button
                              key={color}
                              type="button"
                              onClick={() => setEditTag({ ...editTag, color })}
                              className="w-8 h-8 rounded border-2 border-snowflake-300 hover:border-snowflake-500"
                              style={{ backgroundColor: color }}
                              title={color}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-snowflake-700 mb-1">
                        Description
                      </label>
                      <textarea
                        value={editTag.description}
                        onChange={(e) => setEditTag({ ...editTag, description: e.target.value })}
                        className="textarea"
                        rows={2}
                      />
                              </div>
                    </div>

                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => {
                          setEditingId(null);
                          setEditTag({ name: '', color: '#3B82F6', description: '' });
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <X className="h-3 w-3 mr-1" />
                        Cancel
                      </button>
                      <button
                        onClick={handleUpdate}
                        disabled={updateMutation.isLoading}
                        className="btn btn-primary btn-sm"
                      >
                        <Save className="h-3 w-3 mr-1" />
                        Save
                      </button>
                    </div>
                  </div>
                        </td>
                      </>
                ) : (
                      <>
                        <td>
                          <div className="flex items-center">
                            <Tag className="h-4 w-4 text-snowflake-400 mr-2" />
                            <span className="font-medium text-snowflake-900">{tag.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center space-x-2">
                      <div
                              className="w-6 h-6 rounded border border-snowflake-300"
                        style={{ backgroundColor: tag.color || '#3B82F6' }}
                              title={tag.color || '#3B82F6'}
                      />
                          <span
                              className="px-2 py-0.5 rounded text-xs font-medium text-white"
                            style={{
                              backgroundColor: tag.color || '#3B82F6',
                              opacity: 0.9
                            }}
                          >
                              {tag.color || '#3B82F6'}
                          </span>
                        </div>
                        </td>
                        <td className="text-sm text-snowflake-600 max-w-md">
                          <div className="truncate" title={tag.description || 'No description'}>
                            {tag.description || 'No description'}
                      </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-end space-x-1">
                      <button
                        onClick={() => handleEdit(tag)}
                              className="p-2 rounded bg-snowflake-100 text-snowflake-600 hover:bg-snowflake-200 transition-colors"
                        title="Edit tag"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(tag)}
                        disabled={deleteMutation.isLoading}
                              className="p-2 rounded bg-red-100 text-red-600 hover:bg-red-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        title="Delete tag"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                        </td>
                      </>
                )}
                  </tr>
            ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteConfirmModal.isOpen}
        onClose={() => setDeleteConfirmModal({ isOpen: false, tag: null })}
        onConfirm={handleDeleteConfirm}
        title="Delete Tag"
        message={deleteConfirmModal.tag ? `Are you sure you want to delete the tag "${deleteConfirmModal.tag.name}"? This will remove it from all endpoints and tokens.` : ''}
        confirmText="Delete"
        cancelText="Cancel"
        variant="danger"
      />
    </div>
  );
};

export default Tags;

