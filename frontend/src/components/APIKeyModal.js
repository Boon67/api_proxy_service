import React from 'react';
import { CheckCircle2, Copy, Download, X } from 'lucide-react';
import toast from 'react-hot-toast';

const APIKeyModal = ({ isOpen, onClose, apiKey, endpointName }) => {
  if (!isOpen) return null;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(apiKey);
      toast.success('API Key copied to clipboard');
    } catch (error) {
      toast.error('Failed to copy API Key');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([apiKey], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `api-key-${endpointName || 'key'}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('API Key downloaded');
  };

  const handleCopyAndClose = async () => {
    await handleCopy();
    onClose();
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
        <div className="relative bg-white rounded-lg border border-snowflake-200 shadow-xl max-w-lg w-full">
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-snowflake-400 hover:text-snowflake-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Content */}
          <div className="p-6">
            {/* Success Icon */}
            <div className="flex justify-center mb-4">
              <div className="flex items-center justify-center h-16 w-16 rounded-full bg-green-100">
                <CheckCircle2 className="h-10 w-10 text-green-600" />
              </div>
            </div>

            {/* Heading */}
            <h2 className="text-xl font-semibold text-snowflake-900 text-center mb-3">
              API Key successfully generated
            </h2>

            {/* Description */}
            <p className="text-sm text-snowflake-600 text-center mb-6">
              An API key has been successfully generated{endpointName ? ` for ${endpointName}` : ''}. 
              Copy or download this API key and save it in a secure location. You will not be able to see it again.
            </p>

            {/* API Key Display */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-snowflake-700 mb-2">
                API Key
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="text"
                  readOnly
                  value={apiKey || ''}
                  className="flex-1 px-3 py-2 border border-snowflake-300 rounded-md bg-snowflake-50 text-sm font-mono text-snowflake-700 truncate"
                  onClick={(e) => e.target.select()}
                />
                {/* Download Button */}
                <button
                  onClick={handleDownload}
                  className="p-2 text-snowflake-600 bg-snowflake-100 border border-snowflake-300 rounded-md hover:bg-snowflake-200 transition-colors"
                  title="Download API Key"
                >
                  <Download className="h-4 w-4" />
                </button>
                {/* Copy Button */}
                <button
                  onClick={handleCopy}
                  className="p-2 text-snowflake-600 bg-snowflake-100 border border-snowflake-300 rounded-md hover:bg-snowflake-200 transition-colors"
                  title="Copy API Key"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Primary Action Button */}
            <button
              onClick={handleCopyAndClose}
              className="w-full btn btn-primary btn-md"
            >
              <Copy className="h-4 w-4 mr-2" />
              Copy to clipboard and close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default APIKeyModal;

