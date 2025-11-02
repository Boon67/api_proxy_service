import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

const ConfirmationModal = ({ 
  isOpen, 
  onClose, 
  onConfirm, 
  title = 'Confirm Action',
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default', // 'default', 'danger', 'warning'
  isLoading = false
}) => {
  if (!isOpen) return null;

  const variantStyles = {
    default: {
      button: 'btn-primary',
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600'
    },
    danger: {
      button: 'bg-red-600 hover:bg-red-700 text-white',
      iconBg: 'bg-red-100',
      iconColor: 'text-red-600'
    },
    warning: {
      button: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      iconBg: 'bg-yellow-100',
      iconColor: 'text-yellow-600'
    }
  };

  const styles = variantStyles[variant] || variantStyles.default;

  const handleConfirm = () => {
    onConfirm();
    // Don't close automatically - let the parent handle closing after success
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-snowflake-900 bg-opacity-75 transition-opacity"
        onClick={onClose}
      ></div>

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative bg-white rounded-lg border border-snowflake-200 shadow-xl max-w-md w-full">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-snowflake-400 hover:text-snowflake-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Icon */}
            <div className="flex justify-center mb-4">
              <div className={`flex items-center justify-center h-12 w-12 rounded-full ${styles.iconBg}`}>
                <AlertTriangle className={`h-6 w-6 ${styles.iconColor}`} />
              </div>
            </div>

            {/* Title */}
            <h2 className="text-lg font-semibold text-snowflake-900 text-center mb-3">
              {title}
            </h2>

            {/* Message */}
            <p className="text-sm text-snowflake-600 text-center mb-6 whitespace-pre-line">
              {message}
            </p>

            {/* Actions */}
            <div className="flex justify-end space-x-3">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-snowflake-700 bg-white border border-snowflake-300 rounded-md hover:bg-snowflake-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${styles.button} disabled:opacity-50 disabled:cursor-not-allowed flex items-center`}
              >
                {isLoading && (
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;


