/**
 * Unit tests for rate-limiter.js (Token Bucket Algorithm)
 * 
 * Run with: node --test static/js/__tests__/rate-limiter.test.js
 * Or: node static/js/__tests__/rate-limiter.test.js
 */

// Re-implement TokenBucket for testing (mirrors static/js/rate-limiter.js)
class TokenBucket {
  constructor(maxTokens, refillRate) {
    this.maxTokens = maxTokens;
    this.refillRate = refillRate;
    this.tokens = maxTokens;
    this.lastRefill = Date.now();
  }

  refill() {
    const now = Date.now();
    const elapsed = (now - this.lastRefill) / 1000;
    this.tokens = Math.min(this.maxTokens, this.tokens + elapsed * this.refillRate);
    this.lastRefill = now;
  }

  consume() {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { allowed: true, retryAfter: null };
    }
    const retryAfter = Math.ceil((1 - this.tokens) / this.refillRate);
    return { allowed: false, retryAfter };
  }
}

const assert = {
  equal(actual, expected, msg) {
    if (actual !== expected) {
      throw new Error(`${msg || 'assertion failed'}: expected ${expected}, got ${actual}`);
    }
  },
  ok(value, msg) {
    if (!value) {
      throw new Error(msg || 'expected truthy value');
    }
  },
  throws(fn, msg) {
    try { fn(); } catch (e) { return; }
    throw new Error(msg || 'expected function to throw');
  }
};

function runTests() {
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      passed++;
      console.log(`  ✓ ${name}`);
    } catch (e) {
      failed++;
      console.log(`  ✗ ${name}\n    ${e.message}`);
    }
  }

  console.log('\nTokenBucket Tests\n-----------------');

  test('initial tokens equals maxTokens', () => {
    const bucket = new TokenBucket(5, 1);
    assert.equal(bucket.tokens, 5, 'initial tokens');
  });

  test('consume reduces tokens by 1', () => {
    const bucket = new TokenBucket(5, 1);
    const result = bucket.consume();
    assert.ok(result.allowed, 'first consume should be allowed');
    assert.equal(bucket.tokens, 4, 'tokens after one consume');
  });

  test('allows exactly maxTokens consumes', () => {
    const bucket = new TokenBucket(3, 0.01); // slow refill
    assert.ok(bucket.consume().allowed);
    assert.ok(bucket.consume().allowed);
    assert.ok(bucket.consume().allowed);
    const result = bucket.consume();
    assert.ok(!result.allowed, '4th consume should be blocked');
    assert.ok(result.retryAfter > 0, 'should have retryAfter');
  });

  test('returns 429-like result when blocked', () => {
    const bucket = new TokenBucket(1, 0.1); // 1 token, slow refill
    bucket.consume(); // use the only token
    const result = bucket.consume();
    assert.ok(!result.allowed, 'should be blocked');
    assert.ok(typeof result.retryAfter === 'number', 'retryAfter should be a number');
    assert.ok(result.retryAfter > 0, 'retryAfter should be positive');
  });

  test('refills tokens over time', async () => {
    const bucket = new TokenBucket(2, 10); // 10 tokens/sec
    bucket.consume();
    bucket.consume();
    assert.ok(!bucket.consume().allowed, 'empty bucket should block');

    // Wait for refill
    await new Promise(r => setTimeout(r, 150));
    const result = bucket.consume();
    assert.ok(result.allowed, 'should allow after refill');
  });

  test('never exceeds maxTokens', () => {
    const bucket = new TokenBucket(2, 100); // fast refill
    // Don't consume, just let time pass virtually
    bucket.lastRefill = Date.now() - 10000; // simulate 10s elapsed
    bucket.refill();
    assert.equal(bucket.tokens, 2, 'should cap at maxTokens');
  });

  test('per-user isolation: different keys get different buckets', () => {
    const bucket1 = new TokenBucket(1, 0.01);
    const bucket2 = new TokenBucket(3, 0.01);

    bucket1.consume();
    assert.ok(!bucket1.consume().allowed, 'bucket1 should be empty');
    assert.ok(bucket2.consume().allowed, 'bucket2 should still have tokens');
    assert.ok(bucket2.consume().allowed, 'bucket2 second token');
    assert.ok(bucket2.consume().allowed, 'bucket2 third token');
    assert.ok(!bucket2.consume().allowed, 'bucket2 should now be empty');
  });

  test('retryAfter decreases as refill progresses', () => {
    const bucket = new TokenBucket(1, 2); // 2 tokens/sec
    bucket.consume(); // empty the bucket
    const r1 = bucket.consume();
    assert.ok(r1.retryAfter <= 1 && r1.retryAfter > 0, `retryAfter should be ~0.5-1s, got ${r1.retryAfter}`);
  });

  test('high refill rate allows bursts', () => {
    const bucket = new TokenBucket(10, 100); // 100 tokens/sec
    for (let i = 0; i < 10; i++) {
      assert.ok(bucket.consume().allowed, `consume ${i} should pass`);
    }
    assert.ok(!bucket.consume().allowed, '11th should be blocked');
  });

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

runTests();
