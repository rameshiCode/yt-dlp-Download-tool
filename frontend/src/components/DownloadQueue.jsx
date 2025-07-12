import { Clock, Download, AlertCircle, CheckCircle, Music } from 'lucide-react';

const DownloadQueue = ({ downloads }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'downloading':
        return <Download className="h-5 w-5 text-blue-500 animate-pulse" />;
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      default:
        return <Clock className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'downloading':
        return 'Downloading';
      case 'completed':
        return 'Completed';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'downloading':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'error':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (downloads.length === 0) {
    return (
      <div className="text-center py-12">
        <Music className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No downloads in queue</h3>
        <p className="mt-1 text-sm text-gray-500">
          Start a download to see it appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Download Queue</h2>
        <span className="text-sm text-gray-500">
          {downloads.length} {downloads.length === 1 ? 'item' : 'items'}
        </span>
      </div>

      <div className="space-y-4">
        {downloads.map((download) => (
          <div key={download.id} className="card">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 pt-1">
                {getStatusIcon(download.status)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {download.artist && download.clean_title ? (
                      <>
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          🎵 {download.clean_title}
                        </h3>
                        <p className="text-sm font-medium text-blue-600 truncate">
                          👤 {download.artist}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {download.url}
                        </p>
                      </>
                    ) : (
                      <>
                        <h3 className="text-lg font-medium text-gray-900 truncate">
                          {download.title || 'Loading metadata...'}
                        </h3>
                        <p className="text-sm text-gray-500 truncate">
                          {download.url}
                        </p>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(download.status)}`}>
                      {getStatusText(download.status)}
                    </span>
                  </div>
                </div>

                {/* Progress Bar */}
                {download.status === 'downloading' && (
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="text-gray-900 font-medium">
                        {Math.round(download.progress || 0)}%
                      </span>
                    </div>
                    <div className="mt-1 w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${download.progress || 0}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {download.status === 'error' && download.error && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex">
                      <AlertCircle className="h-5 w-5 text-red-400 flex-shrink-0" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-red-800">
                          Download Error
                        </h4>
                        <p className="text-sm text-red-700 mt-1">
                          {download.error}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Success Message */}
                {download.status === 'completed' && (
                  <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-md">
                    <div className="flex">
                      <CheckCircle className="h-5 w-5 text-green-400 flex-shrink-0" />
                      <div className="ml-3">
                        <h4 className="text-sm font-medium text-green-800">
                          Download Complete
                        </h4>
                        {download.file_path && (
                          <p className="text-sm text-green-700 mt-1">
                            Saved to: {download.file_path}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DownloadQueue;
