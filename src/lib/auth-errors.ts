/**
 * Turns Supabase auth errors into copy a customer can act on.
 *
 * The raw errors are developer-facing ("Failed to fetch",
 * "AuthRetryableFetchError", "Invalid API key"), and when the Supabase
 * project is unreachable the browser reports it as a bare network failure,
 * which reads like the site itself is broken. Keep infrastructure detail
 * out of the UI and tell the person what to do next.
 */
export function describeAuthError(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? '';
  const message = (error as { message?: string } | null)?.message ?? '';

  const isNetworkish =
    name === 'AuthRetryableFetchError' ||
    /failed to fetch|networkerror|network request failed|load failed|err_name_not_resolved|fetch failed/i.test(
      message
    );

  if (isNetworkish) {
    return 'We could not reach our sign-in service just now. Check your connection and try again in a moment. If it keeps happening, contact support and we will sort it out.';
  }

  if (/invalid api key|jwt|anon key|supabase_not_configured/i.test(message)) {
    return 'Sign-in is temporarily unavailable. Our team has been notified — please try again shortly.';
  }

  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email address first — check your inbox for the confirmation link.';
  }

  if (/user already registered|already been registered/i.test(message)) {
    return 'An account with this email already exists. Try signing in instead.';
  }

  if (/rate limit|too many requests/i.test(message)) {
    return 'Too many attempts. Please wait a minute and try again.';
  }

  return message || 'Something went wrong. Please try again.';
}
