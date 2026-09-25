import "dotenv/config";
import { io as ioClient, Socket } from "socket.io-client";
import { prisma } from "../src/lib/prisma";
import { signSession } from "../src/lib/session-token";

const SERVER_URL = process.env.VERIFY_SERVER_URL ?? "http://localhost:3000";

function connectAs(sub: string, name: string, email: string, role: "STUDENT" | "ADMIN"): Socket {
  const token = signSession({ sub, name, email, role });
  return ioClient(SERVER_URL, {
    path: "/socket.io",
    extraHeaders: { Cookie: `evoting_session=${token}` },
    transports: ["websocket"],
  });
}

async function main() {
  const admin = await prisma.admin.findUniqueOrThrow({ where: { email: "admin@kampus.dev" } });
  const student = await prisma.student.findUniqueOrThrow({ where: { email: "citra@kampus.dev" } });

  const now = new Date();
  const election = await prisma.election.create({
    data: {
      title: `Test Realtime Results ${Date.now()}`,
      status: "OPEN",
      startAt: now,
      endAt: new Date(now.getTime() + 1000 * 60 * 60),
    },
  });
  const candidate = await prisma.candidate.create({
    data: { electionId: election.id, name: "Kandidat Uji", vision: "-", mission: "-" },
  });

  // --- 1. Mahasiswa TIDAK BOLEH join room hasil selagi election masih OPEN. ---
  const studentSocket = connectAs(student.id, student.name, student.email, "STUDENT");
  await new Promise<void>((resolve) => studentSocket.on("connect", () => resolve()));
  let studentReceivedWhileOpen = false;
  studentSocket.on("election:closed", () => {
    studentReceivedWhileOpen = true;
  });
  studentSocket.emit("results:join", { electionId: election.id });
  await new Promise((r) => setTimeout(r, 300));

  // --- 2. Admin BOLEH join & memantau room kapan pun (termasuk saat OPEN). ---
  const adminSocket = connectAs(admin.id, admin.name, admin.email, "ADMIN");
  await new Promise<void>((resolve) => adminSocket.on("connect", () => resolve()));
  adminSocket.emit("results:join", { electionId: election.id });
  await new Promise((r) => setTimeout(r, 300));

  const closedEventPromise = new Promise<{ candidates: { id: string; voteCount: number }[] }>((resolve) => {
    adminSocket.on("election:closed", (payload) => resolve(payload));
  });

  // --- 3. Mahasiswa memberi satu suara (lewat endpoint HTTP sungguhan). ---
  const studentToken = signSession({ sub: student.id, name: student.name, email: student.email, role: "STUDENT" });
  const voteRes = await fetch(`${SERVER_URL}/api/elections/${election.id}/vote`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: `evoting_session=${studentToken}` },
    body: JSON.stringify({ candidateId: candidate.id }),
  });
  if (voteRes.status !== 200) throw new Error(`GAGAL: vote seharusnya sukses, HTTP ${voteRes.status}`);

  // --- 4. Admin menutup pemilihan lewat endpoint HTTP sungguhan. ---
  console.log("[verify] Admin menutup pemilihan lewat API sungguhan, menunggu event realtime di socket admin...");
  const adminToken = signSession({ sub: admin.id, name: admin.name, email: admin.email, role: "ADMIN" });
  const closeRes = await fetch(`${SERVER_URL}/api/elections/${election.id}/close`, {
    method: "POST",
    headers: { Cookie: `evoting_session=${adminToken}` },
  });
  if (closeRes.status !== 200) throw new Error(`GAGAL: close seharusnya sukses, HTTP ${closeRes.status}`);

  const closedEvent = await Promise.race([
    closedEventPromise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout menunggu event election:closed")), 5000)),
  ]);

  console.log("[verify] Admin menerima event election:closed secara realtime:", closedEvent.candidates);

  const finalCandidate = closedEvent.candidates.find((c) => c.id === candidate.id);
  if (!finalCandidate || finalCandidate.voteCount !== 1) {
    throw new Error(`GAGAL: voteCount pada event realtime seharusnya 1, didapat ${finalCandidate?.voteCount}`);
  }

  if (studentReceivedWhileOpen) {
    throw new Error("GAGAL: mahasiswa yang mencoba join room saat OPEN seharusnya tidak menerima event apa pun");
  }

  console.log(
    "[verify] BERHASIL: (a) mahasiswa ditolak join room hasil selama voting masih OPEN, (b) admin yang memantau room menerima tally final secara REALTIME lewat WebSocket persis saat pemilihan ditutup, dengan angka yang benar - tanpa polling atau refresh."
  );

  studentSocket.disconnect();
  adminSocket.disconnect();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((error) => {
  console.error("[verify] ERROR:", error);
  process.exit(1);
});
