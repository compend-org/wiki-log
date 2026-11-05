import PeopleList from "@/components/PeopleList";

export const instant = false;

export default async function ConnectionsPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const [{ username }, { tab }] = await Promise.all([params, searchParams]);
  return (
    <PeopleList
      rawName={username}
      initial={tab === "following" ? "following" : "followers"}
    />
  );
}
