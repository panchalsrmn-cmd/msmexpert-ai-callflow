# Backend integration guide

The server layer deliberately defines vendor-neutral ports before any provider SDK is introduced. A real deployment should implement adapters under `src/server/adapters/`, bind them in a composition root, and expose framework routes that call application services only.

Webhook flow: verify provider signature → persist unique `CallEvent.eventKey` in a transaction → enqueue side effects using the same event ID as idempotency key → acknowledge. Never invoke the LLM or telephony provider before durable persistence succeeds.

`telephony/` implements the vendor-neutral call adapter contract, signed webhook verification, and replay protection. Its mock provider supports integration tests without calling a phone network. `CallOrchestrator` claims campaign capacity before dialing and releases it at completion; only transient failure reasons enqueue retries.
