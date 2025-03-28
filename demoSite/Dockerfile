# Use a specific Python version for better reproducibility
FROM python:3.12-alpine

# Set environment variables
ENV PORT=8006 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Disable Python bytecode caching
    PYTHONFAULTHANDLER=1 \
    # Set path to static files
    STATIC_ROOT=/app

# Create a non-root user to run the application
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Create app directory
WORKDIR /app

# Copy static files
COPY --chown=appuser:appgroup index.html .
COPY --chown=appuser:appgroup favicon.ico .
COPY --chown=appuser:appgroup examples/ examples/
COPY --chown=appuser:appgroup css/ css/
COPY --chown=appuser:appgroup js/ js/

# Add healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT}/ || exit 1

# Set proper file permissions
RUN find /app -type d -exec chmod 755 {} \; && \
    find /app -type f -exec chmod 644 {} \;

# Expose the port (for documentation)
EXPOSE ${PORT}

# Switch to non-root user for better security
USER appuser

# Use exec form of CMD for proper signal handling
CMD ["sh", "-c", "python -m http.server ${PORT} --bind 0.0.0.0"]