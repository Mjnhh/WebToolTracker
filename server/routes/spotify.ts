import express, { Request, Response } from 'express';
import axios from 'axios';
import { isAuthenticated } from '../middleware/auth';

const router = express.Router();

// Proxy endpoint cho Spotify API để bỏ qua CORS
router.get('/proxy/*', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const spotifyEndpoint = req.params[0];
    const spotifyToken = req.headers.authorization?.split(' ')[1];
    
    if (!spotifyToken) {
      return res.status(401).json({ message: 'Spotify token không hợp lệ' });
    }
    
    const response = await axios({
      method: req.method,
      url: `https://api.spotify.com/v1/${spotifyEndpoint}`,
      headers: {
        'Authorization': `Bearer ${spotifyToken}`,
        'Content-Type': 'application/json'
      },
      params: req.query
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error('Spotify API error:', error.response?.data || error.message);
    
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({ message: 'Lỗi khi gọi Spotify API' });
  }
});

// Endpoint POST proxy để hỗ trợ các yêu cầu PUT, POST đến Spotify
router.post('/proxy/*', isAuthenticated, async (req: Request, res: Response) => {
  try {
    const spotifyEndpoint = req.params[0];
    const spotifyToken = req.headers.authorization?.split(' ')[1];
    
    if (!spotifyToken) {
      return res.status(401).json({ message: 'Spotify token không hợp lệ' });
    }
    
    const requestMethod = req.headers['x-spotify-method'] as string || 'POST';
    
    const response = await axios({
      method: requestMethod,
      url: `https://api.spotify.com/v1/${spotifyEndpoint}`,
      headers: {
        'Authorization': `Bearer ${spotifyToken}`,
        'Content-Type': 'application/json'
      },
      data: req.body,
      params: req.query
    });
    
    res.json(response.data);
  } catch (error: any) {
    console.error('Spotify API error:', error.response?.data || error.message);
    
    if (error.response) {
      return res.status(error.response.status).json(error.response.data);
    }
    
    res.status(500).json({ message: 'Lỗi khi gọi Spotify API' });
  }
});

export default router; 