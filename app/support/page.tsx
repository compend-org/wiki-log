import { KOFI_URL } from "@/lib/site";

export const metadata = { title: "Support" };

export default function SupportPage() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 p-4 sm:p-8">
      <h1 className="text-3xl font-bold">Donate</h1>
      <p>
        Server costs are scary like Chucky. I don't want to put ads on here.
      </p>
      <p>
        <a
          href={KOFI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded border-2 border-dashed border-accent px-4 py-2 font-semibold hover:underline"
        >
          Support on Ko-fi
        </a>
      </p>
    </main>
  );
}
