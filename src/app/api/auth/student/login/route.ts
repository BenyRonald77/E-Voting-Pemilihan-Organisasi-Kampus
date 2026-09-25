import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { verifyPassword, signSession, SESSION_COOKIE_NAME, getSessionCookieOptions } from "@/lib/auth";

const schema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function POST(request: NextRequest) {
  const body = await request.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Data tidak valid" }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const student = await prisma.student.findUnique({ where: { email } });
  if (!student || !(await verifyPassword(password, student.passwordHash))) {
    return NextResponse.json({ error: "Email atau password salah" }, { status: 401 });
  }

  const token = signSession({ sub: student.id, name: student.name, email: student.email, role: "STUDENT" });
  const response = NextResponse.json({ student: { id: student.id, name: student.name, nim: student.nim } });
  response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  return response;
}
