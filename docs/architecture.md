# Architecture decisions

## Core boundaries

The production service is split into `leads`, `campaigns`, `calls`, `conversations`, `compliance`, `knowledge`, and provider adapters. Application services depend on ports rather than Exotel, Airtel IQ, Twilio, OpenAI, or a vector store SDK directly.

## Safety invariants

- A do-not-call transition atomically writes a suppression entry, lead event, and audit record before any later campaign work can claim the lead.
- Provider webhooks are authenticated, stored with their idempotency key, then processed asynchronously. Replays return the earlier result.
- Campaign capacity is claimed by a durable worker and released only by a terminal call event.
- Pricing, subsidy, eligibility, documents, and scheme facts require approved retrieval sources; otherwise Meera uses the safe fallback.

## Required persistence models

`User`, `Lead`, `LeadEvent`, `Campaign`, `CampaignLead`, `Call`, `CallEvent`, `TranscriptSegment`, `Conversation`, `ConversationState`, `Callback`, `Transfer`, `KnowledgeDocument`, `KnowledgeChunk`, `SuppressionEntry`, `AuditLog`, and `SystemSetting` should be normalized in PostgreSQL. Provider metadata remains a constrained JSON column, never a location for secrets.
