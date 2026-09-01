# Meera Gemini Live integration

## Configuration

Copy the three Gemini variables from `.env.example` into the private `.env` file. `GEMINI_LIVE_MODEL` defaults to `gemini-2.5-flash-native-audio-preview-12-2025`; `GEMINI_VOICE_NAME` is a Gemini prebuilt voice name such as `Sulafat`. Do not put a Gemini key in the browser or commit `.env`.

## Start locally

Run `npm run voice`, then `npm run dev`, and open `http://127.0.0.1:5173/playground/meera`.

The playground streams microphone PCM to `ws://127.0.0.1:3002/live`. The backend converts incoming audio to 16 kHz PCM, passes it through the official Gemini SDK, and streams Gemini's generated PCM back for local playback. The supplied lead context is sent only when the Live session begins.

## Public deployment for Exotel

Deploy the included `Dockerfile` to a host that supports public HTTPS/WSS and map `voice.mormslunch.store` to the host's supplied A-record address or CNAME. Set `VOICE_HOST=0.0.0.0`, `VOICE_ALLOWED_ORIGIN=https://mormslunch.store`, and a private `GEMINI_API_KEY` in the host's secret manager. Do not expose the key in browser code or DNS records.

After deployment, confirm `https://voice.mormslunch.store/health` is reachable and configure Exotel AgentStream with `wss://voice.mormslunch.store/live`. Exotel must provide/enable the AgentStream call flow; the legacy Connect API only dials the customer and does not stream live call audio to this gateway.

## Existing telephony connection

For an active call, create a session by sending `{ type: "start", callId, lead }` to the local `/live` WebSocket. Send telephony frames as `{ type: "audio", data: base64Pcm, sampleRate }`; 8 kHz mu-law should be decoded with `mulawToPcm16()` before sending. Subscribe to outgoing `audio`, `transcript`, and `event` messages and encode Gemini's returned 24 kHz PCM into the carrier codec.

Send `{ type: "interrupt" }` when customer voice activity begins. It clears the bounded local audio queue, so stale Meera audio cannot play after barge-in. Side-effecting tool invocations carry an internal idempotency key based on call and function-call ID; completed outcomes are never replayed within a session.

## Backend adapter

`voice-api.mjs` exposes a deliberately narrow adapter for `lookupKnowledge`, `updateLead`, `createCallback`, `markDoNotCall`, and `requestHumanTransfer`. Replace those five demo functions with authenticated calls to the existing CRM/telephony services. The Gemini session only sees function schemas and validated responses; it never gets database or internal API access.

## Operational note

The Live provider does not retry a completed tool action after a reconnect. Reconnect only a fresh voice transport/session under the call orchestrator's control. Structured events contain call IDs but never credentials.
