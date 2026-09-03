# Next-version upgrades (parked)

Items agreed for a later release — not in the current UAT / go-live scope.

## Optional client SSO (OIDC)

**Status:** Parked — upgrade for next version  
**Requested:** Clients with internal security requirements may want SSO; keep **optional** (password login remains default).

### Agreed shape
- Optional only — no client forced onto SSO
- Per-client enablement in Masters
- Prefer **OpenID Connect** first (Microsoft Entra ID / Azure AD as the usual first IdP); Google Workspace / Okta later if needed
- Map IdP users by **verified email** to an already-provisioned `client` user (no auto-create)
- Same HttpOnly session cookie as today after successful SSO
- Password (+ existing email OTP / staff MFA) stays available unless a future “SSO required” flag is added deliberately

### Out of scope for that first slice
- SAML (add only if a client mandates it)
- Auto-provisioning of new accounts from the IdP
- Forcing SSO platform-wide

### When picking this up
1. Confirm first IdP with the requesting client (usually Entra).
2. Add per-client OIDC settings + login button / domain hint.
3. UAT with one pilot client, then production.
