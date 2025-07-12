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
      case 'metadata_update':
        setDownloads(prev => prev.map(download =>
          download.id === data.download_id
            ? {
                ...download,
                title: data.title,
                artist: data.artist,
                clean_title: data.clean_title
              }
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Header */}
      <header className="relative z-10 glass-card border-0 rounded-none backdrop-blur-xl bg-white/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
            <div className="flex items-center space-x-4">
              <div className="p-2 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
                <Music className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold gradient-text">YT-DLP Download Tool</h1>
                <p className="text-sm text-gray-600">High-quality music downloads made easy</p>
              </div>
            </div>
            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-4 text-sm">
                <div className="flex items-center space-x-2 bg-blue-100 px-3 py-2 rounded-lg">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">{downloads.length} in queue</span>
                </div>
                <div className="flex items-center space-x-2 bg-green-100 px-3 py-2 rounded-lg">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span className="font-medium text-green-800">{history.length} completed</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="relative z-10 bg-white/60 backdrop-blur-xl border-b border-white/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex space-x-2">
            {[
              { id: 'download', label: 'Download', icon: Download },
              { id: 'queue', label: 'Queue', icon: Clock },
              { id: 'history', label: 'History', icon: Folder },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`flex items-center space-x-2 py-4 px-6 rounded-t-xl font-semibold text-sm transition-all duration-300 ${
                  activeTab === id
                    ? 'bg-white text-blue-600 shadow-lg border-b-2 border-blue-600 transform -translate-y-1'
                    : 'text-gray-600 hover:text-blue-600 hover:bg-white/50 hover:transform hover:-translate-y-0.5'
                }`}
              >
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="animate-fade-in">
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
        </div>
      </main>
    </div>
  );
}

export default App;
