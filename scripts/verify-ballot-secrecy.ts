import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("[verify] Memeriksa skema tabel Ballot secara langsung di database...");

  const columns = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("Ballot")`);
  const columnNames = columns.map((c) => c.name);
  console.log("[verify] Kolom pada tabel Ballot:", columnNames);

  const forbiddenNames = ["studentId", "student_id", "nim", "voterId", "voter_id"];
  const leaked = columnNames.filter((name) => forbiddenNames.some((f) => name.toLowerCase() === f.toLowerCase()));

  if (leaked.length > 0) {
    throw new Error(`GAGAL: tabel Ballot memiliki kolom yang membocorkan identitas pemilih: ${leaked.join(", ")}`);
  }

  console.log("[verify] BERHASIL: tidak ada kolom identitas mahasiswa di tabel Ballot (secara skema, suara tidak bisa ditelusuri balik ke pemilih).");

  const election = await prisma.election.findFirstOrThrow({ where: { title: "Pemilihan Ketua BEM 2026" } });
  const ballot = await prisma.ballot.findFirst({ where: { electionId: election.id } });
  if (ballot) {
    const ballotKeys = Object.keys(ballot);
    console.log("[verify] Contoh isi baris Ballot (semua field):", ballotKeys);
    const leakedKeys = ballotKeys.filter((k) => forbiddenNames.some((f) => k.toLowerCase() === f.toLowerCase()));
    if (leakedKeys.length > 0) {
      throw new Error(`GAGAL: baris Ballot mengandung field identitas: ${leakedKeys.join(", ")}`);
    }
    console.log("[verify] BERHASIL: baris Ballot nyata di database juga tidak mengandung field identitas mahasiswa manapun.");
  }

  // Pastikan pula VoteRecord (bukti sudah memilih) TIDAK menyimpan kandidat pilihan.
  const voteRecordColumns = await prisma.$queryRawUnsafe<{ name: string }[]>(`PRAGMA table_info("VoteRecord")`);
  const voteRecordColumnNames = voteRecordColumns.map((c) => c.name);
  console.log("[verify] Kolom pada tabel VoteRecord:", voteRecordColumnNames);
  if (voteRecordColumnNames.some((n) => n.toLowerCase().includes("candidate"))) {
    throw new Error("GAGAL: VoteRecord seharusnya tidak menyimpan kandidat pilihan (itu akan membocorkan pilihan mahasiswa)");
  }
  console.log("[verify] BERHASIL: VoteRecord (bukti memilih) tidak menyimpan kandidat pilihan - suara benar-benar terpisah dari bukti identitas.");

  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("[verify] ERROR:", error);
  process.exit(1);
});
