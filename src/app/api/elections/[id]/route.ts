import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const election = await prisma.election.findUnique({
    where: { id: params.id },
    include: {
      candidates: {
        select: { id: true, name: true, vision: true, mission: true, photoEmoji: true },
      },
    },
  });

  if (!election) {
    return NextResponse.json({ error: "Pemilihan tidak ditemukan" }, { status: 404 });
  }

  let hasVoted = false;
  if (session.role === "STUDENT") {
    const record = await prisma.voteRecord.findUnique({
      where: { studentId_electionId: { studentId: session.sub, electionId: election.id } },
    });
    hasVoted = !!record;
  }

  return NextResponse.json({ election, hasVoted });
}
