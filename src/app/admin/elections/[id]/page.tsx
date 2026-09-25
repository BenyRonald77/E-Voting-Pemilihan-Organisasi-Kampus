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

interface AuditEntry {
  id: string;
  action: string;
  details: string;
  hash: string;
  createdAt: string;
}

export default function AdminElectionPage({ params }: { params: { id: string } }) {
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [form, setForm] = useState({ name: "", vision: "", mission: "", photoEmoji: "🧑" });
  const [audit, setAudit] = useState<{ entries: AuditEntry[]; verification: { valid: boolean; brokenAtIndex: number | null } } | null>(
    null
  );
  const [busy, setBusy] = useState(false);

  async function loadDetail() {
    const response = await fetch(`/api/elections/${params.id}`);
    const data = await response.json();
    if (response.ok) {
      setElection(data.election);
      setCandidates(data.election.candidates);
    }
  }

  async function loadResults() {
    const response = await fetch(`/api/elections/${params.id}/results`);
    if (response.ok) {
      const data = await response.json();
      setCandidates(data.candidates);
    }
  }

  async function loadAudit() {
    const response = await fetch(`/api/elections/${params.id}/audit`);
    if (response.ok) {
      setAudit(await response.json());
    }
  }

  useEffect(() => {
    loadDetail();
    loadAudit();
  }, [params.id]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("results:join", { electionId: params.id });
    function handleUpdate(payload: { candidates: Candidate[] }) {
      setCandidates(payload.candidates);
    }
    function handleClosed(payload: { candidates: Candidate[] }) {
      setCandidates(payload.candidates);
      setElection((prev) => (prev ? { ...prev, status: "CLOSED" } : prev));
      loadAudit();
    }
    socket.on("results:update", handleUpdate);
    socket.on("election:closed", handleClosed);
    return () => {
      socket.off("results:update", handleUpdate);
      socket.off("election:closed", handleClosed);
    };
  }, [params.id]);

  async function handleAddCandidate(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const response = await fetch(`/api/elections/${params.id}/candidates`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (response.ok) {
        setForm({ name: "", vision: "", mission: "", photoEmoji: "🧑" });
        loadDetail();
        loadAudit();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleOpen() {
    setBusy(true);
    try {
      const response = await fetch(`/api/elections/${params.id}/open`, { method: "POST" });
      if (response.ok) {
        setElection((prev) => (prev ? { ...prev, status: "OPEN" } : prev));
        loadAudit();
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleClose() {
    setBusy(true);
    try {
      const response = await fetch(`/api/elections/${params.id}/close`, { method: "POST" });
      if (response.ok) {
        setElection((prev) => (prev ? { ...prev, status: "CLOSED" } : prev));
        loadResults();
        loadAudit();
      }
    } finally {
      setBusy(false);
    }
  }

  if (!election) return null;

  return (
    <div className="flex flex-col gap-8">
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">{election.title}</h2>
          <span className="text-sm font-semibold text-brand-700">{election.status}</span>
        </div>
        <div className="mt-4 flex gap-3">
          {election.status === "DRAFT" && (
            <button
              onClick={handleOpen}
              disabled={busy || candidates.length < 2}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              Buka Pemilihan {candidates.length < 2 && "(minimal 2 kandidat)"}
            </button>
          )}
          {election.status === "OPEN" && (
            <button
              onClick={handleClose}
              disabled={busy}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              Tutup Pemilihan
            </button>
          )}
        </div>
      </section>

      {election.status === "DRAFT" && (
        <section className="rounded-xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-slate-900">Tambah Kandidat</h2>
          <form onSubmit={handleAddCandidate} className="mt-3 grid gap-3 sm:grid-cols-2">
            <input
              required
              placeholder="Nama kandidat"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              placeholder="Emoji"
              value={form.photoEmoji}
              onChange={(e) => setForm({ ...form, photoEmoji: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
            <input
              required
              placeholder="Visi"
              value={form.vision}
              onChange={(e) => setForm({ ...form, vision: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2"
            />
            <input
              required
              placeholder="Misi"
              value={form.mission}
              onChange={(e) => setForm({ ...form, mission: e.target.value })}
              className="rounded-lg border border-slate-300 px-3 py-2 sm:col-span-2"
            />
            <button
              type="submit"
              disabled={busy}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 sm:col-span-2"
            >
              Tambah
            </button>
          </form>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-slate-900">
          Kandidat {election.status !== "DRAFT" && "& Tally"}
          {election.status === "OPEN" && <span className="ml-2 text-xs font-normal text-green-600">● live</span>}
        </h2>
        <div className="mt-3 flex flex-col gap-2">
          {candidates.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-lg border border-slate-200 p-3">
              <span>
                {c.photoEmoji} {c.name}
              </span>
              {c.voteCount !== undefined && <span className="font-semibold text-brand-700">{c.voteCount} suara</span>}
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Audit Trail</h2>
          {audit && (
            <span className={`text-xs font-semibold ${audit.verification.valid ? "text-green-600" : "text-red-600"}`}>
              {audit.verification.valid ? "✓ Rantai valid" : `✗ Manipulasi terdeteksi di entri #${audit.verification.brokenAtIndex}`}
            </span>
          )}
        </div>
        <div className="mt-3 flex flex-col gap-2 text-xs">
          {audit?.entries.map((entry, i) => (
            <div key={entry.id} className="rounded border border-slate-100 p-2 font-mono">
              <span className="font-semibold text-slate-700">
                #{i} {entry.action}
              </span>{" "}
              <span className="text-slate-400">{new Date(entry.createdAt).toLocaleTimeString("id-ID")}</span>
              <div className="truncate text-slate-400">hash: {entry.hash.slice(0, 16)}...</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
