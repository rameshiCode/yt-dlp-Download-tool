import { useState } from 'react';
import { Plus, X, Download, Music } from 'lucide-react';

const DownloadForm = ({ genres, onStartDownload }) => {
  const [urls, setUrls] = useState(['']);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [customGenre, setCustomGenre] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [duplicateWarnings, setDuplicateWarnings] = useState(null);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const addUrlField = () => {
    setUrls([...urls, '']);
  };

  const removeUrlField = (index) => {
    if (urls.length > 1) {
      setUrls(urls.filter((_, i) => i !== index));
    }
  };

  const updateUrl = (index, value) => {
    const newUrls = [...urls];
    newUrls[index] = value;
    setUrls(newUrls);
  };

  const checkForDuplicates = async (validUrls, genre) => {
    try {
      const response = await fetch('/api/check-duplicates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          urls: validUrls,
          genre: genre,
          quality: 'best'
        }),
      });

      if (response.ok) {
        const duplicates = await response.json();
        return duplicates;
      }
    } catch (error) {
      console.error('Error checking duplicates:', error);
    }
    return null;
  };

  const proceedWithDownload = async (validUrls, genre) => {
    setIsLoading(true);
    try {
      await onStartDownload(validUrls, genre);
      // Reset form after successful download
      setUrls(['']);
      setSelectedGenre('');
      setCustomGenre('');
    } catch (error) {
      console.error('Download failed:', error);
      alert('Download failed. Please try again.');
    } finally {
      setIsLoading(false);
      setShowDuplicateModal(false);
      setDuplicateWarnings(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Validate URLs
    const validUrls = urls.filter(url => url.trim() !== '');
    if (validUrls.length === 0) {
      alert('Please enter at least one YouTube URL');
      return;
    }

    // Check for playlist URLs and warn user
    const playlistUrls = validUrls.filter(url =>
      url.includes('list=') || url.includes('playlist')
    );

    if (playlistUrls.length > 0) {
      const confirmed = confirm(
        `⚠️ Warning: You've entered ${playlistUrls.length} playlist URL(s).\n\n` +
        `This tool will only download the SINGLE VIDEO from the playlist URL, not the entire playlist.\n\n` +
        `If you want to download the entire playlist, please use a different tool.\n\n` +
        `Continue with single video download?`
      );
      if (!confirmed) {
        return;
      }
    }

    // Determine genre
    const genre = customGenre.trim() || selectedGenre;
    if (!genre) {
      alert('Please select or enter a genre');
      return;
    }

    // Check for duplicates
    setIsLoading(true);
    const duplicates = await checkForDuplicates(validUrls, genre);
    setIsLoading(false);

    if (duplicates && (duplicates.url_duplicate || duplicates.similar_songs.length > 0)) {
      setDuplicateWarnings(duplicates);
      setShowDuplicateModal(true);
      return;
    }

    // No duplicates found, proceed with download
    await proceedWithDownload(validUrls, genre);
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex p-4 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl shadow-lg mb-6">
          <Music className="h-12 w-12 text-white" />
        </div>
        <h2 className="text-4xl font-bold gradient-text mb-4">Download YouTube Music</h2>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          Transform YouTube videos into high-quality MP3 files, automatically organized by genre
        </p>
      </div>

      {/* Download Form */}
      <div className="card max-w-3xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-8">
          {/* URL Input Fields */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-4">
              🎵 YouTube URLs
            </label>
            <div className="space-y-4">
              {urls.map((url, index) => (
                <div key={index} className="flex space-x-3">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                    className="input-field flex-1 text-lg"
                    required={index === 0}
                  />
                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrlField(index)}
                      className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all duration-200"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addUrlField}
              className="mt-4 flex items-center space-x-2 text-blue-600 hover:text-blue-700 text-base font-semibold bg-blue-50 hover:bg-blue-100 px-4 py-2 rounded-xl transition-all duration-200"
            >
              <Plus className="h-5 w-5" />
              <span>Add another URL</span>
            </button>
          </div>

          {/* Genre Selection */}
          <div className="space-y-6">
            <div>
              <label className="block text-lg font-semibold text-gray-800 mb-4">
                🎭 Select Genre/Folder
              </label>
              <select
                value={selectedGenre}
                onChange={(e) => {
                  setSelectedGenre(e.target.value);
                  if (e.target.value) setCustomGenre('');
                }}
                className="input-field text-lg w-full"
              >
                <option value="">Choose a genre/folder...</option>
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre.includes('/') ? `📁 ${genre}` : `🎵 ${genre}`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-lg font-semibold text-gray-800 mb-4">
                ✨ Or Create Custom Folder Structure
              </label>
              <input
                type="text"
                value={customGenre}
                onChange={(e) => {
                  setCustomGenre(e.target.value);
                  if (e.target.value) setSelectedGenre('');
                }}
                placeholder="e.g., Hip Hop/50 Cent, Rock/Classic Rock/Led Zeppelin"
                className="input-field text-lg w-full"
              />
              <p className="text-sm text-gray-600 mt-2">
                💡 <strong>Tip:</strong> Use "/" to create subfolders. Examples:
              </p>
              <div className="mt-2 space-y-1 text-sm text-gray-600">
                <div>• <code className="bg-gray-100 px-2 py-1 rounded">Hip Hop/50 Cent</code> → Creates: downloads/hip_hop/50_cent/</div>
                <div>• <code className="bg-gray-100 px-2 py-1 rounded">Rock/Classic Rock</code> → Creates: downloads/rock/classic_rock/</div>
                <div>• <code className="bg-gray-100 px-2 py-1 rounded">Electronic/House/Deep House</code> → Creates: downloads/electronic/house/deep_house/</div>
              </div>
            </div>
          </div>

          {/* Quality Selection */}
          <div>
            <label className="block text-lg font-semibold text-gray-800 mb-4">
              🎧 Audio Quality
            </label>
            <select className="input-field text-lg" defaultValue="0">
              <option value="0">🌟 Best Quality (Recommended)</option>
              <option value="1">⚡ High Quality</option>
              <option value="2">📱 Medium Quality</option>
              <option value="3">💾 Low Quality (Smaller files)</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full btn-primary flex items-center justify-center space-x-3 text-xl py-4 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Download className="h-6 w-6" />
            <span>{isLoading ? '🚀 Starting Downloads...' : '🎵 Start Download'}</span>
          </button>
        </form>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto">
        <div className="card text-center group hover:scale-105 transition-transform duration-300">
          <div className="inline-flex p-4 bg-gradient-to-r from-green-500 to-emerald-600 rounded-2xl mb-4 group-hover:shadow-lg transition-shadow">
            <Music className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">🎵 High Quality Audio</h3>
          <p className="text-gray-600">
            Downloads the best available audio quality as MP3 with automatic metadata tagging
          </p>
        </div>
        <div className="card text-center group hover:scale-105 transition-transform duration-300">
          <div className="inline-flex p-4 bg-gradient-to-r from-blue-500 to-cyan-600 rounded-2xl mb-4 group-hover:shadow-lg transition-shadow">
            <Download className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">⚡ Batch Downloads</h3>
          <p className="text-gray-600">
            Add multiple URLs to download several songs at once with real-time progress tracking
          </p>
        </div>
        <div className="card text-center group hover:scale-105 transition-transform duration-300">
          <div className="inline-flex p-4 bg-gradient-to-r from-purple-500 to-pink-600 rounded-2xl mb-4 group-hover:shadow-lg transition-shadow">
            <Plus className="h-8 w-8 text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">📁 Smart Folder Organization</h3>
          <p className="text-gray-600">
            Create nested folder structures like "Hip Hop/50 Cent" or "Rock/Classic Rock" for perfect music library organization
          </p>
        </div>
      </div>

      {/* Duplicate Warning Modal */}
      {showDuplicateModal && duplicateWarnings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl max-h-96 overflow-y-auto">
            <h3 className="text-lg font-bold text-red-600 mb-4">⚠️ Duplicate Content Detected</h3>

            {duplicateWarnings.url_duplicate && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-red-800 font-medium">URL Already Downloaded</p>
                <p className="text-red-600 text-sm">One or more URLs have already been downloaded.</p>
              </div>
            )}

            {duplicateWarnings.similar_songs.length > 0 && (
              <div className="mb-4">
                <p className="font-medium text-gray-800 mb-2">Similar Songs Found:</p>
                {duplicateWarnings.similar_songs.map((item, index) => (
                  <div key={index} className="mb-3 p-3 bg-yellow-50 border border-yellow-200 rounded">
                    <p className="font-medium text-gray-800">
                      New: {item.new_artist} - {item.new_title}
                    </p>
                    <p className="text-sm text-gray-600 mb-2">Similar to:</p>
                    {item.similar_files.map((similar, idx) => (
                      <div key={idx} className="text-sm text-gray-700 ml-4">
                        • {similar.artist} - {similar.title} ({similar.source})
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDuplicateModal(false);
                  setDuplicateWarnings(null);
                }}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const validUrls = urls.filter(url => url.trim() !== '');
                  const genre = customGenre.trim() || selectedGenre;
                  await proceedWithDownload(validUrls, genre);
                }}
                className="btn-primary flex-1"
              >
                Download Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DownloadForm;
