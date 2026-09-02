FROM node:24-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY voice ./voice
COPY crm ./crm
COPY voice-api.mjs ./
ENV NODE_ENV=production
ENV PORT=3002
ENV VOICE_HOST=0.0.0.0
EXPOSE 3002
CMD ["node", "voice-api.mjs"]
