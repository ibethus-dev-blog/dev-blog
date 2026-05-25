/**
 * Rate Limiter — Token Bucket Algorithm
 * 
 * Provides per-IP and per-user rate limiting for form submissions.
 * When limits are exceeded, returns a warning with retry-after information.
 * 
 * Configuration via Hugo site params (see hugo.yml):
 *   params.rateLimit.enabled: true/false
 *   params.rateLimit.maxTokens: maximum tokens in bucket (default: 5)
 *   params.rateLimit.refillRate: tokens per second (default: 0.5)
 *   params.rateLimit.windowSeconds: cooldown window in seconds (default: 60)
 *   params.rateLimit.retryAfterHeader: send Retry-After warnings (default: true)
 */
(function () {
  'use strict';

  /**
   * TokenBucket — classic token bucket rate limiter.
   */
  class TokenBucket {
    /**
     * @param {number} maxTokens - Maximum bucket capacity
     * @param {number} refillRate - Tokens added per second
     */
    constructor(maxTokens, refillRate) {
      this.maxTokens = maxTokens;
      this.refillRate = refillRate;
      this.tokens = maxTokens;
      this.lastRefill = Date.now();
    }

    /** Refill tokens based on elapsed time since last check. */
    refill() {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
      this.lastRefill = now;
    }

    /**
     * Attempt to consume a token.
     * @returns {{ allowed: boolean, retryAfter: number|null }}
     */
    consume() {
      this.refill();
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return { allowed: true, retryAfter: null };
      }
      // Calculate when next token will be available
      const retryAfter = Math.ceil((1 - this.tokens) / this.refillRate);
      return { allowed: false, retryAfter };
    }
  }

  /** In-memory store: key -> TokenBucket */
  const buckets = new Map();

  /**
   * Get or create a token bucket for the given key.
   * @param {string} key - Identifier (e.g., "ip:192.168.1.1" or "user:ibethus")
   * @param {number} maxTokens
   * @param {number} refillRate
   * @returns {TokenBucket}
   */
  function getBucket(key, maxTokens, refillRate) {
    if (!buckets.has(key)) {
      buckets.set(key, new TokenBucket(maxTokens, refillRate));
    }
    return buckets.get(key);
  }

  /**
   * Check if a request is allowed.
   * @param {object} options
   * @param {string} options.key - Unique identifier (IP, username, etc.)
   * @param {number} [options.maxTokens=5]
   * @param {number} [options.refillRate=0.5]
   * @returns {{ allowed: boolean, retryAfter: number|null }}
   */
  function checkRateLimit({ key, maxTokens = 5, refillRate = 0.5 }) {
    const bucket = getBucket(key, maxTokens, refillRate);
    return bucket.consume();
  }

  /**
   * Display rate limit exceeded warning to the user.
   * @param {number} retryAfter - Seconds until next request is allowed
   */
  function showRateLimitWarning(retryAfter) {
    // Remove existing warning if present
    const existing = document.getElementById('rate-limit-warning');
    if (existing) existing.remove();

    const warning = document.createElement('div');
    warning.id = 'rate-limit-warning';
    warning.style.cssText = `
      background: #fff3cd;
      border: 1px solid #ffc107;
      color: #856404;
      padding: 12px 16px;
      margin: 16px 0;
      border-radius: 6px;
      font-family: system-ui, sans-serif;
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 8px;
    `;
    warning.innerHTML = `
      <span>⚠️</span>
      <span>Too many requests. Please wait <strong>${retryAfter}</strong> second${retryAfter > 1 ? 's' : ''} before trying again.</span>
    `;
    
    const form = document.querySelector('form');
    if (form) {
      form.parentNode.insertBefore(warning, form);
    } else {
      document.body.prepend(warning);
    }

    // Auto-remove after retryAfter
    setTimeout(() => {
      const el = document.getElementById('rate-limit-warning');
      if (el) el.remove();
    }, retryAfter * 1000);
  }

  /**
   * Setup rate limiting on form submissions.
   * Call this with Hugo params from the partial.
   */
  window.setupRateLimiter = function (config) {
    const {
      enabled = true,
      maxTokens = 5,
      refillRate = 0.5,
      keyPrefix = 'comment',
    } = config;

    if (!enabled) return;

    document.addEventListener('submit', function (event) {
      const form = event.target.closest('form');
      if (!form) return;

      // Build a key from available identifiers
      const userId = document.querySelector('meta[name="github-user"]')?.content || 'anonymous';
      const key = `${keyPrefix}:user:${userId}`;

      const result = checkRateLimit({ key, maxTokens, refillRate });

      if (!result.allowed) {
        event.preventDefault();
        event.stopImmediatePropagation();
        showRateLimitWarning(result.retryAfter);
        console.warn(`[RateLimiter] Request blocked for "${key}". Retry after ${result.retryAfter}s.`);
        return false;
      }
    }, true); // useCapture to intercept before other handlers
  };

  // Export for testing
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { TokenBucket, checkRateLimit, getBucket };
  }
})();
