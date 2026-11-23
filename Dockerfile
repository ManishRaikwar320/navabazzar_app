FROM node:22-bookworm-slim

WORKDIR /app

# Install Python 3 and pip for the FastAPI + SQLite backend
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install Python FastAPI dependencies
COPY backend/requirements.txt ./backend/requirements.txt
RUN python3 -m pip install --no-cache-dir --break-system-packages -r backend/requirements.txt

# Install Node.js dependencies and build the Vite frontend
COPY package.json ./
RUN npm install --legacy-peer-deps --no-audit --no-fund

# Copy project source and build production assets
COPY . .
RUN npm run build && mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "start"]
