/**
 * Backend Proxy Example for Particular Audience API
 * 
 * This is an example Node.js/Express backend proxy that handles authentication
 * and forwards requests to the Particular Audience API.
 * 
 * The authentication token is cached server-side and automatically refreshed.
 */

const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');

class ParticularAudienceProxy {
  constructor(config) {
    this.config = {
      clientId: config.clientId || process.env.PA_CLIENT_ID,
      clientSecret: config.clientSecret || process.env.PA_CLIENT_SECRET,
      authEndpoint: config.authEndpoint || process.env.PA_AUTH_ENDPOINT,
      apiEndpoint: config.apiEndpoint || process.env.PA_API_ENDPOINT,
      tokenCacheTTL: config.tokenCacheTTL || 23 * 60 * 60, // 23 hours (token valid for 25 hours)
    };

    // Initialize token cache
    this.tokenCache = new NodeCache({ stdTTL: this.config.tokenCacheTTL });
    
    // Express router
    this.router = express.Router();
    this.setupRoutes();
  }

  /**
   * Set up proxy routes
   */
  setupRoutes() {
    // Middleware to parse JSON
    this.router.use(express.json());

    // Config endpoint - no auth needed
    this.router.get('/3.0/config', this.handleConfig.bind(this));

    // Recommendations endpoint
    this.router.get('/3.0/recommendations', this.handleRecommendations.bind(this));

    // Event endpoints
    this.router.post('/3.0/events/:eventType', this.handleEvents.bind(this));

    // Generic proxy for any other endpoints
    this.router.all('/*', this.handleGenericProxy.bind(this));
  }

  /**
   * Get or refresh authentication token
   */
  async getAuthToken() {
    // Check cache first
    const cachedToken = this.tokenCache.get('auth_token');
    if (cachedToken) {
      return cachedToken;
    }

    try {
      // Request new token
      const response = await axios.post(
        `${this.config.authEndpoint}/auth/connect/token`,
        new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          grant_type: 'client_credentials'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      const token = response.data.access_token;
      
      // Cache the token
      this.tokenCache.set('auth_token', token);
      
      console.log('PA Auth token refreshed successfully');
      return token;
    } catch (error) {
      console.error('Failed to get PA auth token:', error.response?.data || error.message);
      throw new Error('Authentication failed');
    }
  }

  /**
   * Handle config endpoint (no auth required)
   */
  async handleConfig(req, res) {
    try {
      const token = await this.getAuthToken();
      
      // Forward the request
      const response = await axios.get(
        `${this.config.apiEndpoint}/3.0/config`,
        {
          params: req.query,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Handle recommendations endpoint
   */
  async handleRecommendations(req, res) {
    try {
      const token = await this.getAuthToken();
      
      // Forward the request
      const response = await axios.get(
        `${this.config.apiEndpoint}/3.0/recommendations`,
        {
          params: req.query,
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.json(response.data);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Handle event tracking endpoints
   */
  async handleEvents(req, res) {
    try {
      const token = await this.getAuthToken();
      const eventType = req.params.eventType;
      
      // Validate event type
      const validEventTypes = [
        'view-products',
        'clicks',
        'add-to-carts',
        'checkouts',
        'purchases',
        'search-terms',
        'slot-impressions'
      ];

      if (!validEventTypes.includes(eventType)) {
        return res.status(400).json({ error: 'Invalid event type' });
      }

      // Forward the request
      const response = await axios.post(
        `${this.config.apiEndpoint}/3.0/events/${eventType}`,
        req.body,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      res.status(response.status).json(response.data);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Handle generic proxy requests
   */
  async handleGenericProxy(req, res) {
    try {
      const token = await this.getAuthToken();
      const path = req.path;
      
      const config = {
        method: req.method,
        url: `${this.config.apiEndpoint}${path}`,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      };

      if (req.method === 'GET') {
        config.params = req.query;
      } else {
        config.data = req.body;
      }

      const response = await axios(config);
      res.status(response.status).json(response.data);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  /**
   * Error handler
   */
  handleError(error, res) {
    if (error.response) {
      // PA API returned an error
      console.error('PA API Error:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      // Request was made but no response
      console.error('PA API No Response:', error.message);
      res.status(503).json({ error: 'Service unavailable' });
    } else {
      // Something else went wrong
      console.error('Proxy Error:', error.message);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

// Example Express app setup
function createApp() {
  const app = express();
  
  // CORS configuration (adjust for your needs)
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // Create proxy instance
  const paProxy = new ParticularAudienceProxy({
    clientId: process.env.PA_CLIENT_ID || 'YOUR_CLIENT_ID',
    clientSecret: process.env.PA_CLIENT_SECRET || 'YOUR_CLIENT_SECRET',
    authEndpoint: process.env.PA_AUTH_ENDPOINT || 'YOUR_PA_AUTH_ENDPOINT',
    apiEndpoint: process.env.PA_API_ENDPOINT || 'YOUR_PA_API_ENDPOINT'
  });

  // Mount the proxy routes
  app.use('/api/pa', paProxy.router);

  // Serve static files (for testing)
  app.use(express.static('.'));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', service: 'pa-proxy' });
  });

  return app;
}

// Start server if run directly
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  const app = createApp();
  
  app.listen(PORT, () => {
    console.log(`PA Proxy Server running on port ${PORT}`);
    console.log(`Configure your SDK to use: http://localhost:${PORT}/api/pa`);
  });
}

module.exports = { ParticularAudienceProxy, createApp };