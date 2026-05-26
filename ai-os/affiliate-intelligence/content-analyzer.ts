import { ContentMetadata, AudienceProfile } from './types';

export const NICHE_KEYWORDS: Record<string, string[]> = {
  finance: ['investing', 'stocks', 'portfolio', 'dividend', 'etf', 'trading', 'market', 'financial'],
  crypto: ['bitcoin', 'ethereum', 'cryptocurrency', 'blockchain', 'defi', 'nft', 'trading', 'exchange'],
  'real-estate': ['property', 'real estate', 'real-estate', 'house', 'apartment', 'rental', 'flip', 'cashflow'],
  'online-business': ['ecommerce', 'e-commerce', 'dropshipping', 'shopify', 'affiliate', 'marketing', 'sales', 'business'],
  ai: ['artificial intelligence', 'ai', 'machine learning', 'chatgpt', 'automation', 'algorithm'],
  'personal-development': ['productivity', 'habits', 'mindset', 'success', 'growth', 'learning', 'improvement'],
};

export const CONTENT_TYPE_KEYWORDS: Record<string, string[]> = {
  educational: ['how to', 'tutorial', 'guide', 'learn', 'explain', 'teach', 'course', 'masterclass'],
  review: ['review', 'comparison', 'vs', 'best', 'analysis', 'tested', 'honest'],
  tutorial: ['step by step', 'walkthrough', 'setup', 'configure', 'installation', 'how-to'],
  news: ['news', 'update', 'breaking', 'latest', 'announcement', 'highlights'],
  opinion: ['opinion', 'thoughts', 'perspective', 'take', 'rant', 'thoughts on'],
  interview: ['interview', 'podcast', 'conversation', 'talk with', 'featuring', 'guest'],
};

export const AUDIENCE_TYPE_INFERENCE: Record<string, string[]> = {
  retail: ['beginner', 'new', 'start', 'first time', 'basics', 'everyone'],
  investor: ['institutional', 'portfolio', 'stock', 'dividend', 'wealth', 'investment'],
  entrepreneur: ['business', 'startup', 'ecommerce', 'marketing', 'sales', 'growth', 'scale'],
};

export const INTEREST_INFERENCE_KEYWORDS: Record<string, string[]> = {
  // Finance & Investment
  investing: ['invest', 'stock', 'market', 'portfolio', 'dividend', 'trading'],
  crypto: ['bitcoin', 'ethereum', 'crypto', 'blockchain', 'defi', 'token'],
  trading: ['trading', 'day trade', 'swing trade', 'chart', 'technical analysis'],
  portfolio: ['portfolio', 'asset allocation', 'diversification', 'etf'],

  // Real Estate
  'real-estate': ['property', 'real estate', 'house', 'apartment', 'rental', 'flip'],
  'property-investing': ['property investment', 'rental income', 'cashflow property'],
  'real-estate-deals': ['deal', 'wholesale', 'off-market', 'negotiation'],

  // Business
  'online-business': ['online business', 'ecommerce', 'dropshipping', 'startup'],
  ecommerce: ['ecommerce', 'online store', 'shopify', 'amazon'],
  seo: ['seo', 'search engine', 'keyword', 'ranking'],
  marketing: ['marketing', 'social media', 'email', 'ads', 'campaign'],

  // AI & Tech
  ai: ['artificial intelligence', 'ai', 'chatgpt', 'machine learning'],
  'ai-tools': ['ai tools', 'automation', 'productivity'],

  // Other
  productivity: ['productivity', 'organization', 'tools', 'workflow'],
  'youtube-tools': ['youtube', 'channel', 'creator', 'analytics'],
  'passive-income': ['passive income', 'residual income', 'recurring'],
};

export class ContentAnalyzer {
  /**
   * Detect niche/category from content metadata
   */
  detectNiche(content: ContentMetadata): string {
    const fullText = `${content.title} ${content.description} ${content.tags.join(' ')}`.toLowerCase();

    let bestMatch = 'general';
    let bestScore = 0;

    for (const [niche, keywords] of Object.entries(NICHE_KEYWORDS)) {
      let matches = 0;
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          matches++;
        }
      }

