# Use a specific Python version for better reproducibility
FROM python:3.12-alpine3.19

# Set environment variables
ENV PORT=8006 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Disable Python bytecode caching
    PYTHONFAULTHANDLER=1 \
    # Set path to static files
    STATIC_ROOT=/app

# Create app directory
WORKDIR /app

# Copy requirements and install Python dependencies as root
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Create a non-root user and set file permissions in a single layer
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

# Copy application files
COPY --chown=appuser:appgroup server.py .
COPY --chown=appuser:appgroup ai-models.json .
COPY --chown=appuser:appgroup index.html .
COPY --chown=appuser:appgroup favicon.ico .
COPY --chown=appuser:appgroup examples/ examples/
COPY --chown=appuser:appgroup css/ css/
COPY --chown=appuser:appgroup js/ js/

# Set proper file permissions
RUN find /app -type d -exec chmod 755 {} \; && \
    find /app -type f -exec chmod 644 {} \; && \
    chmod +x /app/server.py

# Add healthcheck using the dedicated health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 -O /dev/null http://localhost:${PORT}/api/health || exit 1

# Expose the port (for documentation)
EXPOSE ${PORT}

# Switch to non-root user for better security
USER appuser

# Use exec form of CMD for proper signal handling
CMD ["python", "server.py"]