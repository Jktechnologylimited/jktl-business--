# JKTL Business — Checkpoint 4 (branding fixes + profile photos)

Builds on Checkpoint 3 (all Phase 1 gaps closed). This pass: brand cleanup
requested after reviewing the icon and copy, plus profile photo upload.

## What changed since Checkpoint 3

- **Removed the green box from the logo everywhere.** The in-app
  `JktlMark` no longer wraps the logo in a colored rounded square — it's
  just the transparent logo image now, sized by whatever container it's
  in. The generated PWA icons (`icon-192`, `icon-512`, the maskable
  variant, the apple-touch-icon, the favicon) switched from a teal
  backing to plain white — a home-screen icon still needs *some* solid
  backing so it doesn't look broken on a real device, but it's no longer
  brand-teal. `scripts/make-icons.py` reflects this; rerun it if you want
  a different treatment.
- **"SalonDesk" is gone, everywhere.** It only ever existed in the salon
  industry config's `productName` (inconsistent with every other vertical,
  which already said "JKTL Business") plus a few copies of it in page
  metadata and the wordmark. Fixed in `industry.ts`, `manifest.ts`,
  `layout.tsx` metadata, the `JktlWordmark` component (dropped the
  subtitle line entirely rather than show "JKTL Business" twice), and
  `README.md`.
- **Profile photo upload** — new `AvatarUpload` component in Settings →
  Account. Picks an image, center-crops and downsizes it to 256×256 client
  side (canvas, JPEG @ 0.85 quality) before storing it, so a phone photo
  doesn't balloon into megabytes of stored data. The resulting data URL is
  persisted alongside the session (survives a reload, clears on logout,
  like the rest of the mock session). The photo now shows wherever the
  account avatar appears — sidebar, mobile header, Settings — falling back
  to initials when none is set. Added a small shared `Avatar` component so
  that fallback logic lives in one place instead of being copy-pasted.

## Verified

`tsc --noEmit`, `eslint`, and `npm run build` all pass clean — still 21
routes. Build proven with the same temporary-local-font trick as every
prior checkpoint (this sandbox has no route to `fonts.googleapis.com`);
reverted to real Manrope/Public Sans before packaging.

**Not yet checked in a real browser**: the actual file-picker → crop →
store flow for avatar upload, and how the new white-background icons
render at each real size (192/512/apple-touch) on an actual home screen.
Those are exactly the kind of thing static analysis can't catch — worth
five minutes on a real phone before considering this final.

## Decision worth flagging

Avatar images are stored as base64 data URLs in `localStorage` alongside
the session — fine for a single ~20–40KB compressed photo, but this is a
Phase 1 convenience, not how Phase 2 should work. Real file storage
(Section 17's `files` table + actual blob storage) is the right home for
this once the backend exists; the client-side resize logic in
`lib/image.ts` is still useful then; the storage destination isn't.

## Next steps

Same as Checkpoint 3: this is a good point for your own click-through
review. Phase 2 (Neon, real auth, multi-tenancy, Resend) still hasn't
started, per the brief's instruction not to begin it automatically.