      const score = matches / keywords.length;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = niche;
      }
    }

    return bestMatch;
  }

  /**
   * Detect content type (educational, review, tutorial, etc.)
   */
  detectContentType(content: ContentMetadata): string {
    const fullText = `${content.title} ${content.description}`.toLowerCase();

    let bestMatch = 'educational'; // default
    let bestScore = 0;

    for (const [type, keywords] of Object.entries(CONTENT_TYPE_KEYWORDS)) {
      let matches = 0;
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          matches++;
        }
      }

      const score = matches;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = type;
      }
    }

    return bestMatch;
  }

  /**
   * Infer audience type from content
   */
  inferAudienceType(content: ContentMetadata): string {
    const fullText = `${content.title} ${content.description}`.toLowerCase();

    const scores: Record<string, number> = {
      retail: 0,
      investor: 0,
      entrepreneur: 0,
    };

    for (const [type, keywords] of Object.entries(AUDIENCE_TYPE_INFERENCE)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          scores[type] = (scores[type] || 0) + 1;
        }
      }
    }

    let bestType = 'mixed';
    let bestScore = 0;

    for (const [type, score] of Object.entries(scores)) {
      if (score > bestScore) {
        bestScore = score;
        bestType = type;
      }
    }

    return bestScore > 0 ? bestType : 'mixed';
  }

  /**
   * Extract key interests/keywords from content
   */
  extractInterests(content: ContentMetadata): string[] {
    const fullText = `${content.title} ${content.description} ${content.tags.join(' ')}`.toLowerCase();
    const interests: string[] = [];

    const interestSet = new Set<string>();

    for (const [interest, keywords] of Object.entries(INTEREST_INFERENCE_KEYWORDS)) {
      for (const keyword of keywords) {
        if (fullText.includes(keyword)) {
          interestSet.add(interest);
          break; // Found this interest, move to next
        }
      }
    }

    return Array.from(interestSet);
  }

  /**
   * Estimate purchasing intent (high/medium/low) from content
   */
  estimatePurchasingIntent(content: ContentMetadata): 'high' | 'medium' | 'low' {
    const fullText = `${content.title} ${content.description}`.toLowerCase();

    // High intent: actionable, solution-focused, commercial intent
    const highIntentKeywords = [
      'best',
      'how to',
      'review',
      'comparison',
      'vs',
      'recommended',
      'setup',
      'tutorial',
      'guide',
      'buy',
      'get started',
    ];

    // Low intent: theoretical, general knowledge, no action
    const lowIntentKeywords = [
      'what is',
      'explain',
      'history of',
      'overview',
      'introduction',
      'basics',
      'understand',
      'theory',
    ];

    let highCount = 0;
    let lowCount = 0;

    for (const keyword of highIntentKeywords) {
      if (fullText.includes(keyword)) highCount++;
    }

    for (const keyword of lowIntentKeywords) {
      if (fullText.includes(keyword)) lowCount++;
    }

    if (highCount > lowCount) return 'high';
    if (lowCount > highCount) return 'low';
    return 'medium';
  }

  /**
   * Create audience profile from content analysis
   */
  createAudienceProfileFromContent(content: ContentMetadata): AudienceProfile {
    return {
      primary_countries: content.estimated_viewer_countries,
      interests: this.extractInterests(content),
      audience_type: this.inferAudienceType(content) as 'retail' | 'investor' | 'entrepreneur' | 'mixed',
      purchasing_intent: this.estimatePurchasingIntent(content),
    };
  }

  /**
   * Comprehensive content analysis
   */
  analyzeContent(content: ContentMetadata): {
    niche: string;
    content_type: string;
    audience_type: string;
    interests: string[];
    purchasing_intent: 'high' | 'medium' | 'low';
    audience_profile: AudienceProfile;
  } {
    return {
      niche: this.detectNiche(content),
      content_type: this.detectContentType(content),
      audience_type: this.inferAudienceType(content),
      interests: this.extractInterests(content),
      purchasing_intent: this.estimatePurchasingIntent(content),
      audience_profile: this.createAudienceProfileFromContent(content),
    };
  }
}
