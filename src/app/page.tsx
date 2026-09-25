import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <h1 className="text-3xl font-bold text-brand-700">E-Voting Kampus</h1>
      <p className="text-slate-600">
        Satu mahasiswa satu suara, suara rahasia, hasil realtime setelah
        pemilihan ditutup, dan audit trail yang bisa diverifikasi.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700"
      >
        Masuk
      </Link>
    </main>
  );
}
