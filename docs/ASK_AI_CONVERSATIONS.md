# Ask AI conversations

The Business **Ask AI** panel uses the existing support cases, provider adapter, public help guides and human handoff. No new chat module, provider, account tools, payment actions or database migration is introduced.

## Reply delivery

- **Thinking** appears while an actual live reply request is pending. A message for a human agent says **Sending**; handoff and reply checks have their own labels.
- **Typing** reveals an already received and validated answer locally. This is presentation, not a raw provider stream. Sources and action links appear after the text completes.
- **Done** means the reply has finished displaying. It does not claim that publishing, payment or any other account operation happened.
- **Show full reply** ends playback immediately. Reduced motion skips it. Closing the panel or hiding the tab completes playback and clears its timers; reopening does not type old replies again.
- The composer remains available for drafting. Enter sends; Shift + Enter inserts a line break. The same request cannot be submitted again while sending or revealing a reply. Screen-reader log updates are marked busy until delivery finishes, and automatic scrolling stops when the reader scrolls up.

## Conversational context

Guide retrieval prioritises the latest question instead of repeatedly concatenating the case's original subject. Follow-ups use at most six recent case/organisation-scoped turns. Approved guide IDs retain the topic when an older explicit question leaves that window. An explicit topic change starts a fresh retrieval.

Greetings, thanks and vague requests receive short acknowledgements or a clarifying question. Guide fallback gives two steps at a time and can advance them or ask where the customer is stuck. Unknown topics do not silently fall back to website setup. The existing AI provider prompt requests concise contextual replies and one relevant follow-up question. Generated output still passes the existing safety and approved-link checks before storage and display; sensitive cases and human support retain their existing authorisation.

No background network polling or automatic message retries were added. Greeting and clarification turns avoid provider calls. The existing DEEPSEEK_API_KEY configuration is unchanged; tests use mocks rather than paid live inference. A missing local provider binding does not establish whether the production binding is configured.

Validation covers guide context and safe provider fallback, request isolation, thinking/typing/done transitions, partial text, skipping, reduced motion, hidden/closed panels, no history replay, draft preservation, human replies, failure fallback, chunk recovery and desktop/mobile layouts. Browser transports are fixtures; no production support messages or notifications are sent.
