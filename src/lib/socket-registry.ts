import type { Server as SocketIOServer } from "socket.io";

// Next.js membundel API routes secara terpisah dari kode yang di-load
// langsung oleh tsx di server/index.ts, sehingga modul ini bisa punya DUA
// instance berbeda dalam satu proses Node yang sama (module duplication -
// ditemukan sebagai bug nyata di proyek dispatch sebelumnya). globalThis
// dipakai di sini karena ia benar-benar satu per-proses, bukan
// per-instance-modul, sehingga io instance yang di-set di server/index.ts
// tetap terlihat oleh kode yang berjalan di dalam API routes.
const globalForIO = globalThis as unknown as {
  ioInstance: SocketIOServer | null | undefined;
};

export function setIO(io: SocketIOServer) {
  globalForIO.ioInstance = io;
}

export function getIO(): SocketIOServer | null {
  return globalForIO.ioInstance ?? null;
}
