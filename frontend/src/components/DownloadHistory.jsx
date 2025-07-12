import { CheckCircle, Music, ExternalLink, Folder } from 'lucide-react';

const DownloadHistory = ({ history }) => {
  if (history.length === 0) {
    return (
      <div className="text-center py-12">
        <Folder className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">No completed downloads</h3>
        <p className="mt-1 text-sm text-gray-500">
          Completed downloads will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Download History</h2>
        <span className="text-sm text-gray-500">
          {history.length} completed {history.length === 1 ? 'download' : 'downloads'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {history.map((download) => (
          <div key={download.id} className="card hover:shadow-md transition-shadow">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0">
                <CheckCircle className="h-6 w-6 text-green-500" />
              </div>
              
              <div className="flex-1 min-w-0">
                {download.artist && download.clean_title ? (
                  <>
                    <h3 className="text-sm font-medium text-gray-900 truncate">
                      🎵 {download.clean_title}
                    </h3>
                    <p className="text-xs font-medium text-blue-600 truncate">
                      👤 {download.artist}
                    </p>
                  </>
                ) : (
                  <h3 className="text-sm font-medium text-gray-900 truncate">
                    {download.title || 'Unknown Title'}
                  </h3>
                )}
                
                <div className="mt-2 space-y-1">
                  <div className="flex items-center text-xs text-gray-500">
                    <Music className="h-3 w-3 mr-1" />
                    <span>MP3 Audio</span>
                  </div>
                  
                  {download.file_path && (
                    <div className="flex items-center text-xs text-gray-500">
                      <Folder className="h-3 w-3 mr-1" />
                      <span className="truncate">
                        {download.file_path.split('/').slice(-2).join('/')}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between">
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Completed
                  </span>
                  
                  <a
                    href={download.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:text-primary-700 transition-colors"
                    title="View original video"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DownloadHistory;
