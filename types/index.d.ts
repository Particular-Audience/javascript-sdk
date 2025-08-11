// TypeScript definitions for Particular Audience SDK

export interface PASDKConfig {
  proxyUrl?: string;
  sessionDuration?: number;
  enableLogging?: boolean;
  storageType?: 'cookie' | 'localStorage';
  cookiePrefix?: string;
  attributionWindow?: number;
  autoTrackProductViews?: boolean;
  autoTrackClicks?: boolean;
  autoTrackImpressions?: boolean;
  productUrlPatterns?: RegExp[];
  productMetaSelectors?: string[];
  customProductIdExtractor?: () => string | null;
}

export interface PASession {
  customerId: string | null;
  sessionId: string | null;
  sessionTimeout: number | null;
  controlCohort: boolean;
}

export interface PARecommendationParams {
  currentUrl?: string;
  routeName?: string;
  customerId?: string;
  refId?: string;
  productsInCart?: string[];
  expandProductDetails?: boolean;
  showInStockOnly?: boolean;
  returnMultipleProductsInSlot?: boolean;
  maxNumberOfProductWithinASlot?: number;
  languageTag?: string;
  currencyCode?: string;
  indexFilterValue?: string;
  searchQuery?: string;
  customerSegments?: string[];
}

export interface PAProduct {
  refId: string;
  quantity: number;
  price: number;
  routeId?: string;
  widgetId?: string;
  recommenderId?: string;
  campaignId?: string;
  tacticId?: string;
  clickId?: string;
  referralUrl?: string;
  tacticLabel?: string;
  retailBoostCollectionCampaignId?: string;
  adSetId?: string;
  adSetVersion?: number;
  costPerClick?: number;
  costPerAction?: number;
  costPerMille?: number;
  timeStamp?: number;
  hmacSalt?: string;
  hmac?: string;
  bannerId?: string;
  placementId?: string;
}

export interface PAViewProductEvent {
  refId: string;
  currentUrl?: string;
  widgetId?: string;
  routeId?: string;
  recommenderId?: string;
  campaignId?: string;
  tacticId?: string;
  referralUrl?: string;
  bannerId?: string;
}

export interface PAClickEvent {
  refId?: string;
  currentUrl?: string;
  clickId?: string;
  actionType: number;
  contextType: number;
  contextId?: string;
  contextData?: string;
  redirectUrl?: string;
  referralUrl?: string;
  personalized?: boolean;
  clickPosition?: number;
  slot?: number;
  widgetId?: string;
  routeId?: string;
  recommenderId?: string;
  campaignId?: string;
  tacticId?: string;
  tacticLabel?: string;
  bannerId?: string;
  placementId?: string;
  retailBoostCollectionCampaignId?: string;
  adSetId?: string;
  adSetVersion?: number;
  costPerClick?: number;
  costPerAction?: number;
  costPerMille?: number;
  timeStamp?: number;
  hmacSalt?: string;
  hmac?: string;
  supplierId?: string;
}

export interface PAAddToCartEvent {
  product: {
    refId: string;
    quantity: number;
    price: number;
  };
  clickId: string;
  currentUrl?: string;
  referralUrl?: string;
  recommenderId?: string;
  campaignId?: string;
  tacticId?: string;
  tacticLabel?: string;
  bannerId?: string;
  placementId?: string;
  retailBoostCollectionCampaignId?: string;
  adSetId?: string;
  adSetVersion?: number;
  costPerClick?: number;
  costPerAction?: number;
  costPerMille?: number;
  timeStamp?: number;
  hmacSalt?: string;
  hmac?: string;
}

export interface PACheckoutEvent {
  currentUrl?: string;
  subTotal?: number;
  discount?: number;
  totalPrice?: number;
  deliveryFee?: number;
  currencyCode?: string;
  products: PAProduct[];
  priceBeatPromotions?: Array<{
    code: string;
    discount: number;
  }>;
}

export interface PAPurchaseEvent {
  orderId: string;
  paymentMethod?: string;
  currencyCode?: string;
  currentUrl?: string;
  products: PAProduct[];
  priceBeatPromotions?: Array<{
    code: string;
    discount: number;
  }>;
  recommenderId?: string;
  campaignId?: string;
  tacticId?: string;
}

export interface PASearchEvent {
  searchTerm: string;
  numberOfResults: number;
  currentUrl?: string;
  widgetId: string;
  routeId: string;
  tacticId: string;
  campaignId: string;
  recommenderId: string;
}

export interface PASlotImpressionEvent {
  refId: string;
  currentUrl?: string;
  widgetId: string;
  routeId: string;
  recommenderId?: string;
  campaignId?: string;
  tacticId?: string;
  tacticLabel?: string;
  bannerId?: string;
  personalized?: boolean;
  placementId?: string;
  retailBoostCollectionCampaignId?: string;
  adSetId?: string;
  adSetVersion?: number;
  costPerMille?: number;
  costPerClick?: number;
  costPerAction?: number;
  timeStamp?: number;
  hmacSalt?: string;
  hmac?: string;
  supplierId?: string;
  priceBeat?: {
    clientPaidPrice: number;
    competitorPrice: number;
    clientOriginalPrice: number;
    competitorId: string;
    priceBeatTrigger: string;
  };
}

declare class ParticularAudience {
  constructor(config?: PASDKConfig);
  
  readonly session: PASession;
  
  createSession(customerId?: string): Promise<PASession>;
  
  getRecommendations(params?: PARecommendationParams): Promise<any>;
  
  trackViewProduct(eventData: PAViewProductEvent): Promise<any>;
  
  trackClick(eventData: PAClickEvent): Promise<any>;
  
  trackAddToCart(eventData: PAAddToCartEvent): Promise<any>;
  
  trackCheckout(eventData: PACheckoutEvent): Promise<any>;
  
  trackPurchase(eventData: PAPurchaseEvent): Promise<any>;
  
  trackSearch(eventData: PASearchEvent): Promise<any>;
  
  trackSlotImpression(eventData: PASlotImpressionEvent): Promise<any>;
}

export default ParticularAudience;