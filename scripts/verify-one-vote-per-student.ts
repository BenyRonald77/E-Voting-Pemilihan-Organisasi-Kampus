import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { castVote, VoteError } from "../src/lib/vote-service";

async function main() {
  const student = await prisma.student.findUniqueOrThrow({ where: { email: "bunga@kampus.dev" } });
  const election = await prisma.election.findFirstOrThrow({
    where: { title: "Pemilihan Ketua BEM 2026" },
    include: { candidates: true },
  });

  if (election.status !== "OPEN") {
    throw new Error(`Pemilihan harus berstatus OPEN untuk test ini, saat ini: ${election.status}`);
  }

  // Bersihkan vote record milik student ini kalau ada sisa dari run sebelumnya.
  await prisma.voteRecord.deleteMany({ where: { studentId: student.id, electionId: election.id } });

  const candidateA = election.candidates[0];
  const candidateB = election.candidates[1];
  const beforeA = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateA.id } });
  const beforeB = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateB.id } });

  console.log(
    `[verify] Mengirim 10 permintaan vote KONKUREN (Promise.all) dari mahasiswa yang sama (${student.name})...`
  );

  const results = await Promise.allSettled(
    Array.from({ length: 10 }, (_, i) =>
      castVote(student.id, election.id, i % 2 === 0 ? candidateA.id : candidateB.id)
    )
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const rejected = results.filter((r) => r.status === "rejected").length;
  const rejectedWithVoteError = results.filter(
    (r) => r.status === "rejected" && r.reason instanceof VoteError
  ).length;

  console.log(`[verify] Hasil: ${succeeded} berhasil, ${rejected} ditolak (${rejectedWithVoteError} di antaranya VoteError "sudah memilih").`);

  if (succeeded !== 1) {
    throw new Error(`GAGAL: seharusnya TEPAT 1 vote berhasil dari 10 percobaan konkuren, didapat ${succeeded}`);
  }
  if (rejected !== 9 || rejectedWithVoteError !== 9) {
    throw new Error(`GAGAL: seharusnya 9 vote ditolak dengan VoteError, didapat ${rejected} ditolak (${rejectedWithVoteError} VoteError)`);
  }

  const recordCount = await prisma.voteRecord.count({ where: { studentId: student.id, electionId: election.id } });
  if (recordCount !== 1) {
    throw new Error(`GAGAL: seharusnya tepat 1 VoteRecord tersimpan, didapat ${recordCount}`);
  }

  const afterA = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateA.id } });
  const afterB = await prisma.candidate.findUniqueOrThrow({ where: { id: candidateB.id } });
  const totalIncrement = afterA.voteCount - beforeA.voteCount + (afterB.voteCount - beforeB.voteCount);

  if (totalIncrement !== 1) {
    throw new Error(`GAGAL: total voteCount kandidat seharusnya bertambah tepat 1, didapat ${totalIncrement}`);
  }

  console.log(
    `[verify] BERHASIL: dari 10 permintaan vote konkuren, TEPAT 1 yang berhasil tercatat (UNIQUE constraint studentId+electionId di database menahan 9 sisanya), dan voteCount kandidat bertambah tepat 1 - satu mahasiswa satu suara terbukti benar di bawah race condition sungguhan.`
  );

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("[verify] ERROR:", error);
  process.exit(1);
});
