export function SignOutButton() {
  return (
    <form action="/auth/sign-out" method="post">
      <button type="submit">Sign out</button>
    </form>
  );
}
