import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { verifyAuditChain } from "@/lib/audit-log";

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const session = getSession();
  if (!session) {
    return NextResponse.json({ error: "Belum login" }, { status: 401 });
  }

  const entries = await prisma.auditLog.findMany({
    where: { electionId: params.id },
    orderBy: { createdAt: "asc" },
    select: { id: true, action: true, details: true, hash: true, prevHash: true, createdAt: true },
  });

  const verification = await verifyAuditChain(params.id);

  return NextResponse.json({ entries, verification });
}
