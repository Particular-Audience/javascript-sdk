# Particular Audience JavaScript SDK

A comprehensive JavaScript SDK for integrating Particular Audience's personalization, retail media, and recommendation system services into your website.

## Features

- **Automatic Session Management** - Handles customer and session ID creation/persistence
- **Event Tracking** - Complete support for all PA event types (views, clicks, purchases, etc.)
- **Recommendations API** - Easy integration with PA's recommendation engine
- **Auto Product Detection** - Automatically detects and tracks product views on product pages
- **Auto Click/Impression Tracking** - Declarative tracking using HTML data attributes
- **Event Batching** - Automatically batches events for optimal performance
- **Mobile Detection** - Automatic mobile device detection for better personalization
- **Flexible Configuration** - Customizable product detection patterns and extraction methods

## Official Documentation

For complete API documentation and guides, visit:
- **Main Documentation**: https://docs.particularaudience.com
- **Getting Started**: https://docs.particularaudience.com/getting-started
- **API Overview**: https://docs.particularaudience.com/api-overview

## Installation

### Via NPM

```bash
npm install @particularaudience/sdk
```

```javascript
// ES6 modules
import ParticularAudience from '@particularaudience/sdk';

// CommonJS
const ParticularAudience = require('@particularaudience/sdk');
```

### Via Script Tag

```html
<script src="https://unpkg.com/@particularaudience/sdk@latest/pa-sdk.js"></script>
<!-- SDK will be available as global ParticularAudience -->
```

### Via CDN (JSDelivr)

```html
<script src="https://cdn.jsdelivr.net/npm/@particularaudience/sdk@latest/pa-sdk.js"></script>
```

## Quick Start

### 1. Set Up Backend Proxy

Since the PA API requires authentication, you'll need to set up a backend proxy that handles the authentication and forwards requests. See the `backend-proxy-example.js` for a complete Node.js/Express implementation.

### 2. Initialize the SDK

