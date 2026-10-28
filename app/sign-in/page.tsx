import { Suspense } from "react";
import { SignInButton } from "@/components/SignInButton";

const ERRORS: Record<string, string> = {
  not_allowed:
    "That Google account isn't allowed. Sign in with your own account.",
  sign_in_failed: "Sign-in didn't complete. Please try again.",
};

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main>
      <h1>Meal Tracking App</h1>
      <Suspense fallback={null}>
        <ErrorMessage searchParams={searchParams} />
      </Suspense>
      <SignInButton />
    </main>
  );
}

async function ErrorMessage({
  searchParams,
}: Pick<PageProps<"/sign-in">, "searchParams">) {
  const { error } = await searchParams;
  const message =
    typeof error === "string" && Object.hasOwn(ERRORS, error)
      ? ERRORS[error]
      : undefined;
  return message ? <p role="alert">{message}</p> : null;
}
