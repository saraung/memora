"""Canonical staff permission codes.

Keep this in sync with the seed data (scripts/seed_rbac.py) and the
admin-frontend permission vocabulary (PRD section 16.4).
"""

REPORTS_READ = "reports:read"
REPORTS_REVIEW = "reports:review"
CONTENT_REMOVE = "content:remove"
USERS_READ = "users:read"
USERS_SUSPEND = "users:suspend"
STAFF_MANAGE = "staff:manage"
ANALYTICS_READ = "analytics:read"
AUDIT_READ = "audit:read"
SETTINGS_READ = "settings:read"

ALL_PERMISSIONS: tuple[tuple[str, str], ...] = (
    (REPORTS_READ, "View reports and moderation queue"),
    (REPORTS_REVIEW, "Review reports and apply moderation decisions"),
    (CONTENT_REMOVE, "Remove or restore user content"),
    (USERS_READ, "Search and view account records"),
    (USERS_SUSPEND, "Suspend, restrict, or restore accounts"),
    (STAFF_MANAGE, "Grant and revoke staff roles"),
    (ANALYTICS_READ, "View platform analytics"),
    (AUDIT_READ, "View audit event history"),
    (SETTINGS_READ, "View platform settings"),
)
