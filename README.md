## Devblog
Ce repository contient mes articles de blog concernant le développement en général.

> [Markdown cheatsheet](https://github.github.com/gfm/)

## Rate Limiter

A client-side rate limiter using the **token bucket algorithm** protects comment forms from abuse.

### Configuration

In `hugo.yml`, under `params.rateLimit`:

```yaml
params:
  rateLimit:
    enabled: true      # Enable/disable rate limiting
    maxTokens: 5       # Maximum requests allowed in a burst
    refillRate: 0.5    # Tokens replenished per second
    keyPrefix: "comment" # Prefix for rate limit keys
```

### How it works

- Each user gets a token bucket with `maxTokens` capacity
- Each form submission consumes 1 token
- Tokens refill at `refillRate` per second
- When the bucket is empty, the form is blocked and a warning is displayed
- The warning shows how many seconds to wait before retrying
- The warning auto-dismisses after the retry period

### Testing

```bash
node static/js/__tests__/rate-limiter.test.js
```