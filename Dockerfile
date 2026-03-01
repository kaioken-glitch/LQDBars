# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the Vite + React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app

# Copy root package files and install ALL dependencies (including devDeps for build)
COPY package.json package-lock.json* ./
RUN npm ci

# Copy the rest of the source and build
# Vite outputs to /app/dist by default
COPY . .
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production image — Node + yt-dlp + serve both frontend & backend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS production

# ── System deps ──
# python3 + ffmpeg are required by yt-dlp
# curl is used to download yt-dlp binary
# supervisor runs both processes (npm start + node youtube-converter.js)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    supervisor \
  && rm -rf /var/lib/apt/lists/*

# ── Install yt-dlp ──
# Downloads the latest stable binary directly (faster + always up to date)
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

# ── App setup ──
WORKDIR /app

# Copy package files and install PRODUCTION deps only
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Copy backend folder
# ⚠️  Adjust 'server' to whatever your backend subfolder is actually named
COPY Backend/ ./Backend/

# Copy the built frontend from stage 1
COPY --from=frontend-build /app/dist ./dist

# ── Supervisor config ──
# Supervisor keeps both processes running and restarts them on crash
COPY supervisord.conf /etc/supervisor/conf.d/app.conf

# ── Ports ──
# 3000 → npm start  (your main Express / Node server that also serves the frontend build)
# 3001 → node server/youtube-converter.js  (the YouTube conversion backend)
EXPOSE 3000
EXPOSE 3001

# ── Start everything via supervisor ──
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/app.conf"]