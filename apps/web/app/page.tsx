import Link from "next/link";

// ponytail: placeholder until Screen 1.5 (Home / command center) is built
export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-body text-text-secondary">
        Planevo — design phase. See <Link href="/design" className="underline">/design</Link>.
      </p>
    </main>
  );
}
