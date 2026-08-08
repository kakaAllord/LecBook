export const AUTH_COOKIE = "lrms_token";
export const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

// Set by a super admin to view the app exactly as another user sees it.
export const IMPERSONATION_COOKIE = "lrms_view_as";
export const IMPERSONATION_MAX_AGE = 60 * 60 * 4; // 4 hours
