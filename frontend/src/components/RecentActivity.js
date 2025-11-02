import React from 'react';
import { useQuery } from 'react-query';
import { Clock, Server, Key, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { apiService } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

const RecentActivity = () => {
  const { data, isLoading, error } = useQuery(
    'activity',
    () => apiService.getActivity(10),
    { refetchInterval: 30000 } // Refresh every 30 seconds
  );

  const activities = data?.data || [];

  const getActivityMessage = (activity) => {
    const entityName = activity.entityName || 'Unknown';
    switch (activity.type) {
            case 'endpoint_created':
              return `New endpoint "${entityName}" created`;
            case 'endpoint_enabled':
              return `Endpoint "${entityName}" enabled`;
            case 'endpoint_disabled':
              return `Endpoint "${entityName}" disabled`;
            case 'endpoint_draft':
              return `Endpoint "${entityName}" set to draft`;
            case 'endpoint_suspended':
              return `Endpoint "${entityName}" suspended`;
      case 'endpoint_updated':
        return `Endpoint "${entityName}" updated`;
      case 'token_generated':
        return `API Key generated for "${entityName}" endpoint`;
      case 'token_used':
        return `API Key used for "${entityName}" endpoint`;
      case 'token_revoked':
        return `API Key revoked for "${entityName}" endpoint`;
      case 'token_deleted':
      case 'api_key_deleted':
        return `API Key deleted for "${entityName}" endpoint`;
      case 'endpoint_deleted':
        return `Endpoint "${entityName}" deleted`;
      default:
        return `Activity on "${entityName}"`;
    }
  };

  const getActivityIcon = (type) => {
    switch (type) {
      case 'endpoint_created':
      case 'endpoint_updated':
        return Server;
            case 'endpoint_enabled':
              return CheckCircle;
            case 'endpoint_disabled':
            case 'endpoint_suspended':
              return XCircle;
            case 'endpoint_draft':
              return Clock;
      case 'token_generated':
      case 'token_used':
      case 'token_revoked':
      case 'token_deleted':
      case 'api_key_deleted':
        return Key;
      case 'endpoint_deleted':
        return Server;
      case 'error':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const getActivityColor = (type) => {
    const colorClasses = {
      endpoint_created: 'text-green-500',
      endpoint_enabled: 'text-green-500',
            endpoint_disabled: 'text-gray-500',
            endpoint_suspended: 'text-orange-500',
            endpoint_draft: 'text-yellow-500',
      endpoint_deleted: 'text-red-500',
      token_generated: 'text-blue-500',
      token_used: 'text-blue-500',
      token_revoked: 'text-gray-500',
      token_deleted: 'text-red-500',
      api_key_deleted: 'text-red-500',
      error: 'text-red-500',
    };
    return colorClasses[type] || 'text-gray-500';
  };

  const getActivityBgColor = (type) => {
    const bgClasses = {
      endpoint_created: 'bg-green-100',
      endpoint_enabled: 'bg-green-100',
            endpoint_disabled: 'bg-gray-100',
            endpoint_suspended: 'bg-orange-100',
            endpoint_draft: 'bg-yellow-100',
      token_generated: 'bg-blue-100',
      token_used: 'bg-blue-100',
      token_revoked: 'bg-gray-100',
      token_deleted: 'bg-red-100',
      api_key_deleted: 'bg-red-100',
      endpoint_deleted: 'bg-red-100',
      error: 'bg-red-100',
    };
    return bgClasses[type] || 'bg-snowflake-100';
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-32 text-red-500">
        <p>Failed to load activity</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="flex items-center justify-center h-32 text-snowflake-500">
        <div className="text-center">
          <p className="text-sm">No recent activity</p>
          <p className="text-xs mt-1">Activity will appear here as you use the service</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, activityIdx) => {
          const Icon = getActivityIcon(activity.type);
          const message = getActivityMessage(activity);
          const timestamp = activity.timestamp 
            ? formatDistanceToNow(new Date(activity.timestamp), { addSuffix: true })
            : 'Unknown time';
          
          return (
            <li key={activity.id || activityIdx}>
              <div className="relative pb-8">
                {activityIdx !== activities.length - 1 ? (
                  <span
                    className="absolute top-4 left-4 -ml-px h-full w-0.5 bg-snowflake-200"
                    aria-hidden="true"
                  />
                ) : null}
                <div className="relative flex space-x-3">
                  <div>
                    <span
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${getActivityBgColor(activity.type)}`}
                    >
                      <Icon
                        className={`h-4 w-4 ${getActivityColor(activity.type)}`}
                      />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-sm text-snowflake-500">
                        {message}
                      </p>
                      {activity.user && activity.user !== 'system' && (
                        <p className="text-xs text-snowflake-400 mt-0.5">
                          by {activity.user}
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm whitespace-nowrap text-snowflake-500">
                      <time>{timestamp}</time>
                    </div>
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default RecentActivity;
