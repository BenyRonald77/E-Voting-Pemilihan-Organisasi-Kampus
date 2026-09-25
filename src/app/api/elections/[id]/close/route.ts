import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";
import { broadcastElectionClosed } from "@/lib/realtime";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Hanya admin yang bisa menutup pemilihan" }, { status: 403 });
  }

  const election = await prisma.election.findUnique({ where: { id: params.id } });
  if (!election) {
    return NextResponse.json({ error: "Pemilihan tidak ditemukan" }, { status: 404 });
  }
  if (election.status !== "OPEN") {
    return NextResponse.json({ error: "Hanya pemilihan berstatus OPEN yang bisa ditutup" }, { status: 400 });
  }

  const updated = await prisma.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });
  await appendAuditLog(election.id, "ELECTION_CLOSED", { closedBy: admin.id });

  const candidates = await prisma.candidate.findMany({
    where: { electionId: election.id },
    select: { id: true, name: true, voteCount: true },
    orderBy: { voteCount: "desc" },
  });

  // Klien yang sedang membuka halaman hasil (di room ini) langsung
  // menerima tally final lewat WebSocket, tanpa perlu refresh manual.
  broadcastElectionClosed(election.id, { candidates });

  return NextResponse.json({ election: updated, candidates });
}
