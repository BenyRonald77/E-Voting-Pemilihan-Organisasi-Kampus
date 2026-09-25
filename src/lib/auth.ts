import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";
import {
  SESSION_COOKIE_NAME,
  signSession,
  verifySession,
  getSessionCookieOptions,
  type SessionPayload,
} from "./session-token";

export { SESSION_COOKIE_NAME, signSession, verifySession, getSessionCookieOptions };

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function getSession(): SessionPayload | null {
  const token = cookies().get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export async function requireStudent() {
  const session = getSession();
  if (!session || session.role !== "STUDENT") return null;
  return prisma.student.findUnique({ where: { id: session.sub } });
}

export async function requireAdmin() {
  const session = getSession();
  if (!session || session.role !== "ADMIN") return null;
  return prisma.admin.findUnique({ where: { id: session.sub } });
}
