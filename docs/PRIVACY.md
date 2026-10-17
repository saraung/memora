# Memora Privacy Decisions

Decisions required by PRD §8.5, recorded here and enforced in code.
Last reviewed: 2026-10-16.

## 1. Direct messages are NOT end-to-end encrypted

- Messages are encrypted in transit (TLS) and stored server-side so
  history syncs across the user's sessions.
- End-to-end encryption is an explicit PRD non-goal. Adopting the
  Signal Protocol would remove server-side search, moderation, and
  notification previews, and is out of scope.

## 2. Administrators cannot read message contents

- No API endpoint, dashboard screen, or role permission exposes
  message bodies to staff. This is enforced by design (all message
  reads require conversation participation) and by regression test
  (`tests/api/test_privacy.py`).
- Abuse is handled reporter-first: a participant voluntarily submits
  the offending message(s) through the reporting workflow; that
  submission — not the conversation — is what moderators review.
- Any exceptional access (e.g. legal/security) requires ALL of:
  1. an explicit, dedicated permission (never a general admin grant),
  2. a written reason recorded with the action,
  3. an `AuditEvent` entry (`audit:read`-visible, immutable).
- There is currently no such permission defined. Defining one is a
  deliberate product decision, not an engineering shortcut.

## 3. Message attachments

- Attachments reuse the Cloudinary upload-intent flow; only image
  types verified by that flow may attach to messages.
- `secure_url` values are bearer URLs: possession of the link allows
  download. The backend never reveals the media mapping to
  non-participants, but links that leak outside Memora are fetchable.
  Short-lived signed delivery URLs are deferred until the threat
  model requires them.

## 4. Blocking

- Blocking is strict both directions: profiles, posts, stories,
  reels, messages, notifications, and search results all hide the
  blocked pair from each other.
- Deleting a conversation hides it only for the deleter; a new
  message from either side reopens the shared thread.

## 5. Accounts

- New accounts are public by default; private accounts are visible
  (profile, posts, stories, messages) only to approved followers.
- Deleted accounts vanish from all surfaces. Audit events are
  retained and reference anonymized actor IDs.
- Password changes and resets revoke all sessions. Email is
  required to be verified for full participation.
