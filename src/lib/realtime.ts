import { getIO } from "./socket-registry";

export function broadcastResultsUpdate(electionId: string, payload: Record<string, unknown>) {
  const io = getIO();
  if (!io) return;
  io.to(`election:${electionId}`).emit("results:update", { electionId, ...payload });
}

export function broadcastElectionClosed(electionId: string, payload: Record<string, unknown>) {
  const io = getIO();
  if (!io) return;
  io.to(`election:${electionId}`).emit("election:closed", { electionId, ...payload });
}