See PA Docs: [Config API](https://docs.particularaudience.com/config) | [Authentication](https://docs.particularaudience.com/authentication)

```javascript
// Initialize the SDK with your configuration
const paSDK = new ParticularAudience({
  proxyUrl: '/api/pa',           // Your backend proxy endpoint
  enableLogging: true,           // Enable console logging
  autoTrackProductViews: true,   // Auto-detect and track product views on page load
  autoTrackClicks: true,         // Auto-track clicks on marked elements
  autoTrackImpressions: true,    // Auto-track impressions
  sessionDuration: 30 * 60 * 1000, // Session duration (30 minutes)
  storageType: 'cookie'          // 'cookie' or 'localStorage'
});
```

### 3. Get Recommendations

See PA Docs: [Recommendations API Overview](https://docs.particularaudience.com/recommendations-api/overview) | [Parameters](https://docs.particularaudience.com/recommendations-api/parameters) | [Response Schema](https://docs.particularaudience.com/recommendations-api/response-schema) | [Examples](https://docs.particularaudience.com/recommendations-api/examples)

```javascript
// Get recommendations for current page
const recommendations = await paSDK.getRecommendations({
  currentUrl: window.location.href,
  expandProductDetails: true
});

// Get recommendations for specific product
const similarProducts = await paSDK.getRecommendations({
  refId: 'PRODUCT-123',
  expandProductDetails: true
});

// Get personalized recommendations with cart context
const personalizedRecs = await paSDK.getRecommendations({
  productsInCart: ['PROD-1', 'PROD-2'],
  expandProductDetails: true
});
```

### 4. Track Events

See PA Docs: [Event Triggering Guide](https://docs.particularaudience.com/events/event-triggering-guide) | [View Products Attribution](https://docs.particularaudience.com/misc/view-products-attribution-handling)

#### View Product
PA Docs: [View Products Event](https://docs.particularaudience.com/events/event-view-products)
```javascript
await paSDK.trackViewProduct({
  refId: 'PRODUCT-123',
  widgetId: 'widget-id',
  routeId: 'route-id'
});
```

#### Track Click
PA Docs: [Click Event](https://docs.particularaudience.com/events/event-clicks)
```javascript
await paSDK.trackClick({
  refId: 'PRODUCT-123',
  actionType: 1,        // OpenProductPage
  contextType: 1,       // RecommendationWidget
  widgetId: 'widget-id',
  routeId: 'route-id',
  clickPosition: 1
});
```

#### Add to Cart
PA Docs: [Add to Cart Event](https://docs.particularaudience.com/events/event-add-to-carts)
```javascript
await paSDK.trackAddToCart({
  product: {
    refId: 'PRODUCT-123',
    quantity: 2,
    price: 49.99
  },
  clickId: 'click-id-from-previous-event'
});
```

#### Track Checkout
PA Docs: [Checkout Event](https://docs.particularaudience.com/events/event-checkouts)
```javascript
await paSDK.trackCheckout({
  subTotal: 99.98,
  totalPrice: 109.98,
  currencyCode: 'USD',
  products: [
    {
      refId: 'PRODUCT-123',
      quantity: 2,
      price: 49.99
    }
  ]
});
```

#### Track Purchase
PA Docs: [Purchase Event](https://docs.particularaudience.com/events/event-purchases)
```javascript
await paSDK.trackPurchase({
  orderId: 'ORDER-123',
  paymentMethod: 'credit_card',
  currencyCode: 'USD',
  products: [
    {
      refId: 'PRODUCT-123',
      quantity: 1,
      price: 49.99
    }
  ]
});
```

#### Track Search
PA Docs: [Search Terms Event](https://docs.particularaudience.com/events/event-search-terms)
```javascript
await paSDK.trackSearch({
  searchTerm: 'wireless headphones',
  numberOfResults: 42,
  widgetId: 'search-widget',
  routeId: 'search-route'
});
```

#### Track Slot Impression
PA Docs: [Slot Impressions Event](https://docs.particularaudience.com/events/event-slot-impressions)
```javascript
await paSDK.trackSlotImpression({
  refId: 'PRODUCT-123',
  widgetId: 'widget-id',
  routeId: 'route-id',
  tacticId: 'tactic-id'
});
```

## Auto-Tracking Features

### Automatic Product View Detection

When `autoTrackProductViews` is enabled, the SDK automatically detects if the current page is a product page and tracks a "View Product" event. 

#### Default Detection Methods

By default, it detects product pages using:

- **URL patterns**: `/product/123`, `/p/123`, `?id=123`, `?product=123`, `?sku=123`
- **Meta tags**: `<meta property="product:id" content="123">` or `<meta name="product-id" content="123">`
- **Structured data**: JSON-LD with `@type: "Product"` and `sku` or `productID` fields

#### Custom Product Detection

If your site uses different URL patterns or product identification methods, you can customize the detection:

```javascript
const paSDK = new ParticularAudience({
  // Custom URL patterns (regex with capture group)
  productUrlPatterns: [
    /\/item\/(\d+)/,           // /item/123
    /\/products\/([^\/]+)/,    // /products/abc-123
    /\/shop\/.*\/([^\/]+)$/    // /shop/category/product-name
  ],
  
  // Custom meta tag selectors
  productMetaSelectors: [
    'meta[name="product-sku"]',
    'meta[property="og:product:id"]',
    '[data-product-id]'
  ],
  
  // Or provide a custom function for complete control
  customProductIdExtractor: () => {
    // Your custom logic here
    const productElement = document.querySelector('.product-info');
    return productElement?.dataset.productId || null;
    
    // Or extract from URL differently
    // const match = window.location.pathname.match(/\/items\/(.+)/);
    // return match ? match[1] : null;
  }
});
```

#### Detection Priority

The SDK tries detection methods in this order:
1. **Custom extractor function** (if provided)
2. **URL patterns** (in the order specified)
3. **Meta tag selectors** (in the order specified)  
4. **Structured data** (JSON-LD)

**Note**: This only tracks product views, not general page views. If no product is detected, no event is sent.

**Works with SPAs**: Automatically detects route changes and re-evaluates product detection.

### Automatic Click Tracking

Add data attributes to elements you want to track automatically:

```html
<div class="product-card" 
     data-pa-track-click
     data-pa-ref-id="PRODUCT-123"
     data-pa-action-type="1"
     data-pa-context-type="1"
     data-pa-widget-id="widget-123">
  <!-- Product content -->
</div>
```

### Automatic Impression Tracking

Elements with the `data-pa-track-impression` attribute will be automatically tracked when they become visible:

```html
<div class="recommendation-slot"
     data-pa-track-impression
     data-pa-ref-id="PRODUCT-123"
     data-pa-widget-id="widget-123"
     data-pa-route-id="route-456">
  <!-- Recommendation content -->
</div>
```

## API Reference

### Constructor Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `proxyUrl` | string | '/api/pa' | Backend proxy endpoint URL |
| `enableLogging` | boolean | false | Enable console logging |
| `autoTrackProductViews` | boolean | true | Auto-detect and track product views |
| `autoTrackClicks` | boolean | true | Auto-track clicks on marked elements |
| `autoTrackImpressions` | boolean | true | Auto-track element impressions |
| `sessionDuration` | number | 1800000 | Session duration in milliseconds (30 min) |
| `storageType` | string | 'cookie' | Storage method: 'cookie' or 'localStorage' |
| `cookiePrefix` | string | 'pa_' | Prefix for storage keys (cookies or localStorage) |
| `attributionWindow` | number | 2592000000 | Attribution data retention in milliseconds (30 days) |
| `productUrlPatterns` | RegExp[] | [see defaults] | Regex patterns to extract product ID from URL |
| `productMetaSelectors` | string[] | [see defaults] | CSS selectors for product ID meta tags |
| `customProductIdExtractor` | function | null | Custom function to extract product ID |

### Methods

#### Session Management

- `createSession(customerId?)` - Create or refresh session
- `session` - Access current session data (read-only)

#### Recommendations

- `getRecommendations(params)` - Get product recommendations

#### Event Tracking

- `trackViewProduct(data)` - Track product view
- `trackClick(data)` - Track click event
- `trackAddToCart(data)` - Track add to cart
- `trackCheckout(data)` - Track checkout
- `trackPurchase(data)` - Track purchase
- `trackSearch(data)` - Track search
- `trackSlotImpression(data)` - Track slot impression

## Event Types Reference

### Action Types (for Click Events)

| Name | Value | Description |
|------|-------|-------------|
| OpenProductPage | 1 | User clicked to view product detail |
| AddProductToCart | 2 | User clicked add to cart |
| SeeSimilar | 3 | User clicked see similar products |
| OpenProductListPage | 4 | User clicked to view product list |
| PopularSearchLink | 5 | User clicked popular search |
| QuickLink | 6 | User clicked quick navigation |
| OpenBrandPage | 7 | User clicked to view brand |
| TextLink | 8 | User clicked text link |
| AddProductToWishlist | 9 | User clicked add to wishlist |
| ClickBuyNow | 10 | User clicked buy now |
| ClickExternalBuyNow | 11 | User clicked external buy |
| ClickPhoneNumber | 12 | User clicked phone number |
| ViewInformation | 13 | User clicked view info |
| ClickFilterSort | 14 | User clicked filter/sort |
| ClickDidYouMeanTerm | 15 | User clicked spell correction |
| CloseModal | 16 | User closed modal |

### Context Types (for Click Events)

| Name | Value | Description |
|------|-------|-------------|
| RecommendationWidget | 1 | Recommendation widget |
| VisualSearchWidget | 2 | Visual search widget |
| SearchWidget | 3 | Search widget |
| NativeRecommendationWidget | 4 | Native recommendation |
| ExitIntentWidget | 5 | Exit intent popup |
| PersonalizeWidget | 6 | Personalized widget |
| PersonaliseBrandWidget | 7 | Brand personalization |
| BundleWidget | 8 | Product bundle |
| PriceBeatWidget | 9 | Price beat widget |
| KeywordTargetingWidget | 10 | Keyword targeting |
| NativeButton | 11 | Native button |

## Backend Proxy Setup

The SDK requires a backend proxy to handle API authentication. Here's a minimal Express example:

```javascript
const express = require('express');
const app = express();

// See backend-proxy-example.js for full implementation
const { ParticularAudienceProxy } = require('./backend-proxy-example');

const paProxy = new ParticularAudienceProxy({
  clientId: process.env.PA_CLIENT_ID,
  clientSecret: process.env.PA_CLIENT_SECRET
});

app.use('/api/pa', paProxy.router);

app.listen(3000);
```

## Session Management

See PA Docs: [Config API](https://docs.particularaudience.com/config)

The SDK automatically manages customer and session IDs:

1. **Customer ID**: Persists across sessions (stored in cookies or localStorage)
2. **Session ID**: Created for each session, expires after inactivity
3. **Automatic Extension**: Session is extended on each user activity
4. **Control Cohort**: Automatically handled for A/B testing

### Storage Options

You can choose how session data is stored:

```javascript
// Use cookies (default) - works across subdomains
const paSDK = new ParticularAudience({
  storageType: 'cookie'
});

// Use localStorage - more storage space, same-origin only
const paSDK = new ParticularAudience({
  storageType: 'localStorage'
});
```

**Cookies vs localStorage:**

| Feature | Cookies | localStorage |
|---------|---------|-------------|
| **Cross-subdomain** | ✅ Yes | ❌ No |
| **Sent with requests** | ✅ Yes | ❌ No |
| **Storage limit** | ~4KB | ~5-10MB |
| **Expiration** | ✅ Automatic | ⚠️ Manual only |
| **Privacy friendly** | ⚠️ Moderate | ✅ Better |
| **Works offline** | ✅ Yes | ✅ Yes |

**Recommendation**: Use `'cookie'` (default) unless you have specific privacy requirements or cookie restrictions.

### About First-Party vs Third-Party Cookies

The Particular Audience SDK exclusively uses **first-party cookies** when storage type is set to `'cookie'`. Understanding the difference is important for privacy compliance and functionality:

**First-Party (1P) Cookies** (used by PA SDK):
- Set by the same domain the user is visiting
- Persist across page reloads and sessions on the same domain
- Generally accepted by browsers and privacy settings
- Not blocked by most ad blockers or privacy tools
- Compliant with privacy regulations when properly disclosed
- Support cross-subdomain sharing (e.g., `www.example.com` and `shop.example.com`)

**Third-Party (3P) Cookies** (NOT used by PA SDK):
- Set by domains different from the one being visited
- Often used for cross-site tracking and advertising
- Increasingly blocked by browsers (Safari ITP, Chrome Privacy Sandbox)
- Subject to stricter privacy regulations
- May be blocked by ad blockers and privacy tools

The PA SDK's use of first-party cookies ensures better reliability, privacy compliance, and browser compatibility compared to third-party tracking solutions.

### Attribution Data Storage

Attribution data uses the same storage method as session data, with these considerations:

| Feature | Cookies | localStorage |
|---------|---------|-------------|
| **Attribution persistence** | ✅ 30 days default | ✅ 30 days default |
| **Cross-subdomain attribution** | ✅ Yes | ❌ No |
| **Storage limit** | ~4KB per cookie | ~5-10MB total |
| **Automatic cleanup** | ✅ Expires automatically | ⚠️ Requires cleanup |

**For Attribution**: Cookies are recommended for cross-subdomain attribution tracking.

## Best Practices

See PA Docs: [Best Practices](https://docs.particularaudience.com/recommendations-api/best-practices) | [Event Triggering Guide](https://docs.particularaudience.com/events/event-triggering-guide)

1. **Initialize Early**: Initialize the SDK as early as possible in your page load
2. **Use Auto-Tracking**: Leverage auto-tracking features to reduce manual implementation
3. **Batch Events**: The SDK automatically batches events - avoid forcing immediate sends
4. **Handle Errors**: Always wrap SDK calls in try-catch blocks
5. **Use Data Attributes**: Use data attributes for declarative tracking
6. **Fresh Recommendations**: Recommendations are always fetched fresh from the server for personalization

### Attribution Data Management

**Automatic Attribution Tracking**: The SDK now automatically handles attribution data storage and retrieval as required by the [Event Triggering Guide](https://docs.particularaudience.com/events/event-triggering-guide).

### How Attribution Works:

1. **Click Event Storage**: When you track a click event, the SDK automatically stores attribution data for that product
2. **Automatic Retrieval**: Add to cart, checkout, and purchase events automatically include stored attribution data
3. **Separate Tracking**: Sponsored and organic clicks are tracked separately for proper attribution
4. **Priority Handling**: Sponsored attribution is used first; organic attribution is only used if no sponsored data exists
5. **Attribution Window**: Data is stored for 30 days by default (configurable)
6. **Cross-Session Persistence**: Attribution data persists across browser sessions using cookies or localStorage
7. **Automatic Cleanup**: Stored attribution is cleared once the window expires or after it has been used for a purchase

### Configuration:

```javascript
const paSDK = new ParticularAudience({
  attributionWindow: 30 * 24 * 60 * 60 * 1000, // 30 days (default)
  storageType: 'cookie' // or 'localStorage'
});
```

### Event Flow:

```javascript
// 1. Track click event - attribution data is automatically stored
await paSDK.trackClick({
  refId: 'PRODUCT-123',
  actionType: 1,
  contextType: 1,
  widgetId: 'widget-123',
  routeId: 'route-456',
  // Retail Media fields (for sponsored content)
  adSetId: 'ad-set-123',
  costPerClick: 0.5
});

// 2. Later events automatically use stored attribution data
await paSDK.trackAddToCart({
  product: { refId: 'PRODUCT-123', quantity: 1, price: 49.99 }
  // clickId and attribution fields are automatically included
});

// 3. Checkout and purchase events also include attribution
await paSDK.trackPurchase({
  orderId: 'ORDER-123',
  products: [{ refId: 'PRODUCT-123', quantity: 1, price: 49.99 }]
  // Attribution data is automatically merged for each product
});
```

Once a purchase is tracked, the SDK discards the stored sponsored or organic
attribution used for the products involved, ensuring new clicks are required
for future purchases.

### Manual Attribution (if needed):

```javascript
// If you need to manually provide attribution data
await paSDK.trackAddToCart({
  product: { refId: 'PRODUCT-123', quantity: 1, price: 49.99 },
  clickId: 'manual-click-id-123',
  widgetId: 'widget-123',
  routeId: 'route-456',
  // All other attribution fields...
});
```

### Retail Media Attribution:

Sponsored content automatically includes all required retail media fields:
- `adSetId`, `adSetVersion`, `costPerClick`, `costPerAction`, `costPerMille`
- `timeStamp`, `hmacSalt`, `hmac`, `supplierId`
- `retailBoostCollectionCampaignId` (for retailer boost campaigns)

These fields are automatically included in add to cart, checkout, and purchase events when the original click was on sponsored content.

## Example Implementation

See `example.html` for a complete working example with:
- SDK initialization
- Product recommendations
- Event tracking
- Auto-tracking setup
- Error handling

## Browser Support

- Chrome 60+
- Firefox 55+
- Safari 12+
- Edge 79+
- Mobile browsers (iOS Safari 12+, Chrome Mobile)

## Security Considerations

1. **Never expose API credentials** in frontend code
2. **Always use a backend proxy** for API authentication
3. **Implement rate limiting** in your proxy
4. **Validate all data** before sending to PA API
5. **Use HTTPS** for all communications

## Troubleshooting

### SDK not initializing
- Check proxy URL configuration
- Verify backend proxy is running
- Check browser console for errors

### Events not tracking
- Ensure session is created (check `paSDK.session`)
- Verify event data format
- Check network tab for API calls

### Recommendations not loading
- Verify proxy authentication is working
- Check recommendation parameters
- Ensure route configuration in PA dashboard

## License

[Your License]

## Support

For issues and questions, please contact Particular Audience support.