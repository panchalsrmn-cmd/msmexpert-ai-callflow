# MSMExpert Callflow

An AI sales call center and CRM foundation for MSMExpert.com. The UI contains operational dashboard views, campaign and lead surfaces, a Meera voice simulator, and compliance-first CRM concepts.

## Architecture decision record

The production implementation is organized around provider ports (telephony, STT, TTS, AI, retrieval), with deterministic domain workflows for consent, suppression, campaign capacity and conversation transitions. Vendor event payloads must be durably recorded and idempotently consumed before side effects. This UI prototype deliberately uses no vendor credentials or real outbound calling.

## Local setup

`npm install` then `npm run dev`.

Run `npm run api` in a second terminal for the dependency-free local API bootstrap. It has `GET /health`, authenticated `GET /api/v1/leads`, and idempotent `POST /api/v1/leads`. Set `DEV_API_TOKEN` and send it as `Authorization: Bearer <token>` outside local development.

For a real Meera voice in the simulator, set `GEMINI_API_KEY` in `.env`, then run `npm run voice` alongside `npm run dev`. The browser calls the local gateway, which maintains a Gemini Live session using `gemini-2.5-flash-native-audio-preview-12-2025` and returns native audio; the key is never sent to the browser.

## Production requirements still needing credentials

PostgreSQL, Redis/queue service, an approved telephony provider with a verified business number, STT/TTS/LLM credentials, object storage for recordings, and the approved MSMExpert knowledge corpus.

## Backend foundation

`prisma/schema.prisma` defines the normalized PostgreSQL model and indexes. `src/server` contains provider-neutral ports, API boundary validation, response envelope helpers, and an application service example. Run `npx prisma migrate dev` only after putting a real PostgreSQL `DATABASE_URL` in a local `.env`; no migration is generated against an unknown database.

Use `docker compose up -d` to start PostgreSQL and Redis locally. The API bootstrap is intentionally dependency-free so it can run in restricted environments; replace its in-memory repository with the Prisma adapter once `@prisma/client` and `prisma` are installed.
