import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin, getSession } from "@/lib/auth";
import { appendAuditLog } from "@/lib/audit-log";

const createSchema = z.object({
  title: z.string().min(3),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
});

export async function GET() {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const elections = await prisma.election.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { candidates: true, voteRecords: true } } },
  });

  return NextResponse.json({ elections });
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) {
    return NextResponse.json({ error: "Hanya admin yang bisa membuat pemilihan" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parsed.error.flatten() }, { status: 400 });
  }

  const election = await prisma.election.create({
    data: {
      title: parsed.data.title,
      startAt: new Date(parsed.data.startAt),
      endAt: new Date(parsed.data.endAt),
      status: "DRAFT",
    },
  });

  await appendAuditLog(election.id, "ELECTION_CREATED", { title: election.title });

  return NextResponse.json({ election }, { status: 201 });
}
