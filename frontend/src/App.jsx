import { useState, useEffect } from 'react';
import { Download, Music, Folder, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import { downloadAPI, createWebSocketConnection } from './utils/api';
import DownloadForm from './components/DownloadForm';
import DownloadQueue from './components/DownloadQueue';
import DownloadHistory from './components/DownloadHistory';

function App() {
  const [downloads, setDownloads] = useState([]);
  const [history, setHistory] = useState([]);
  const [genres, setGenres] = useState([]);
  const [activeTab, setActiveTab] = useState('download');
  const [wsConnection, setWsConnection] = useState(null);

  useEffect(() => {
    // Load initial data
    loadGenres();
    loadStatus();

    // Setup WebSocket connection
    const ws = createWebSocketConnection(handleWebSocketMessage);
    setWsConnection(ws);

    // Cleanup on unmount
    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  const loadGenres = async () => {
    try {
      const data = await downloadAPI.getGenres();
      setGenres(data.genres);
    } catch (error) {
      console.error('Failed to load genres:', error);
    }
  };

  const loadStatus = async () => {
    try {
      const data = await downloadAPI.getStatus();
      setDownloads(data.queue);
      setHistory(data.history);
    } catch (error) {
      console.error('Failed to load status:', error);
    }
  };

  const handleWebSocketMessage = (data) => {
    switch (data.type) {
      case 'progress':
        setDownloads(prev => prev.map(download =>
          download.id === data.download_id
            ? { ...download, progress: data.progress }
            : download
        ));
        break;
      case 'completed':
        setDownloads(prev => prev.map(download =>
          download.id === data.download_id
            ? { ...download, status: 'completed', progress: 100, file_path: data.file_path }
            : download
        ));
        loadStatus(); // Refresh to update history
        break;
      case 'error':
        setDownloads(prev => prev.map(download =>
          download.id === data.download_id
            ? { ...download, status: 'error', error: data.error }
            : download
        ));
        break;
      case 'title_update':
        setDownloads(prev => prev.map(download =>
          download.id === data.download_id
            ? { ...download, title: data.title }
            : download
        ));
        break;
    }
  };

  const handleStartDownload = async (urls, genre) => {
    try {
      const result = await downloadAPI.startDownload(urls, genre);
      console.log('Download started:', result);
      // Refresh status to show new downloads
      setTimeout(loadStatus, 500);
    } catch (error) {
      console.error('Failed to start download:', error);
      alert('Failed to start download: ' + error.message);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-3">
              <Music className="h-8 w-8 text-primary-600" />
              <h1 className="text-2xl font-bold text-gray-900">YT-DLP Download Tool</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-gray-500">
                <div className="flex items-center space-x-1">
                  <Clock className="h-4 w-4" />
                  <span>{downloads.length} in queue</span>
                </div>
                <div className="flex items-center space-x-1">
                  <CheckCircle className="h-4 w-4" />
                  <span>{history.length} completed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-8">
            {[
              { id: 'download', label: 'Download', icon: Download },
              { id: 'queue', label: 'Queue', icon: Clock },
              { id: 'history', label: 'History', icon: Folder },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'download' && (
          <DownloadForm
            genres={genres}
            onStartDownload={handleStartDownload}
          />
        )}
        {activeTab === 'queue' && (
          <DownloadQueue downloads={downloads} />
        )}
        {activeTab === 'history' && (
          <DownloadHistory history={history} />
        )}
      </main>
    </div>
  );
}

export default App;
