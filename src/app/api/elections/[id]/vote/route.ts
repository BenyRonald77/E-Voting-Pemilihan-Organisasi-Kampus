import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireStudent } from "@/lib/auth";
import { castVote, VoteError } from "@/lib/vote-service";

const schema = z.object({ candidateId: z.string().min(1) });

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  const student = await requireStudent();
  if (!student) {
    return NextResponse.json({ error: "Hanya mahasiswa yang bisa memilih" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  try {
    await castVote(student.id, params.id, parsed.data.candidateId);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof VoteError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    throw error;
  }
}
