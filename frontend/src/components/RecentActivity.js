import React from 'react';
import { Clock, Server, Key, AlertCircle } from 'lucide-react';

const RecentActivity = () => {
  // Mock data - in a real app, this would come from an API
  const activities = [
    {
      id: 1,
      type: 'endpoint_created',
      message: 'New endpoint "User Data Query" created',
      timestamp: '2 minutes ago',
      icon: Server,
      color: 'green',
    },
    {
      id: 2,
      type: 'token_generated',
      message: 'PAT token generated for "Sales Report" endpoint',
      timestamp: '15 minutes ago',
      icon: Key,
      color: 'blue',
    },
    {
      id: 3,
      type: 'endpoint_updated',
      message: 'Endpoint "Customer Analytics" updated',
      timestamp: '1 hour ago',
      icon: Server,
      color: 'yellow',
    },
    {
      id: 4,
      type: 'error',
      message: 'Connection error for "Inventory Check" endpoint',
      timestamp: '2 hours ago',
      icon: AlertCircle,
      color: 'red',
    },
    {
      id: 5,
      type: 'token_revoked',
      message: 'PAT token revoked for "Test Query" endpoint',
      timestamp: '3 hours ago',
      icon: Key,
      color: 'gray',
    },
  ];

  const getActivityIcon = (type) => {
    switch (type) {
      case 'endpoint_created':
      case 'endpoint_updated':
        return Server;
      case 'token_generated':
      case 'token_revoked':
        return Key;
      case 'error':
        return AlertCircle;
      default:
        return Clock;
    }
  };

  const getActivityColor = (color) => {
    const colorClasses = {
      green: 'text-green-500',
      blue: 'text-blue-500',
      yellow: 'text-yellow-500',
      red: 'text-red-500',
      gray: 'text-gray-500',
    };
    return colorClasses[color] || colorClasses.gray;
  };

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, activityIdx) => {
          const Icon = getActivityIcon(activity.type);
          return (
            <li key={activity.id}>
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
                      className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                        activity.type === 'error'
                          ? 'bg-red-100'
                          : activity.type === 'token_generated'
                          ? 'bg-blue-100'
                          : 'bg-snowflake-100'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 ${getActivityColor(activity.color)}`}
                      />
                    </span>
                  </div>
                  <div className="min-w-0 flex-1 pt-1.5 flex justify-between space-x-4">
                    <div>
                      <p className="text-sm text-snowflake-500">
                        {activity.message}
                      </p>
                    </div>
                    <div className="text-right text-sm whitespace-nowrap text-snowflake-500">
                      <time>{activity.timestamp}</time>
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
