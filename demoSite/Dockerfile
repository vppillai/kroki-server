# Use a minimal Python image
FROM python:3-alpine

# Set default port (can be overridden when running the container)
ENV PORT=8006

# Create app directory
WORKDIR /app

# Copy the HTML files
COPY index.html /app/
COPY examples/ /app/examples/

# Create start script that uses the PORT environment variable
RUN echo '#!/bin/sh\npython -m http.server $PORT' > /app/start.sh && \
    chmod +x /app/start.sh

# Expose the default port (for documentation)
EXPOSE 8006

# Start the HTTP server
CMD ["/app/start.sh"]