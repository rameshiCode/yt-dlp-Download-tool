import { useState } from 'react';
import { Plus, X, Download, Music } from 'lucide-react';

const DownloadForm = ({ genres, onStartDownload }) => {
  const [urls, setUrls] = useState(['']);
  const [selectedGenre, setSelectedGenre] = useState('');
  const [customGenre, setCustomGenre] = useState('');
  const [isLoading, setIsLoading] = useState(false);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate URLs
    const validUrls = urls.filter(url => url.trim() !== '');
    if (validUrls.length === 0) {
      alert('Please enter at least one YouTube URL');
      return;
    }

    // Validate genre
    const genre = customGenre.trim() || selectedGenre;
    if (!genre) {
      alert('Please select or enter a genre');
      return;
    }

    setIsLoading(true);
    try {
      await onStartDownload(validUrls, genre);
      // Reset form
      setUrls(['']);
      setSelectedGenre('');
      setCustomGenre('');
    } catch (error) {
      console.error('Download failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <Music className="mx-auto h-12 w-12 text-primary-600" />
        <h2 className="mt-2 text-3xl font-bold text-gray-900">Download YouTube Music</h2>
        <p className="mt-2 text-gray-600">
          Enter YouTube URLs and select a genre to organize your downloads
        </p>
      </div>

      {/* Download Form */}
      <div className="card max-w-2xl mx-auto">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* URL Input Fields */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              YouTube URLs
            </label>
            <div className="space-y-3">
              {urls.map((url, index) => (
                <div key={index} className="flex space-x-2">
                  <input
                    type="url"
                    value={url}
                    onChange={(e) => updateUrl(index, e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                    className="input-field flex-1"
                    required={index === 0}
                  />
                  {urls.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeUrlField(index)}
                      className="p-2 text-gray-400 hover:text-red-500 transition-colors"
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
              className="mt-3 flex items-center space-x-2 text-primary-600 hover:text-primary-700 text-sm font-medium"
            >
              <Plus className="h-4 w-4" />
              <span>Add another URL</span>
            </button>
          </div>

          {/* Genre Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Genre
              </label>
              <select
                value={selectedGenre}
                onChange={(e) => {
                  setSelectedGenre(e.target.value);
                  if (e.target.value) setCustomGenre('');
                }}
                className="input-field"
              >
                <option value="">Choose a genre...</option>
                {genres.map((genre) => (
                  <option key={genre} value={genre}>
                    {genre}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Or Enter Custom Genre
              </label>
              <input
                type="text"
                value={customGenre}
                onChange={(e) => {
                  setCustomGenre(e.target.value);
                  if (e.target.value) setSelectedGenre('');
                }}
                placeholder="e.g., Lo-Fi Hip Hop"
                className="input-field"
              />
            </div>
          </div>

          {/* Quality Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audio Quality
            </label>
            <select className="input-field" defaultValue="0">
              <option value="0">Best Quality</option>
              <option value="1">High Quality</option>
              <option value="2">Medium Quality</option>
              <option value="3">Low Quality</option>
            </select>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full btn-primary flex items-center justify-center space-x-2 ${
              isLoading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            <Download className="h-5 w-5" />
            <span>{isLoading ? 'Starting Downloads...' : 'Start Download'}</span>
          </button>
        </form>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
        <div className="card text-center">
          <div className="text-primary-600 mb-2">
            <Music className="h-8 w-8 mx-auto" />
          </div>
          <h3 className="font-semibold text-gray-900">High Quality Audio</h3>
          <p className="text-sm text-gray-600 mt-1">
            Downloads best available audio quality as MP3
          </p>
        </div>
        <div className="card text-center">
          <div className="text-primary-600 mb-2">
            <Download className="h-8 w-8 mx-auto" />
          </div>
          <h3 className="font-semibold text-gray-900">Batch Downloads</h3>
          <p className="text-sm text-gray-600 mt-1">
            Add multiple URLs to download several songs at once
          </p>
        </div>
        <div className="card text-center">
          <div className="text-primary-600 mb-2">
            <Plus className="h-8 w-8 mx-auto" />
          </div>
          <h3 className="font-semibold text-gray-900">Auto Organization</h3>
          <p className="text-sm text-gray-600 mt-1">
            Files are automatically organized by genre in folders
          </p>
        </div>
      </div>
    </div>
  );
};

export default DownloadForm;
