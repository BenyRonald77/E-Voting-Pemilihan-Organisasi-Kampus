import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { appendAuditLog, verifyAuditChain } from "../src/lib/audit-log";
import { castVote } from "../src/lib/vote-service";

async function main() {
  const now = new Date();
  const election = await prisma.election.create({
    data: {
      title: `Test Audit Chain ${Date.now()}`,
      status: "DRAFT",
      startAt: now,
      endAt: new Date(now.getTime() + 1000 * 60 * 60),
    },
  });
  await appendAuditLog(election.id, "ELECTION_CREATED", { title: election.title });

  const candidateA = await prisma.candidate.create({
    data: { electionId: election.id, name: "Kandidat A", vision: "-", mission: "-" },
  });
  await appendAuditLog(election.id, "CANDIDATE_ADDED", { candidateId: candidateA.id, name: candidateA.name });

  const candidateB = await prisma.candidate.create({
    data: { electionId: election.id, name: "Kandidat B", vision: "-", mission: "-" },
  });
  await appendAuditLog(election.id, "CANDIDATE_ADDED", { candidateId: candidateB.id, name: candidateB.name });

  await prisma.election.update({ where: { id: election.id }, data: { status: "OPEN" } });
  await appendAuditLog(election.id, "ELECTION_OPENED", {});

  const student1 = await prisma.student.findUniqueOrThrow({ where: { email: "andi@kampus.dev" } });
  const student2 = await prisma.student.findUniqueOrThrow({ where: { email: "bunga@kampus.dev" } });
  await castVote(student1.id, election.id, candidateA.id);
  await castVote(student2.id, election.id, candidateB.id);

  await prisma.election.update({ where: { id: election.id }, data: { status: "CLOSED" } });
  await appendAuditLog(election.id, "ELECTION_CLOSED", {});

  console.log("[verify] Siklus pemilihan penuh selesai (buat -> kandidat -> buka -> 2 suara -> tutup).");

  const validResult = await verifyAuditChain(election.id);
  console.log("[verify] Verifikasi hash chain (sebelum manipulasi):", validResult);
  if (!validResult.valid) {
    throw new Error("GAGAL: hash chain seharusnya VALID sebelum ada manipulasi apa pun");
  }
  console.log(`[verify] BERHASIL: hash chain valid, ${validResult.totalEntries} entri terverifikasi berurutan.`);

  // Sekarang SENGAJA memanipulasi satu entri log di tengah rantai secara langsung di database
  // (mensimulasikan skenario seseorang mengubah data audit log tanpa lewat proses resmi).
  const entries = await prisma.auditLog.findMany({ where: { electionId: election.id }, orderBy: { createdAt: "asc" } });
  const targetEntry = entries[2]; // salah satu entri CANDIDATE_ADDED
  console.log(`[verify] Sengaja mengubah field 'details' pada entri ke-3 (${targetEntry.action}) secara langsung di database...`);
  await prisma.auditLog.update({
    where: { id: targetEntry.id },
    data: { details: JSON.stringify({ tampered: true }) },
  });

  const tamperedResult = await verifyAuditChain(election.id);
  console.log("[verify] Verifikasi hash chain (setelah manipulasi):", tamperedResult);

  if (tamperedResult.valid) {
    throw new Error("GAGAL: verifikasi seharusnya mendeteksi manipulasi, tapi melaporkan chain masih valid");
  }
  if (tamperedResult.brokenAtIndex !== 2) {
    throw new Error(`GAGAL: manipulasi seharusnya terdeteksi tepat di index 2, terdeteksi di index ${tamperedResult.brokenAtIndex}`);
  }

  console.log(
    `[verify] BERHASIL: manipulasi terdeteksi TEPAT di entri yang diubah (index ${tamperedResult.brokenAtIndex}) - audit trail terbukti bisa diverifikasi, bukan hanya diklaim.`
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("[verify] ERROR:", error);
  process.exit(1);
});
