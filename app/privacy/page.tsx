import { CONTACT_EMAIL, SITE_NAME } from "@/lib/site";

export const metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Privacy</h1>
      <p className="leading-relaxed">
        <strong>{SITE_NAME}</strong> stores your email address and a hashed
        password so you can sign in, plus what you choose to post: your
        username, bio, profile picture, ratings, reviews, comments, likes,
        follows, lists and compounds. Your username, bio, picture and everything
        you post are public, visible to anyone whether or not they are signed
        in, while your email address is never shown to other users. We use only
        the cookies needed to keep you signed in, your theme and search language
        are saved in your browser, and there are no ads or tracking. Your data
        is processed by Supabase (database and storage), Vercel (hosting) and
        Resend (sign-up and password-reset emails), and item titles,
        descriptions and pictures come from Wikipedia and Wikimedia Commons,
        which are contacted when an item is looked up. You can delete your
        account and everything you have posted at any time from Settings, and
        for anything else, including requests to see or correct your data, write
        to{" "}
        <a href={`mailto:${CONTACT_EMAIL}`} className="underline">
          {CONTACT_EMAIL}
        </a>
        .
      </p>
    </main>
  );
}
