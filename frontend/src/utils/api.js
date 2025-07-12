import axios from 'axios';

const API_BASE_URL = 'http://localhost:9000';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const downloadAPI = {
  // Start downloads
  startDownload: async (urls, genre, quality = '0') => {
    const response = await api.post('/download', {
      urls,
      genre,
      quality,
    });
    return response.data;
  },

  // Get download status
  getStatus: async () => {
    const response = await api.get('/status');
    return response.data;
  },

  // Get available genres
  getGenres: async () => {
    const response = await api.get('/genres');
    return response.data;
  },
};

export const createWebSocketConnection = (onMessage) => {
  const ws = new WebSocket(`ws://localhost:9000/ws`);
  
  ws.onopen = () => {
    console.log('WebSocket connected');
  };
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    onMessage(data);
  };
  
  ws.onclose = () => {
    console.log('WebSocket disconnected');
  };
  
  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  return ws;
};

export default api;
