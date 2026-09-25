import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { hashPassword, signSession, SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/lib/auth";

const schema = z.object({
  nim: z.string().min(3),
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(6),
});

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid", details: parsed.error.flatten() }, { status: 400 });
  }

  const { nim, name, email, password } = parsed.data;
  const existing = await prisma.student.findFirst({ where: { OR: [{ email }, { nim }] } });
  if (existing) {
    return NextResponse.json({ error: "NIM atau email sudah terdaftar" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);
  const student = await prisma.student.create({ data: { nim, name, email, passwordHash } });

  const token = signSession({ sub: student.id, name: student.name, email: student.email, role: "STUDENT" });
  const response = NextResponse.json({ student: { id: student.id, name: student.name, nim: student.nim } });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
