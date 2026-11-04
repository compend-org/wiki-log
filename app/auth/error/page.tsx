import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col justify-center gap-3 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">That link didn&apos;t work</h1>
      <p>
        It may have expired or already been used. You can{" "}
        <Link href="/login" className="underline">
          sign in
        </Link>{" "}
        (we can send a new confirmation email from there), or{" "}
        <Link href="/forgot-password" className="underline">
          reset your password
        </Link>
        .
      </p>
    </main>
  );
}
