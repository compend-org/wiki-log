export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 p-8">
      <h1 className="text-3xl font-bold">Privacy</h1>

      <h2 className="text-xl font-bold">What we store</h2>
      <p>
        Your email address and a hashed (unreadable) password, so you can sign
        in. Your username, the videos you log with
        your ratings and reviews, and who you follow.
      </p>

      <h2 className="text-xl font-bold">What is public</h2>
      <p>
        Your username, logs, ratings, reviews and follows are
        public: anyone can see them, including people who aren&apos;t signed
        in. Your email address is never shown to other users.
      </p>

      <h2 className="text-xl font-bold">Cookies</h2>
      <p>
        We only use cookies needed to keep you signed in. No advertising or
        tracking cookies.
      </p>

      <h2 className="text-xl font-bold">Where data is kept</h2>
      <p>
        Your data is stored with our database provider, Supabase. Video titles
        and thumbnails come from YouTube.
      </p>

      <h2 className="text-xl font-bold">Deleting your data</h2>
      <p>
        You can delete your account and all of your data at any time from your
        profile settings. For anything else, contact{" "}
        <a href="mailto:your-email@example.com" className="underline">
          your-email@example.com
        </a>
        .
      </p>

      <h2 className="text-xl font-bold">YouTube</h2>
      <p>
        This app uses YouTube services. By using it you agree to be bound by
        the{" "}
        <a
          href="https://www.youtube.com/t/terms"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          YouTube Terms of Service
        </a>
        , and Google&apos;s{" "}
        <a
          href="https://policies.google.com/privacy"
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Privacy Policy
        </a>{" "}
        applies.
      </p>
    </main>
  );
}