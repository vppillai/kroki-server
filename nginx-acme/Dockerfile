# Custom nginx image for TLS_MODE=acmevaultpki. Same nginx version as the base
# compose (nginx:1.28-alpine) with acme.sh baked in so the certificate is
# issued and renewed against a HashiCorp Vault PKI ACME directory entirely
# inside the container (HTTP-01 webroot). Only used when TLS_MODE=acmevaultpki;
# the selfsigned and acme modes keep using the stock nginx:1.28-alpine image.
FROM nginx:1.28-alpine

# bash: entrypoint shell. curl/openssl/socat: acme.sh runtime deps.
# ca-certificates: trust store for the HTTPS connection to the Vault directory.
RUN apk add --no-cache bash curl openssl socat ca-certificates tini

# acme.sh reads these to locate its state; /acme is a persisted named volume.
ENV ACME_HOME=/acme \
    LE_WORKING_DIR=/acme \
    LE_CONFIG_HOME=/acme \
    CERT_HOME=/acme/certs \
    PATH="/acme:${PATH}"

# Pin acme.sh to a tagged release for reproducible builds.
RUN mkdir -p /acme /etc/nginx/certs \
 && curl -fsSL https://github.com/acmesh-official/acme.sh/archive/refs/tags/3.1.0.tar.gz \
      | tar -xz -C /tmp \
 && cd /tmp/acme.sh-3.1.0 \
 && ./acme.sh --install --home /acme --no-cron --no-profile \
 && rm -rf /tmp/acme.sh-3.1.0

COPY entrypoint.sh /usr/local/bin/kroki-acme-entrypoint.sh
RUN chmod +x /usr/local/bin/kroki-acme-entrypoint.sh

# 8080: HTTP-01 challenge + HTTP->HTTPS redirect. 8443: HTTPS (matches nginx.conf).
EXPOSE 8080 8443

# tini reaps the acme.sh background renewal process; the entrypoint execs nginx.
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/kroki-acme-entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
