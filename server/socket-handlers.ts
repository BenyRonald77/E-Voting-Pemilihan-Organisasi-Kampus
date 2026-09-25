import type { Server as SocketIOServer, Socket } from "socket.io";
import { prisma } from "../src/lib/prisma";
import type { SessionPayload } from "../src/lib/session-token";

export function registerSocketHandlers(io: SocketIOServer) {
  io.on("connection", (socket: Socket) => {
    const session = socket.data.session as SessionPayload;

    socket.on("results:join", async (payload: { electionId: string }) => {
      const election = await prisma.election.findUnique({ where: { id: payload.electionId } });
      if (!election) return;

      // Admin boleh memantau tally live kapan pun (operasional). Mahasiswa
      // hanya boleh melihat hasil SETELAH pemilihan ditutup - ini yang
      // membuat "hasil realtime setelah voting ditutup" benar-benar berarti
      // (bukan bisa mengintip hasil sementara saat voting masih berjalan).
      if (session.role !== "ADMIN" && election.status !== "CLOSED") return;

      socket.join(`election:${payload.electionId}`);
    });
  });
}
