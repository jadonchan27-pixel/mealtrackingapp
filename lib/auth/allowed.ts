// The app has a single user: only the Google account in ALLOWED_EMAIL may sign in.

export function allowedEmail(): string {
  const value = process.env.ALLOWED_EMAIL;
  if (!value) {
    throw new Error(
      "Missing environment variable ALLOWED_EMAIL. See .env.example.",
    );
  }
  return value.trim().toLowerCase();
}

export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) {
    return false;
  }
  return email.trim().toLowerCase() === allowedEmail();
}
