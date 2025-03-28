# Use a minimal Python image
FROM python:3-alpine

# Set default port (can be overridden when running the container)
ENV PORT=8006

# Create app directory
WORKDIR /app

# Copy the HTML files
COPY index.html .
COPY examples/ examples/
COPY css/ css/
COPY js/ js/

# Expose the port (for documentation)
EXPOSE ${PORT}

# Start the HTTP server directly (no need for a separate script)
CMD python -m http.server ${PORT}