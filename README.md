# E-Voting Pemilihan Organisasi Kampus

Pemilihan organisasi kampus digital: **satu mahasiswa satu suara**
(dijamin di database), **suara terpisah dari identitas pemilih** (secret
ballot lewat pemisahan tabel), **hasil realtime setelah voting ditutup**
(Socket.IO), dan **audit trail yang bisa diverifikasi** (hash chain).

## Satu mahasiswa satu suara — UNIQUE constraint

```prisma
model VoteRecord {
  studentId  String
  electionId String
  @@unique([studentId, electionId])
}
```

Bukan validasi aplikasi ("cek dulu sudah vote apa belum, baru insert") yang
rentan race condition — melainkan constraint yang ditegakkan atomik oleh
database itu sendiri saat `INSERT`. Dua request vote bersamaan dari
mahasiswa yang sama: hanya satu yang berhasil, yang lain gagal dengan error
constraint (ditangkap dan dikembalikan sebagai "sudah memilih").

**Dibuktikan nyata**, bukan diasumsikan: `scripts/verify-one-vote-per-student.ts`
mengirim 10 permintaan vote **konkuren** (`Promise.all`) dari mahasiswa yang
sama — hasil aktual: tepat 1 berhasil, 9 ditolak, `voteCount` kandidat
bertambah tepat 1.

## Suara rahasia — pemisahan tabel, bukan enkripsi

```
VoteRecord(studentId, electionId)       <- bukti SUDAH memilih (tanpa kandidat)
Ballot(electionId, candidateId, castAt)  <- isi suara (TANPA studentId sama sekali)
```

Kedua insert terjadi dalam satu transaksi (`src/lib/vote-service.ts`) agar
konsisten, tapi secara skema `Ballot` tidak punya kolom atau relasi apa pun
ke `Student` — bahkan dump database penuh tidak bisa menautkan satu suara
ke pemilihnya. Diverifikasi langsung lewat `PRAGMA table_info` di
`scripts/verify-ballot-secrecy.ts` (bukan hanya membaca kode).

## Hasil realtime setelah ditutup

Server custom (Next.js + Socket.IO) menyiarkan tally final ke room
`election:<id>` tepat saat admin menutup pemilihan
(`POST /api/elections/:id/close`). Mahasiswa **tidak diizinkan** bergabung
ke room hasil selama pemilihan masih `OPEN` (dicegah di
`server/socket-handlers.ts`) — supaya hasil sementara tidak bisa diintip
dan memengaruhi pemilih lain. Admin boleh memantau tally live kapan pun
untuk keperluan operasional.

Diverifikasi lewat `scripts/verify-realtime-results.ts`: klien admin yang
sedang memantau room menerima event `election:closed` berisi tally final
yang benar, **tanpa polling**, persis saat admin menutup pemilihan lewat
API sungguhan.

## Audit trail terverifikasi — hash chain

```
entry.hash = SHA256(entry.prevHash + action + JSON(details) + createdAt)
```

Setiap aksi penting (`ELECTION_CREATED`, `CANDIDATE_ADDED`,
`ELECTION_OPENED`, `VOTE_CAST`, `ELECTION_CLOSED`) menambah satu entri yang
mengunci entri sebelumnya via hash — mirip blockchain sederhana. Fungsi
`verifyAuditChain()` menghitung ulang seluruh rantai dan mendeteksi
manipulasi apa pun.

**Dibuktikan nyata**: `scripts/verify-audit-chain.ts` menjalankan siklus
pemilihan penuh, memverifikasi chain valid, lalu **sengaja mengubah satu
entri log langsung di database** — hasil aktual: verifikasi mendeteksi
manipulasi tepat di entri yang diubah, bukan di entri lain.

## Verifikasi lengkap

- `verify-one-vote-per-student.ts` — 10 vote konkuren dari mahasiswa
  sama → tepat 1 berhasil.
- `verify-ballot-secrecy.ts` — skema & isi tabel `Ballot` diperiksa
  langsung, tidak ada kolom identitas.
- `verify-realtime-results.ts` — event realtime diterima persis saat
  penutupan, dengan angka yang benar; mahasiswa ditolak mengintip hasil
  selama `OPEN`.
- `verify-audit-chain.ts` — siklus penuh + manipulasi sengaja → terdeteksi
  tepat di titik manipulasi.

## Menjalankan secara lokal

```bash
cp .env.example .env
npm install

npx prisma db push
npm run prisma:seed             # admin + 3 mahasiswa + 1 pemilihan contoh (DRAFT)

npm run dev                      # custom server (Next.js + Socket.IO) di :3000
```

Login demo: `admin@kampus.dev` (panitia), `andi@kampus.dev` /
`bunga@kampus.dev` / `citra@kampus.dev` (mahasiswa) — password
`password123` untuk semua akun.

Alur: login admin → buka `/admin` → buka pemilihan contoh yang sudah punya
2 kandidat → login mahasiswa → buka `/dashboard` → pilih kandidat → admin
tutup pemilihan → hasil muncul realtime di halaman mahasiswa yang sedang
menunggu.

## Kenapa custom server, bukan `next dev` biasa?

Socket.IO perlu menempel pada HTTP server yang sama dengan Next.js. Untuk
menghindari isu `AsyncLocalStorage` yang pernah ditemukan di proyek
realtime sebelumnya (import `next/headers` di proses yang dijalankan lewat
`tsx`), logika JWT dipisah ke `src/lib/session-token.ts` (tanpa dependensi
`next/headers`) dan hanya file itu yang diimpor `server/index.ts`.
Instance Socket.IO diakses dari dalam API routes lewat `socket-registry.ts`
yang memakai pola `globalThis` (bukan variabel module-level biasa) — karena
Next.js membundel API routes secara terpisah dari kode yang dimuat langsung
oleh `tsx`, sehingga variabel module-level biasa bisa punya dua instance
berbeda dalam satu proses (bug nyata yang ditemukan & diperbaiki di proyek
dispatch sebelumnya).

## Struktur proyek

```
server/
  index.ts                Custom server: Next.js + Socket.IO + auth handshake
  socket-handlers.ts        Event results:join (dengan kontrol akses OPEN/CLOSED)
src/lib/
  vote-service.ts            castVote() - transaksi VoteRecord+Candidate+Ballot+audit
  audit-log.ts                 Hash chain: appendAuditLog, verifyAuditChain
  socket-registry.ts             Akses instance Socket.IO dari API routes (globalThis)
  realtime.ts                     Broadcast results:update, election:closed
src/app/
  api/elections/                   CRUD pemilihan, kandidat, vote, hasil, audit
  dashboard/                        UI mahasiswa: pilih kandidat, lihat hasil
  admin/                             UI admin: kelola pemilihan, tally live, audit trail
scripts/
  verify-*.ts                       Skrip verifikasi end-to-end
```

## Di luar cakupan (v1)

- Verifikasi identitas mahasiswa via SSO kampus sungguhan.
- Enkripsi suara end-to-end (homomorphic encryption dsb).
- Multi-kandidat per posisi berbeda dalam satu pemilihan.
