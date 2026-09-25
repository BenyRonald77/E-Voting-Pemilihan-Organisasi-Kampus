import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { appendAuditLog } from "../src/lib/audit-log";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("password123", 10);

  await prisma.admin.upsert({
    where: { email: "admin@kampus.dev" },
    update: {},
    create: { name: "Panitia Pemilihan", email: "admin@kampus.dev", passwordHash },
  });

  const students = [
    { nim: "2021001", name: "Andi Mahasiswa", email: "andi@kampus.dev" },
    { nim: "2021002", name: "Bunga Mahasiswa", email: "bunga@kampus.dev" },
    { nim: "2021003", name: "Citra Mahasiswa", email: "citra@kampus.dev" },
  ];
  for (const s of students) {
    await prisma.student.upsert({ where: { email: s.email }, update: {}, create: { ...s, passwordHash } });
  }

  const existingElection = await prisma.election.findFirst({ where: { title: "Pemilihan Ketua BEM 2026" } });
  if (!existingElection) {
    const now = new Date();
    const election = await prisma.election.create({
      data: {
        title: "Pemilihan Ketua BEM 2026",
        status: "DRAFT",
        startAt: now,
        endAt: new Date(now.getTime() + 1000 * 60 * 60 * 24 * 3),
      },
    });
    await appendAuditLog(election.id, "ELECTION_CREATED", { title: election.title });

    const candidates = [
      { name: "Pasangan A", vision: "Kampus inklusif dan progresif", mission: "Transparansi anggaran, ruang diskusi terbuka", photoEmoji: "🅰️" },
      { name: "Pasangan B", vision: "Kampus kolaboratif dan berdaya saing", mission: "Kemitraan industri, beasiswa lebih banyak", photoEmoji: "🅱️" },
    ];
    for (const c of candidates) {
      const candidate = await prisma.candidate.create({ data: { electionId: election.id, ...c } });
      await appendAuditLog(election.id, "CANDIDATE_ADDED", { candidateId: candidate.id, name: candidate.name });
    }
  }

  console.log("Seed selesai.");
  console.log("Login admin: admin@kampus.dev / password123");
  console.log("Login mahasiswa: andi@kampus.dev / bunga@kampus.dev / citra@kampus.dev - password123");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
