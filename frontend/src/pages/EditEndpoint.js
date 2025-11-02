import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useQuery } from 'react-query';
import { Save, ArrowLeft } from 'lucide-react';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

const EditEndpoint = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, formState: { errors }, reset } = useForm();

  const { data: endpoint, isLoading } = useQuery(
    ['endpoint', id],
    () => apiService.getEndpoint(id),
    { 
      enabled: !!id,
      onSuccess: (data) => {
        if (data?.data) {
          reset(data.data);
        }
      }
    }
  );

  const onSubmit = async (data) => {
    try {
      const response = await apiService.updateEndpoint(id, data);
      if (response.success) {
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center">
        <button
          onClick={() => navigate('/endpoints')}
          className="mr-4 p-2 text-snowflake-400 hover:text-snowflake-600"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-snowflake-900">Edit Endpoint</h1>
          <p className="mt-1 text-sm text-snowflake-600">
            Update endpoint configuration
          </p>
        </div>
      </div>

      {/* Form */}
      <div className="bg-white rounded-lg border border-snowflake-200 p-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-snowflake-700">
                Name *
              </label>
              <input
                {...register('name', { required: 'Name is required' })}
                className="input mt-1"
                placeholder="Enter endpoint name"
              />
              {errors.name && (
                <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700">
                Type *
              </label>
              <select
                {...register('type', { required: 'Type is required' })}
                className="select mt-1"
              >
                <option value="">Select type</option>
                <option value="query">SQL Query</option>
                <option value="stored_procedure">Stored Procedure</option>
                <option value="function">Function</option>
                <option value="table">Table</option>
              </select>
              {errors.type && (
                <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-snowflake-700">
              Description
            </label>
            <textarea
              {...register('description')}
              className="textarea mt-1"
              rows={3}
              placeholder="Enter endpoint description"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-snowflake-700">
              Target *
            </label>
            <textarea
              {...register('target', { required: 'Target is required' })}
              className="textarea mt-1"
              rows={4}
              placeholder="Enter SQL query, procedure name, function name, or table name"
            />
            {errors.target && (
              <p className="mt-1 text-sm text-red-600">{errors.target.message}</p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-snowflake-700">
                Method *
              </label>
              <select
                {...register('method', { required: 'Method is required' })}
                className="select mt-1"
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
              </select>
              {errors.method && (
                <p className="mt-1 text-sm text-red-600">{errors.method.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-snowflake-700">
                Rate Limit (requests/minute)
              </label>
              <input
                {...register('rateLimit', { 
                  valueAsNumber: true,
                  min: 1,
                  max: 10000
                })}
                type="number"
                className="input mt-1"
                placeholder="100"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={() => navigate('/endpoints')}
              className="btn btn-secondary btn-md"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary btn-md"
            >
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditEndpoint;
