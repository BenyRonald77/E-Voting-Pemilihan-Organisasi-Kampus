"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface Election {
  id: string;
  title: string;
  status: string;
  startAt: string;
  endAt: string;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Belum dibuka",
  OPEN: "Sedang berlangsung",
  CLOSED: "Sudah ditutup",
};

export default function StudentDashboardPage() {
  const [elections, setElections] = useState<Election[]>([]);

  useEffect(() => {
    fetch("/api/elections")
      .then((r) => r.json())
      .then((data) => setElections(data.elections.filter((e: Election) => e.status !== "DRAFT")));
  }, []);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">Daftar Pemilihan</h2>
      <div className="mt-4 flex flex-col gap-3">
        {elections.map((e) => (
          <Link
            key={e.id}
            href={`/dashboard/elections/${e.id}`}
            className="flex items-center justify-between rounded-lg border border-slate-200 p-4 hover:border-brand-400"
          >
            <span className="font-medium text-slate-900">{e.title}</span>
            <span
              className={`text-xs font-semibold ${e.status === "OPEN" ? "text-green-600" : "text-slate-400"}`}
            >
              {STATUS_LABEL[e.status]}
            </span>
          </Link>
        ))}
        {elections.length === 0 && <p className="text-sm text-slate-400">Belum ada pemilihan yang dibuka.</p>}
      </div>
    </div>
  );
}
