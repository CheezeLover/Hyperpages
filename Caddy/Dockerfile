FROM docker.io/library/caddy:2.10.2-builder AS builder

# Build Caddy v2.9.1 with caddy-security and replace-response plugins.
# renovate: datasource=github-releases depName=caddyserver/caddy
ARG CADDY_VERSION=v2.9.1
ARG CADDY_SECURITY_VERSION=v1.1.31
ARG CADDY_RATELIMIT_VERSION=v0.0.0-20250416141015-d649da3f7c4f
RUN xcaddy build ${CADDY_VERSION} \
    --with github.com/greenpau/caddy-security@${CADDY_SECURITY_VERSION} \
    --with github.com/caddyserver/replace-response \
    --with github.com/mholt/caddy-ratelimit@${CADDY_RATELIMIT_VERSION}

# Verify all plugins compiled in — fail the build immediately if any is missing
RUN /usr/bin/caddy list-modules 2>/dev/null | grep -q "http.handlers.replace" || \
      (echo "FATAL: replace module missing from caddy binary" && exit 1)
RUN /usr/bin/caddy list-modules 2>/dev/null | grep -q "security" || \
      (echo "FATAL: security module missing from caddy binary" && exit 1)
RUN /usr/bin/caddy list-modules 2>/dev/null | grep -q "rate_limit" || \
      (echo "FATAL: rate_limit module missing from caddy binary" && exit 1)
RUN echo "✓ Caddy plugins verified: replace_response + security + rate_limit"

FROM docker.io/library/caddy:2.9.1-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
