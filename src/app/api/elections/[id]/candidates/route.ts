import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";

const schema = z.object({
  name: z.string().min(2),
  vision: z.string().min(1),
  mission: z.string().min(1),
  photoEmoji: z.string().optional(),
});

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Hanya admin yang bisa menambah kandidat" }, { status: 403 });
  }

  const election = await prisma.election.findUnique({ where: { id: params.id } });
  if (!election) {
    return NextResponse.json({ error: "Pemilihan tidak ditemukan" }, { status: 404 });
  }
  if (election.status !== "DRAFT") {
    return NextResponse.json({ error: "Kandidat hanya bisa ditambahkan saat pemilihan berstatus DRAFT" }, { status: 400 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const candidate = await prisma.candidate.create({
    data: { electionId: election.id, ...parsed.data },
  });

  await appendAuditLog(election.id, "CANDIDATE_ADDED", { candidateId: candidate.id, name: candidate.name });

  return NextResponse.json({ candidate }, { status: 201 });
}
