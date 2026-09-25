import { createHash } from "crypto";
import { prisma } from "./prisma";
import type { AuditAction } from "./types";

const GENESIS_HASH = "0".repeat(64);

function computeHash(prevHash: string, action: string, details: string, createdAt: string): string {
  return createHash("sha256").update(prevHash + action + details + createdAt).digest("hex");
}

/**
 * Menambah satu entri ke hash chain audit trail. Menerima `tx` (Prisma
 * transaction client) opsional supaya bisa dipanggil di dalam transaksi
 * yang sama dengan operasi lain (mis. pencatatan suara) agar konsisten.
 */
export async function appendAuditLog(
  electionId: string,
  action: AuditAction,
  details: Record<string, unknown>,
  tx: Pick<typeof prisma, "auditLog"> = prisma
) {
  const last = await tx.auditLog.findFirst({
    where: { electionId },
    orderBy: { createdAt: "desc" },
  });

  const prevHash = last?.hash ?? GENESIS_HASH;
  const createdAt = new Date();
  const detailsJson = JSON.stringify(details);
  const hash = computeHash(prevHash, action, detailsJson, createdAt.toISOString());

  return tx.auditLog.create({
    data: { electionId, action, details: detailsJson, prevHash, hash, createdAt },
  });
}

export interface VerifyChainResult {
  valid: boolean;
  brokenAtIndex: number | null;
  totalEntries: number;
}

/**
 * Menghitung ulang seluruh rantai hash dan membandingkannya dengan hash
 * yang tersimpan. Jika satu entri saja diubah setelah dibuat (atau
 * disisipkan/dihapus di luar proses appendAuditLog), verifikasi akan
 * gagal tepat di titik entri yang tidak konsisten.
 */
export async function verifyAuditChain(electionId: string): Promise<VerifyChainResult> {
  const entries = await prisma.auditLog.findMany({
    where: { electionId },
    orderBy: { createdAt: "asc" },
  });

  let expectedPrevHash = GENESIS_HASH;
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (entry.prevHash !== expectedPrevHash) {
      return { valid: false, brokenAtIndex: i, totalEntries: entries.length };
    }
    const recomputedHash = computeHash(entry.prevHash, entry.action, entry.details, entry.createdAt.toISOString());
    if (recomputedHash !== entry.hash) {
      return { valid: false, brokenAtIndex: i, totalEntries: entries.length };
    }
    expectedPrevHash = entry.hash;
  }

  return { valid: true, brokenAtIndex: null, totalEntries: entries.length };
}
