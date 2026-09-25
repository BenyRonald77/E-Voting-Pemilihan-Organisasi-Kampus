import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Hanya admin yang bisa membuka pemilihan" }, { status: 403 });
  }

  const election = await prisma.election.findUnique({
    where: { id: params.id },
    include: { _count: { select: { candidates: true } } },
  });
  if (!election) {
    return NextResponse.json({ error: "Pemilihan tidak ditemukan" }, { status: 404 });
  }
  if (election.status !== "DRAFT") {
    return NextResponse.json({ error: "Hanya pemilihan berstatus DRAFT yang bisa dibuka" }, { status: 400 });
  }
  if (election._count.candidates < 2) {
    return NextResponse.json({ error: "Minimal 2 kandidat diperlukan sebelum membuka pemilihan" }, { status: 400 });
  }

  const updated = await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });
  await appendAuditLog(election.id, "ELECTION_OPENED", { openedBy: admin.id });

  return NextResponse.json({ election: updated });
}
