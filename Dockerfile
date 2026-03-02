# ─────────────────────────────────────────────────────────────────────────────
# Stage 1: Build the Vite + React frontend
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app

COPY Frontend/package.json Frontend/package-lock.json* ./
RUN npm ci

COPY Frontend/ .
RUN npm run build


# ─────────────────────────────────────────────────────────────────────────────
# Stage 2: Production image — Node + yt-dlp + supervisor
# ─────────────────────────────────────────────────────────────────────────────
FROM node:20-slim AS production

# ── System deps ──
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    ffmpeg \
    curl \
    supervisor \
  && rm -rf /var/lib/apt/lists/*

# ── Install yt-dlp ──
RUN curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp \
    -o /usr/local/bin/yt-dlp \
  && chmod +x /usr/local/bin/yt-dlp

# ── App setup ──
WORKDIR /app

# Copy backend and install its deps
COPY Backend/package.json Backend/package-lock.json* ./
RUN npm ci --omit=dev

COPY Backend/ ./Backend/

# Copy the built frontend from stage 1
COPY --from=frontend-build /app/dist ./dist

# ── Write supervisor config using printf ──
RUN mkdir -p /etc/supervisor/conf.d && \
    printf '[supervisord]\nnodaemon=true\nlogfile=/dev/null\nlogfile_maxbytes=0\n\n[program:app]\ncommand=npm start\ndirectory=/app\nautostart=true\nautorestart=true\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\nenvironment=NODE_ENV="production",PORT="3000"\n\n[program:ytconverter]\ncommand=node Backend/youtube-converter.js\ndirectory=/app\nautostart=true\nautorestart=true\nstdout_logfile=/dev/stdout\nstdout_logfile_maxbytes=0\nstderr_logfile=/dev/stderr\nstderr_logfile_maxbytes=0\nenvironment=NODE_ENV="production",CONVERTER_PORT="3001"\n' \
    > /etc/supervisor/conf.d/app.conf

# ── Ports ──
EXPOSE 3000
EXPOSE 3001

# ── Start everything via supervisor ──
CMD ["/usr/bin/supervisord", "-n", "-c", "/etc/supervisor/conf.d/app.conf"]