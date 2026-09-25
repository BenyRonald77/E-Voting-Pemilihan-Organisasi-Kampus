"use client";

import { useEffect, useState } from "react";
import { getSocket } from "@/lib/socket-client";

interface Candidate {
  id: string;
  name: string;
  vision: string;
  mission: string;
  photoEmoji: string;
  voteCount?: number;
}

interface ElectionDetail {
  id: string;
  title: string;
  status: string;
}

export default function StudentElectionPage({ params }: { params: { id: string } }) {
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [hasVoted, setHasVoted] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<Candidate[] | null>(null);

  async function loadDetail() {
    const response = await fetch(`/api/elections/${params.id}`);
    const data = await response.json();
    if (response.ok) {
      setElection(data.election);
      setCandidates(data.election.candidates);
      setHasVoted(data.hasVoted);
      if (data.election.status === "CLOSED") {
        loadResults();
      }
    }
  }

  async function loadResults() {
    const response = await fetch(`/api/elections/${params.id}/results`);
    if (response.ok) {
      const data = await response.json();
      setResults(data.candidates);
    }
  }

  useEffect(() => {
    loadDetail();
  }, [params.id]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("results:join", { electionId: params.id });
    function handleClosed(payload: { candidates: Candidate[] }) {
      setResults(payload.candidates);
      setElection((prev) => (prev ? { ...prev, status: "CLOSED" } : prev));
    }
    socket.on("election:closed", handleClosed);
    return () => {
      socket.off("election:closed", handleClosed);
    };
  }, [params.id]);

  async function handleVote() {
    if (!selected) return;
    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch(`/api/elections/${params.id}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId: selected }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Gagal mengirim suara");
        return;
      }
      setHasVoted(true);
    } finally {
      setSubmitting(false);
    }
  }

  if (!election) return null;

  if (election.status === "CLOSED") {
    const totalVotes = (results ?? []).reduce((sum, c) => sum + (c.voteCount ?? 0), 0);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">{election.title} — Hasil Akhir</h2>
        <p className="mt-1 text-xs text-slate-500">Total {totalVotes} suara masuk.</p>
        <div className="mt-4 flex flex-col gap-3">
          {(results ?? []).map((c) => (
            <div key={c.id} className="rounded-lg border border-slate-200 p-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">
                  {c.photoEmoji} {c.name}
                </span>
                <span className="font-semibold text-brand-700">{c.voteCount} suara</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full bg-brand-500"
                  style={{ width: `${totalVotes ? ((c.voteCount ?? 0) / totalVotes) * 100 : 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (hasVoted) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 text-center">
        <p className="text-lg font-semibold text-brand-700">Suara Anda sudah tercatat</p>
        <p className="mt-2 text-sm text-slate-500">Hasil akan tersedia setelah pemilihan ditutup panitia.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6">
      <h2 className="text-lg font-semibold text-slate-900">{election.title}</h2>
      <p className="mt-1 text-xs text-slate-500">Pilih satu kandidat, lalu konfirmasi.</p>
      <div className="mt-4 flex flex-col gap-3">
        {candidates.map((c) => (
          <button
            key={c.id}
            onClick={() => setSelected(c.id)}
            className={`rounded-lg border p-4 text-left ${
              selected === c.id ? "border-brand-600 bg-brand-50" : "border-slate-200"
            }`}
          >
            <p className="font-medium">
              {c.photoEmoji} {c.name}
            </p>
            <p className="mt-1 text-sm text-slate-600">Visi: {c.vision}</p>
            <p className="text-sm text-slate-600">Misi: {c.mission}</p>
          </button>
        ))}
      </div>
      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
      <button
        onClick={handleVote}
        disabled={!selected || submitting}
        className="mt-4 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white hover:bg-brand-700 disabled:opacity-60"
      >
        {submitting ? "Mengirim..." : "Kirim Suara"}
      </button>
    </div>
  );
}
