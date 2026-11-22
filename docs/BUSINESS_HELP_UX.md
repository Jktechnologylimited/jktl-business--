# JKTL Business help and navigation

This update is for business owners using `/business`. The admin frame, admin pages and team support inbox are unchanged; the initial admin-side edits from this task were restored.

- Help is visible in the desktop sidebar and sticky mobile header. Theme and language preferences remain in the mobile account menu.
- One accessible help dialog offers knowledge-base search, the existing AI assistant, support conversations, WhatsApp and email. Escape, native modal focus handling and return focus are supported.
- Asking AI from Help opens the existing lazy chat instance. Opening Help or chat does not create a support case. Messages and handoff use the existing authenticated actions.
- The desktop sidebar groups existing website/service, money, catalogue and account tools with Lucide icons. Website links and Upgrade remain prominent. Mobile More selection includes the existing service and account routes.
- The existing support page has a clearer conversation list, orange/blue/green statuses, a visible New conversation action and labelled fields. On phones the composer appears before history; selecting a conversation or starting another moves focus to it. Existing permissions, review consent and case actions are preserved.
- No new polling, database structures, notification workflows or paid services. Existing support polling still pauses when the tab is hidden.

## Local verification

TypeScript and the production build pass (Next 16.4.2, webpack and Turbopack; production database variables removed and migration prebuild skipped). ESLint has no errors and retains the existing request-version cleanup warning in CustomerSupport.

Support, permission, partner-support, team-access and AI regression checks passed. The real Business shell, Help dialog, support page and lazy chat were tested at 1440px, 390px and 320px in light/dark themes. Checks include sticky Help while scrolling, visible website/Upgrade links, focus return, mobile preferences, form ordering, chat lifecycle, account/mode resets and failed-chunk recovery. Authentication and support transports in browser fixtures are mocked; no live customer records, messages or charges were created.

Run the completed build before preparing browser fixtures, since they copy its generated CSS:

```sh
node tests/ask-ai-ui-fixtures.mjs
node tests/ask-ai.browser.cjs
```

This document records verification before release. GitHub and Vercel record the deployment status of the released commit.
