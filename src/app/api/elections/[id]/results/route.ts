import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const election = await prisma.election.findUnique({ where: { id: params.id } });
  if (!election) {
    return NextResponse.json({ error: "Pemilihan tidak ditemukan" }, { status: 404 });
  }

  if (session.role !== "ADMIN" && election.status !== "CLOSED") {
    return NextResponse.json({ error: "Hasil hanya bisa dilihat setelah pemilihan ditutup" }, { status: 403 });
  }

  const candidates = await prisma.candidate.findMany({
    where: { electionId: election.id },
    select: { id: true, name: true, photoEmoji: true, voteCount: true },
    orderBy: { voteCount: "desc" },
  });

  const totalVotes = candidates.reduce((sum, c) => sum + c.voteCount, 0);

  return NextResponse.json({ election, candidates, totalVotes });
}
