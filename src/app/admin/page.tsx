"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Election {
  id: string;
  title: string;
  status: string;
  _count: { candidates: number; voteRecords: number };
}

export default function AdminHomePage() {
  const [elections, setElections] = useState<Election[]>([]);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(3);
  const [creating, setCreating] = useState(false);

  async function load() {
    const response = await fetch("/api/elections");
    if (response.ok) {
      const data = await response.json();
      setElections(data.elections);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    try {
      const now = new Date();
      const endAt = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
      const response = await fetch("/api/elections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, startAt: now.toISOString(), endAt: endAt.toISOString() }),
      });
      if (response.ok) {
        setTitle("");
        load();
      }
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Buat Pemilihan Baru</h2>
        <form onSubmit={handleCreate} className="mt-3 flex gap-3">
          <input
            required
            placeholder="Judul pemilihan"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            type="number"
            min={1}
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="w-24 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            type="submit"
            disabled={creating}
            className="rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
          >
            {creating ? "..." : "Buat"}
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">Daftar Pemilihan</h2>
        <div className="mt-4 flex flex-col gap-3">
          {elections.map((e) => (
            <Link
              key={e.id}
              href={`/admin/elections/${e.id}`}
              className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-brand-400"
            >
              <div>
                <p className="font-medium text-slate-900">{e.title}</p>
                <p className="text-xs text-slate-500">
                  {e._count.candidates} kandidat · {e._count.voteRecords} suara masuk
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-400">{e.status}</span>
            </Link>
          ))}
          {elections.length === 0 && <p className="text-sm text-slate-400">Belum ada pemilihan.</p>}
        </div>
      </section>
    </div>
  );
}
