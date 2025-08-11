/**
 * Particular Audience JavaScript SDK
 * Frontend SDK for integrating Particular Audience services into your website
 * 
 * @version 0.1.0-alpha.1
 */

(function (global, factory) {
  typeof exports === 'object' && typeof module !== 'undefined' ? module.exports = factory() :
  typeof define === 'function' && define.amd ? define(factory) :
  (global = typeof globalThis !== 'undefined' ? globalThis : global || self, global.ParticularAudience = factory());
}(this, (function () {
  'use strict';

  /**
   * ParticularAudience SDK Configuration
   * @class
   * @see https://docs.particularaudience.com - Official PA Documentation
   */
  class ParticularAudience {
    constructor(config = {}) {
      this.config = {
        proxyUrl: config.proxyUrl || '/api/pa',
        sessionDuration: config.sessionDuration || 30 * 60 * 1000, // 30 minutes default
        enableLogging: config.enableLogging || false,
        cookiePrefix: config.cookiePrefix || 'pa_',
        storageType: config.storageType || 'cookie', // 'cookie' or 'localStorage'
        attributionWindow: config.attributionWindow || 30 * 24 * 60 * 60 * 1000, // 30 days default
        autoTrackProductViews: config.autoTrackProductViews !== false,
        autoTrackClicks: config.autoTrackClicks !== false,
        autoTrackImpressions: config.autoTrackImpressions !== false,
        // Product detection configuration
        productUrlPatterns: config.productUrlPatterns || [
          /\/product\/([^\/\?]+)/,    // /product/123
          /\/p\/([^\/\?]+)/,          // /p/123
          /[?&]id=([^&]+)/,           // ?id=123
          /[?&]product=([^&]+)/,      // ?product=123
          /[?&]sku=([^&]+)/           // ?sku=123
        ],
        productMetaSelectors: config.productMetaSelectors || [
          'meta[property="product:id"]',
          'meta[name="product-id"]'
        ],
        customProductIdExtractor: config.customProductIdExtractor || null
      };

      this.session = {
        customerId: null,
        sessionId: null,
        sessionTimeout: null,
        controlCohort: false
      };

      this.pendingEvents = [];
      this.eventBatchTimeout = null;
      this.attributionData = new Map(); // In-memory cache for current session
      
      this._init();
    }

    /**
     * Initialize the SDK
     * @private
     */
    async _init() {
      try {
        // Load or create session
        await this._initializeSession();

        // Set up auto-tracking if enabled
        if (this.config.autoTrackProductViews) {
          this._setupProductViewTracking();
        }
        if (this.config.autoTrackClicks) {
          this._setupClickTracking();
        }
        if (this.config.autoTrackImpressions) {
          this._setupImpressionTracking();
        }

        this._log('SDK initialized', this.session);
      } catch (error) {
        this._error('Failed to initialize SDK', error);
      }
    }

    /**
     * Initialize or restore session
     * @private
     */
    async _initializeSession() {
      // Check for existing session in cookies
      const storedSession = this._getStoredSession();
      
      if (storedSession && this._isSessionValid(storedSession)) {
        // Restore existing session
        this.session = storedSession;
        this._extendSession();
      } else {
        // Create new session
        await this.createSession(storedSession?.customerId);
      }
    }

    /**
     * Create a new session
     * @param {string} customerId - Optional existing customer ID
     * @returns {Promise<Object>} Session data
     * @see https://docs.particularaudience.com/config - Config API Documentation
     */
    async createSession(customerId = null) {
      try {
        const params = new URLSearchParams();
        if (customerId) {
          params.append('customerId', customerId);
        }
        if (this._isMobile()) {
          params.append('isMobile', 'true');
        }

        const response = await this._apiCall('GET', '/3.0/config', null, params);
        
        if (response.payload) {
          this.session = {
            customerId: response.payload.customerId,
            sessionId: response.payload.session.id,
            sessionTimeout: Date.now() + response.payload.session.duration,
            controlCohort: response.payload.controlCohort || false
          };

          this._storeSession();
          this._extendSession();
          
          this._log('Session created', this.session);
          return this.session;
        }
      } catch (error) {
        this._error('Failed to create session', error);
        throw error;
      }
    }

    /**
     * Get recommendations for current page or specific route
     * @param {Object} params - Recommendation parameters
     * @returns {Promise<Object>} Recommendations response
     * @see https://docs.particularaudience.com/recommendations-api/overview - Recommendations API
     * @see https://docs.particularaudience.com/recommendations-api/parameters - Parameters Reference
     * @see https://docs.particularaudience.com/recommendations-api/response-schema - Response Schema
     */
    async getRecommendations(params = {}) {
      try {
        const queryParams = new URLSearchParams();

        // Add current URL if not provided
        if (!params.currentUrl && !params.routeName) {
          params.currentUrl = window.location.href;
        }

        // Add session info
        if (this.session.customerId) {
          queryParams.append('customerId', this.session.customerId);
        }

        // Add all provided parameters
        Object.entries(params).forEach(([key, value]) => {
          if (Array.isArray(value)) {
            value.forEach((item, index) => {
              queryParams.append(`${key}[${index}]`, item);
            });
          } else if (value !== null && value !== undefined) {
            queryParams.append(key, value);
          }
        });

        const response = await this._apiCall('GET', '/3.0/recommendations', null, queryParams);

        // Auto-track impressions if enabled
        if (this.config.autoTrackImpressions && response.recommendations?.route?.widgets) {
          this._trackRecommendationImpressions(response);
        }

        return response;
      } catch (error) {
        this._error('Failed to get recommendations', error);
        throw error;
      }
    }

    /**
     * Track a view product event
     * @param {Object} eventData - Product view event data
     * @see https://docs.particularaudience.com/events/event-view-products - View Products Event API
     * @see https://docs.particularaudience.com/misc/view-products-attribution-handling - Attribution Handling
     */
    async trackViewProduct(eventData) {
      const event = {
        currentUrl: eventData.currentUrl || window.location.href,
        eventTime: new Date().toISOString(),
        refId: eventData.refId,
        widgetId: eventData.widgetId,
        routeId: eventData.routeId,
        recommenderId: eventData.recommenderId,
        campaignId: eventData.campaignId,
        tacticId: eventData.tacticId,
        referralUrl: eventData.referralUrl || document.referrer,
        bannerId: eventData.bannerId
      };

      return this._queueEvent('view-products', event);
    }

    /**
     * Track a click event
     * @param {Object} eventData - Click event data
     * @see https://docs.particularaudience.com/events/event-clicks - Click Event API
     * @see https://docs.particularaudience.com/events/event-triggering-guide - Event Triggering Guide
     */
    async trackClick(eventData) {
      const clickId = eventData.clickId || this._generateId();
      const event = {
        currentUrl: eventData.currentUrl || window.location.href,
        eventTime: new Date().toISOString(),
        clickId: clickId,
        refId: eventData.refId,
        actionType: eventData.actionType || 1, // Default to OpenProductPage
        contextType: eventData.contextType || 1, // Default to RecommendationWidget
        contextId: eventData.contextId,
        contextData: eventData.contextData,
        redirectUrl: eventData.redirectUrl,
        referralUrl: eventData.referralUrl || document.referrer,
        personalized: eventData.personalized,
        clickPosition: eventData.clickPosition,
        slot: eventData.slot,
        widgetId: eventData.widgetId,
        routeId: eventData.routeId,
        recommenderId: eventData.recommenderId,
        campaignId: eventData.campaignId,
        tacticId: eventData.tacticId,
        tacticLabel: eventData.tacticLabel,
        bannerId: eventData.bannerId,
        placementId: eventData.placementId,
        // Retail Boost
        retailBoostCollectionCampaignId: eventData.retailBoostCollectionCampaignId,
        // Retail Media
        adSetId: eventData.adSetId,
        adSetVersion: eventData.adSetVersion,
        costPerClick: eventData.costPerClick,
        costPerAction: eventData.costPerAction,
        costPerMille: eventData.costPerMille,
        timeStamp: eventData.timeStamp,
        hmacSalt: eventData.hmacSalt,
        hmac: eventData.hmac,
        supplierId: eventData.supplierId
      };

      // Store attribution data for later events (only for recommendation-based clicks)
      if (eventData.refId && (eventData.widgetId || eventData.adSetId)) {
        this._storeAttributionData(eventData.refId, {
          ...event,
          isSponsored: !!(eventData.adSetId && eventData.adSetId.length > 0)
        });
      }

      return this._queueEvent('clicks', event);
    }

    /**
     * Track add to cart event
     * @param {Object} eventData - Add to cart event data
     * @see https://docs.particularaudience.com/events/event-add-to-carts - Add to Cart Event API
     * @see https://docs.particularaudience.com/events/event-triggering-guide - Event Triggering Guide
     * @important Click event must be triggered before Add to Cart - see Event Triggering Guide
     */
    async trackAddToCart(eventData) {
      const productRefId = eventData.product.refId;
      
      // Get attribution data if not provided
      let attributionData = null;
      if (!eventData.clickId) {
        attributionData = this._getAttributionData(productRefId);
        if (!attributionData || !attributionData.clickId) {
          this._error('Add to Cart requires clickId. Generate a Click event first.');
          throw new Error('Add to Cart requires clickId. Generate a Click event first.');
        }
      }

      const baseEvent = {
        currentUrl: eventData.currentUrl || window.location.href,
        eventTime: new Date().toISOString(),
        product: {
          refId: eventData.product.refId,
          quantity: eventData.product.quantity,
          price: eventData.product.price
        },
        clickId: eventData.clickId || attributionData.clickId,
        referralUrl: eventData.referralUrl || document.referrer || (attributionData && attributionData.referralUrl)
      };

      // Add attribution data if available
      const event = attributionData ? 
        this._mergeAttributionData(baseEvent, attributionData) : 
        this._mergeAttributionData(baseEvent, eventData);

      return this._queueEvent('add-to-carts', event);
    }

    /**
     * Track checkout event
     * @param {Object} eventData - Checkout event data
     * @see https://docs.particularaudience.com/events/event-checkouts - Checkout Event API
     */
    async trackCheckout(eventData) {
      const event = {
        currentUrl: eventData.currentUrl || window.location.href,
        eventTime: new Date().toISOString(),
        subTotal: eventData.subTotal,
        discount: eventData.discount,
        totalPrice: eventData.totalPrice,
        deliveryFee: eventData.deliveryFee,
        currencyCode: eventData.currencyCode,
        products: eventData.products.map(product => this._enrichProductDataWithAttribution(product)),
        priceBeatPromotions: eventData.priceBeatPromotions
      };

      return this._queueEvent('checkouts', event);
    }

    /**
     * Track purchase event
     * @param {Object} eventData - Purchase event data
     * @see https://docs.particularaudience.com/events/event-purchases - Purchase Event API
     */
    async trackPurchase(eventData) {
      const products = [];
      const consumedAttribution = [];

      eventData.products.forEach(product => {
        const { product: enrichedProduct, attributionData } = this._prepareProductWithAttribution(product);
        products.push(enrichedProduct);
        if (attributionData) {
          consumedAttribution.push({ refId: product.refId, isSponsored: attributionData.isSponsored });
        }
      });

      const event = {
        currentUrl: eventData.currentUrl || window.location.href,
        eventTime: new Date().toISOString(),
        orderId: eventData.orderId,
        paymentMethod: eventData.paymentMethod,
        currencyCode: eventData.currencyCode,
        products,
        priceBeatPromotions: eventData.priceBeatPromotions,
        recommenderId: eventData.recommenderId,
        campaignId: eventData.campaignId,
        tacticId: eventData.tacticId
      };

      const queuedEvent = this._queueEvent('purchases', event);

      // Remove consumed attribution data so future purchases require new clicks
      consumedAttribution.forEach(item => {
        this._cleanupExpiredAttributionData(item.refId, item.isSponsored);
      });

      return queuedEvent;
    }

    /**
     * Track search term event
     * @param {Object} eventData - Search event data
     * @see https://docs.particularaudience.com/events/event-search-terms - Search Terms Event API
     */
    async trackSearch(eventData) {
      const event = {
        currentUrl: eventData.currentUrl || window.location.href,
        eventTime: new Date().toISOString(),
        widgetId: eventData.widgetId,
        routeId: eventData.routeId,
        searchTerm: eventData.searchTerm,
        numberOfResults: eventData.numberOfResults,
        tacticId: eventData.tacticId,
        campaignId: eventData.campaignId,
        recommenderId: eventData.recommenderId
      };

      return this._queueEvent('search-terms', event);
    }

    /**
     * Track slot impression event
     * @param {Object} eventData - Slot impression event data
     * @see https://docs.particularaudience.com/events/event-slot-impressions - Slot Impressions Event API
     */
    async trackSlotImpression(eventData) {
      const event = {
        currentUrl: eventData.currentUrl || window.location.href,
        eventTime: new Date().toISOString(),
        refId: eventData.refId,
        widgetId: eventData.widgetId,
        routeId: eventData.routeId,
        recommenderId: eventData.recommenderId,
        campaignId: eventData.campaignId,
        tacticId: eventData.tacticId,
        tacticLabel: eventData.tacticLabel,
        bannerId: eventData.bannerId,
        personalized: eventData.personalized,
        placementId: eventData.placementId,
        // Retail Boost
        retailBoostCollectionCampaignId: eventData.retailBoostCollectionCampaignId,
        // Retail Media
        adSetId: eventData.adSetId,
        adSetVersion: eventData.adSetVersion,
        costPerMille: eventData.costPerMille,
        costPerClick: eventData.costPerClick,
        costPerAction: eventData.costPerAction,
        timeStamp: eventData.timeStamp,
        hmacSalt: eventData.hmacSalt,
        hmac: eventData.hmac,
        supplierId: eventData.supplierId,
        // Price Beat
        priceBeat: eventData.priceBeat
      };

      return this._queueEvent('slot-impressions', event);
    }

    /**
     * Queue an event for batch sending
     * @private
     */
    _queueEvent(eventType, eventData) {
      // Remove undefined/null values
      const cleanedEvent = this._cleanObject(eventData);
      
      this.pendingEvents.push({ type: eventType, data: cleanedEvent });
      
      // Clear existing timeout
      if (this.eventBatchTimeout) {
        clearTimeout(this.eventBatchTimeout);
      }

      // Set new timeout to batch events (100ms delay)
      this.eventBatchTimeout = setTimeout(() => {
        this._flushEvents();
      }, 100);

      return cleanedEvent;
    }

    /**
     * Flush all pending events
     * @private
     */
    async _flushEvents() {
      if (this.pendingEvents.length === 0) return;

      // Group events by type
      const eventGroups = {};
      this.pendingEvents.forEach(({ type, data }) => {
        if (!eventGroups[type]) {
          eventGroups[type] = [];
        }
        eventGroups[type].push(data);
      });

      // Clear pending events
      this.pendingEvents = [];

      // Send each group
      const promises = Object.entries(eventGroups).map(([type, events]) => 
        this._sendEvents(type, events)
      );

      try {
        await Promise.all(promises);
        this._log('Events flushed successfully');
      } catch (error) {
        this._error('Failed to flush some events', error);
      }
    }

    /**
     * Send events to the API
     * @private
     */
    async _sendEvents(eventType, events) {
      if (!this.session.customerId || !this.session.sessionId) {
        this._error('Cannot send events without session');
        return;
      }

      const payload = {
        customerId: this.session.customerId,
        sessionId: this.session.sessionId,
        events: events
      };

      try {
        const response = await this._apiCall('POST', `/3.0/events/${eventType}`, payload);
        this._log(`Sent ${events.length} ${eventType} events`, response);
        return response;
      } catch (error) {
        this._error(`Failed to send ${eventType} events`, error);
        throw error;
      }
    }

    /**
     * Make an API call through the proxy
     * @private
     */
    async _apiCall(method, path, body = null, params = null) {
      const url = new URL(this.config.proxyUrl + path, window.location.origin);
      
      if (params) {
        url.search = params.toString();
      }

      const options = {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
      };

      if (body) {
        options.body = JSON.stringify(body);
      }

      try {
        const response = await fetch(url.toString(), options);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: 'Request failed' }));
          throw new Error(error.message || `HTTP ${response.status}`);
        }

        return await response.json();
      } catch (error) {
        this._error('API call failed', error);
        throw error;
      }
    }

    /**
     * Set up automatic product view detection and tracking
     * @private
     */
    _setupProductViewTracking() {
      // Track initial product view if on product page
      if (document.readyState === 'complete') {
        this._detectAndTrackProductView();
      } else {
        window.addEventListener('load', () => this._detectAndTrackProductView());
      }

      // Track route changes for SPAs
      let lastUrl = window.location.href;
      const observer = new MutationObserver(() => {
        if (window.location.href !== lastUrl) {
          lastUrl = window.location.href;
          this._detectAndTrackProductView();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      // Also listen to popstate for browser navigation
      window.addEventListener('popstate', () => this._detectAndTrackProductView());
    }

    /**
     * Detect if current page is a product page and track product view
     * @private
     */
    _detectAndTrackProductView() {
      // Detect if this is a product page
      const productId = this._detectProductId();
      if (productId) {
        this.trackViewProduct({ refId: productId });
      }
    }

    /**
     * Set up automatic click tracking
     * @private
     */
    _setupClickTracking() {
      document.addEventListener('click', (event) => {
        const target = event.target.closest('[data-pa-track-click]');
        if (target) {
          const trackingData = this._extractTrackingData(target);
          if (trackingData) {
            this.trackClick(trackingData);
          }
        }
      }, true);
    }

    /**
     * Set up automatic impression tracking
     * @private
     */
    _setupImpressionTracking() {
      if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              const element = entry.target;
              if (!element.dataset.paImpressionTracked) {
                element.dataset.paImpressionTracked = 'true';
                const trackingData = this._extractTrackingData(element);
                if (trackingData) {
                  this.trackSlotImpression(trackingData);
                }
              }
            }
          });
        }, { threshold: 0.5 });

        // Observe elements with impression tracking
        const observeElements = () => {
          document.querySelectorAll('[data-pa-track-impression]').forEach(element => {
            if (!element.dataset.paImpressionTracked) {
              observer.observe(element);
            }
          });
        };

        // Initial observation
        observeElements();

        // Re-observe on DOM changes
        const mutationObserver = new MutationObserver(observeElements);
        mutationObserver.observe(document.body, { childList: true, subtree: true });
      }
    }

    /**
     * Track recommendation impressions automatically
     * @private
     */
    _trackRecommendationImpressions(response) {
      if (!response.recommendations?.route?.widgets) return;

      response.recommendations.route.widgets.forEach(widget => {
        widget.slots?.forEach(slot => {
          slot.products?.forEach(product => {
            this.trackSlotImpression({
              refId: product.refId,
              widgetId: widget.id,
              routeId: response.recommendations.route.id,
              recommenderId: slot.recommenderId,
              campaignId: slot.campaignId,
              tacticId: slot.tacticId,
              tacticLabel: slot.label,
              retailBoostCollectionCampaignId: slot.retailBoostCollectionCampaignId,
              adSetId: slot.adSetId,
              adSetVersion: slot.adSetVersion,
              costPerMille: slot.costPerMille,
              costPerClick: slot.costPerClick,
              costPerAction: slot.costPerAction,
              timeStamp: slot.timeStamp,
              hmacSalt: slot.hmacSalt,
              hmac: slot.hmac,
              supplierId: slot.supplierId
            });
          });
        });
      });
    }

    /**
     * Extract tracking data from element attributes
     * @private
     */
    _extractTrackingData(element) {
      const data = {};
      
      // Extract all data-pa-* attributes
      for (const attr of element.attributes) {
        if (attr.name.startsWith('data-pa-')) {
          const key = attr.name.replace('data-pa-', '').replace(/-([a-z])/g, (_, c) => c.toUpperCase());
          let value = attr.value;
          
          // Try to parse JSON values
          try {
            value = JSON.parse(value);
          } catch (e) {
            // Keep as string if not valid JSON
          }
          
          data[key] = value;
        }
      }

      return Object.keys(data).length > 0 ? data : null;
    }

    /**
     * Detect product ID from current page
     * @private
     */
    _detectProductId() {
      // 1. Try custom extractor function first
      if (this.config.customProductIdExtractor) {
        try {
          const customResult = this.config.customProductIdExtractor();
          if (customResult) {
            return customResult;
          }
        } catch (error) {
          this._error('Custom product ID extractor failed:', error);
        }
      }

      // 2. Try configured URL patterns
      for (const pattern of this.config.productUrlPatterns) {
        const match = window.location.href.match(pattern);
        if (match && match[1]) {
          return match[1];
        }
      }

      // 3. Try configured meta tag selectors
      for (const selector of this.config.productMetaSelectors) {
        const metaElement = document.querySelector(selector);
        if (metaElement && metaElement.content) {
          return metaElement.content;
        }
      }

      // 4. Try to find in structured data (always try this)
      const ldJsonElements = document.querySelectorAll('script[type="application/ld+json"]');
      for (const ldJson of ldJsonElements) {
        try {
          const data = JSON.parse(ldJson.textContent);
          // Handle both single objects and arrays
          const products = Array.isArray(data) ? data : [data];
          
          for (const item of products) {
            if (item['@type'] === 'Product' && item.sku) {
              return item.sku;
            }
            // Also try productID field
            if (item['@type'] === 'Product' && item.productID) {
              return item.productID;
            }
          }
        } catch (e) {
          // Ignore parsing errors
        }
      }

      return null;
    }

    /**
     * Enrich product data with tracking fields
     * @private
     */
    _enrichProductData(product) {
      return {
        refId: product.refId,
        quantity: product.quantity,
        price: product.price,
        routeId: product.routeId,
        widgetId: product.widgetId,
        recommenderId: product.recommenderId,
        campaignId: product.campaignId,
        tacticId: product.tacticId,
        clickId: product.clickId,
        referralUrl: product.referralUrl,
        tacticLabel: product.tacticLabel,
        retailBoostCollectionCampaignId: product.retailBoostCollectionCampaignId,
        adSetId: product.adSetId,
        adSetVersion: product.adSetVersion,
        costPerClick: product.costPerClick,
        costPerAction: product.costPerAction,
        costPerMille: product.costPerMille,
        timeStamp: product.timeStamp,
        hmacSalt: product.hmacSalt,
        hmac: product.hmac,
        bannerId: product.bannerId,
        placementId: product.placementId
      };
    }

    /**
     * Prepare product data and return any attribution used
     * @private
     */
    _prepareProductWithAttribution(product) {
      const attributionData = this._getAttributionData(product.refId);
      const baseProduct = this._enrichProductData(product);
      const productWithAttr = attributionData ?
        this._mergeAttributionData(baseProduct, attributionData) :
        baseProduct;

      return {
        product: productWithAttr,
        attributionData
      };
    }

    /**
     * Enrich product data with attribution tracking fields
     * @private
     */
    _enrichProductDataWithAttribution(product) {
      return this._prepareProductWithAttribution(product).product;
    }

    /**
     * Session management utilities
     * @private
     */
    _getStoredSession() {
      try {
        let customerId, sessionId, sessionTimeout, controlCohort;

        if (this.config.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
          // Use localStorage
          customerId = localStorage.getItem(this.config.cookiePrefix + 'customer_id');
          sessionId = localStorage.getItem(this.config.cookiePrefix + 'session_id');
          sessionTimeout = localStorage.getItem(this.config.cookiePrefix + 'session_timeout');
          controlCohort = localStorage.getItem(this.config.cookiePrefix + 'control_cohort') === 'true';
        } else {
          // Use cookies (default or fallback)
          customerId = this._getCookie(this.config.cookiePrefix + 'customer_id');
          sessionId = this._getCookie(this.config.cookiePrefix + 'session_id');
          sessionTimeout = this._getCookie(this.config.cookiePrefix + 'session_timeout');
          controlCohort = this._getCookie(this.config.cookiePrefix + 'control_cohort') === 'true';
        }

        if (customerId && sessionId && sessionTimeout) {
          return {
            customerId,
            sessionId,
            sessionTimeout: parseInt(sessionTimeout),
            controlCohort
          };
        }
      } catch (e) {
        this._error('Failed to read stored session', e);
      }
      return null;
    }

    _storeSession() {
      try {
        if (this.config.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
          // Use localStorage
          localStorage.setItem(this.config.cookiePrefix + 'customer_id', this.session.customerId);
          localStorage.setItem(this.config.cookiePrefix + 'session_id', this.session.sessionId);
          localStorage.setItem(this.config.cookiePrefix + 'session_timeout', this.session.sessionTimeout.toString());
          localStorage.setItem(this.config.cookiePrefix + 'control_cohort', this.session.controlCohort.toString());
        } else {
          // Use cookies (default or fallback)
          const expires = new Date(this.session.sessionTimeout).toUTCString();
          this._setCookie(this.config.cookiePrefix + 'customer_id', this.session.customerId, expires);
          this._setCookie(this.config.cookiePrefix + 'session_id', this.session.sessionId, expires);
          this._setCookie(this.config.cookiePrefix + 'session_timeout', this.session.sessionTimeout, expires);
          this._setCookie(this.config.cookiePrefix + 'control_cohort', this.session.controlCohort, expires);
        }
      } catch (e) {
        this._error('Failed to store session', e);
      }
    }

    _isSessionValid(session) {
      return session.sessionTimeout > Date.now();
    }

    _extendSession() {
      if (this.session.sessionId) {
        this.session.sessionTimeout = Date.now() + this.config.sessionDuration;
        this._storeSession();
      }
    }

    /**
     * Cookie utilities
     * @private
     */
    _getCookie(name) {
      const value = `; ${document.cookie}`;
      const parts = value.split(`; ${name}=`);
      if (parts.length === 2) return parts.pop().split(';').shift();
      return null;
    }

    _setCookie(name, value, expires) {
      document.cookie = `${name}=${value}; expires=${expires}; path=/; SameSite=Lax`;
    }

    /**
     * Utility functions
     * @private
     */
    _generateId() {
      return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
      });
    }

    _isMobile() {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    _cleanObject(obj) {
      const cleaned = {};
      for (const [key, value] of Object.entries(obj)) {
        if (value !== undefined && value !== null) {
          if (typeof value === 'object' && !Array.isArray(value)) {
            const cleanedNested = this._cleanObject(value);
            if (Object.keys(cleanedNested).length > 0) {
              cleaned[key] = cleanedNested;
            }
          } else {
            cleaned[key] = value;
          }
        }
      }
      return cleaned;
    }

    _log(...args) {
      if (this.config.enableLogging) {
        console.log('[PA SDK]', ...args);
      }
    }

    _error(...args) {
      console.error('[PA SDK]', ...args);
    }

    /**
     * Store attribution data for later use in follow-up events
     * @private
     */
    _storeAttributionData(productRefId, clickData) {
      if (!this.session.customerId || !productRefId) {
        return;
      }

      const typeSuffix = clickData.isSponsored ? 's' : 'o';
      const storageKey = `${this.config.cookiePrefix}attribution_${this.session.customerId}_${productRefId}_${typeSuffix}`;
      const mapKey = `${productRefId}_${typeSuffix}`;
      const attributionData = {
        clickId: clickData.clickId,
        eventTime: clickData.eventTime,
        currentUrl: clickData.currentUrl,
        referralUrl: clickData.referralUrl,
        actionType: clickData.actionType,
        contextType: clickData.contextType,
        redirectUrl: clickData.redirectUrl,
        clickPosition: clickData.clickPosition,
        slot: clickData.slot,
        widgetId: clickData.widgetId,
        routeId: clickData.routeId,
        recommenderId: clickData.recommenderId,
        campaignId: clickData.campaignId,
        tacticId: clickData.tacticId,
        tacticLabel: clickData.tacticLabel,
        bannerId: clickData.bannerId,
        placementId: clickData.placementId,
        retailBoostCollectionCampaignId: clickData.retailBoostCollectionCampaignId,
        adSetId: clickData.adSetId,
        adSetVersion: clickData.adSetVersion,
        costPerClick: clickData.costPerClick,
        costPerAction: clickData.costPerAction,
        costPerMille: clickData.costPerMille,
        timeStamp: clickData.timeStamp,
        hmacSalt: clickData.hmacSalt,
        hmac: clickData.hmac,
        supplierId: clickData.supplierId,
        isSponsored: clickData.isSponsored,
        storedAt: Date.now(),
        expiresAt: Date.now() + this.config.attributionWindow
      };

      try {
        // Store in memory cache for current session
        this.attributionData.set(mapKey, attributionData);

        // Store persistently
        if (this.config.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
          localStorage.setItem(storageKey, JSON.stringify(attributionData));
        } else {
          const expires = new Date(attributionData.expiresAt).toUTCString();
          this._setCookie(storageKey, JSON.stringify(attributionData), expires);
        }

        this._log('Attribution data stored for product:', productRefId, attributionData);
      } catch (error) {
        this._error('Failed to store attribution data:', error);
      }
    }

    /**
     * Get stored attribution data of a specific type
     * @private
     */
    _getAttributionDataFor(productRefId, isSponsored) {
      const typeSuffix = isSponsored ? 's' : 'o';
      const mapKey = `${productRefId}_${typeSuffix}`;
      const storageKey = `${this.config.cookiePrefix}attribution_${this.session.customerId}_${productRefId}_${typeSuffix}`;

      // First check memory cache
      if (this.attributionData.has(mapKey)) {
        const data = this.attributionData.get(mapKey);
        if (data.expiresAt > Date.now()) {
          return data;
        } else {
          this.attributionData.delete(mapKey);
        }
      }

      // Then check persistent storage
      try {
        let storedData;
        if (this.config.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
          storedData = localStorage.getItem(storageKey);
        } else {
          storedData = this._getCookie(storageKey);
        }

        if (storedData) {
          const attributionData = JSON.parse(storedData);

          if (attributionData.expiresAt > Date.now()) {
            this.attributionData.set(mapKey, attributionData);
            return attributionData;
          } else {
            this._cleanupExpiredAttributionData(productRefId, isSponsored);
          }
        }
      } catch (error) {
        this._error('Failed to retrieve attribution data:', error);
      }

      return null;
    }

    /**
     * Get stored attribution data for a product
     * prioritising sponsored clicks
     * @private
     */
    _getAttributionData(productRefId) {
      if (!this.session.customerId || !productRefId) {
        return null;
      }

      return this._getAttributionDataFor(productRefId, true) ||
             this._getAttributionDataFor(productRefId, false);
    }

    /**
     * Merge attribution data into event data
     * @private
     */
    _mergeAttributionData(eventData, attributionData) {
      return {
        ...eventData,
        // Core attribution fields
        recommenderId: attributionData.recommenderId,
        campaignId: attributionData.campaignId,
        tacticId: attributionData.tacticId,
        tacticLabel: attributionData.tacticLabel,
        bannerId: attributionData.bannerId,
        placementId: attributionData.placementId,
        widgetId: attributionData.widgetId,
        routeId: attributionData.routeId,
        
        // Retail Boost fields
        retailBoostCollectionCampaignId: attributionData.retailBoostCollectionCampaignId,
        
        // Retail Media fields (only if sponsored)
        ...(attributionData.isSponsored && {
          adSetId: attributionData.adSetId,
          adSetVersion: attributionData.adSetVersion,
          costPerClick: attributionData.costPerClick,
          costPerAction: attributionData.costPerAction,
          costPerMille: attributionData.costPerMille,
          timeStamp: attributionData.timeStamp,
          hmacSalt: attributionData.hmacSalt,
          hmac: attributionData.hmac,
          supplierId: attributionData.supplierId
        })
      };
    }

    /**
     * Clean up attribution data
     * @private
     */
    _cleanupExpiredAttributionData(productRefId, isSponsored = null) {
      if (!this.session.customerId) return;

      const types = isSponsored === null ? [true, false] : [isSponsored];

      types.forEach(type => {
        const suffix = type ? 's' : 'o';
        const mapKey = `${productRefId}_${suffix}`;
        const storageKey = `${this.config.cookiePrefix}attribution_${this.session.customerId}_${productRefId}_${suffix}`;

        // Remove from memory
        this.attributionData.delete(mapKey);

        // Remove from persistent storage
        try {
          if (this.config.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
            localStorage.removeItem(storageKey);
          } else {
            this._setCookie(storageKey, '', 'Thu, 01 Jan 1970 00:00:00 UTC');
          }
        } catch (error) {
          this._error('Failed to cleanup expired attribution data:', error);
        }
      });
    }
  }

  return ParticularAudience;
})));
