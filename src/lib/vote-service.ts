import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { appendAuditLog } from "./audit-log";
import { broadcastResultsUpdate } from "./realtime";

export class VoteError extends Error {}

const TRANSACTION_OPTIONS = { timeout: 15000, maxWait: 15000 };

export async function castVote(studentId: string, electionId: string, candidateId: string) {
  const election = await prisma.election.findUnique({ where: { id: electionId } });
  if (!election || election.status !== "OPEN") {
    throw new VoteError("Pemilihan ini sedang tidak dibuka untuk voting");
  }

  const now = new Date();
  if (now < election.startAt || now > election.endAt) {
    throw new VoteError("Di luar periode waktu voting");
  }

  const candidate = await prisma.candidate.findUnique({ where: { id: candidateId } });
  if (!candidate || candidate.electionId !== electionId) {
    throw new VoteError("Kandidat tidak ditemukan di pemilihan ini");
  }

  try {
    await prisma.$transaction(async (tx) => {
      // UNIQUE constraint (studentId, electionId) di level database yang
      // menjamin satu mahasiswa satu suara - jika sudah ada, ini akan
      // melempar P2002 dan seluruh transaksi dibatalkan (rollback),
      // termasuk increment voteCount & pencatatan Ballot di bawah.
      await tx.voteRecord.create({ data: { studentId, electionId } });

      await tx.candidate.update({
        where: { id: candidateId },
        data: { voteCount: { increment: 1 } },
      });

      // Ballot SENGAJA tidak menyimpan studentId - suara terpisah dari identitas.
      await tx.ballot.create({ data: { electionId, candidateId } });

      await appendAuditLog(electionId, "VOTE_CAST", { note: "Satu suara masuk" }, tx);
    }, TRANSACTION_OPTIONS);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new VoteError("Anda sudah memilih di pemilihan ini");
    }
    throw error;
  }

  const candidates = await prisma.candidate.findMany({
    where: { electionId },
    select: { id: true, name: true, voteCount: true },
  });
  broadcastResultsUpdate(electionId, { candidates });
}
