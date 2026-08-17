FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system utilities & audio tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    curl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy application files
COPY . /app/

# Set Environment defaults
ENV PORT=8000
EXPOSE 8000

# Run Pipeline HTTP Server
CMD ["python3", "pipeline.py", "--server"]
