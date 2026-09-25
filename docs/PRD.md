# PRD — E-Voting Pemilihan Organisasi Kampus

## 1. Latar Belakang

Pemilihan ketua/organisasi kampus (BEM, himpunan, dst) dipindahkan ke
platform digital. Mahasiswa login, memilih satu kandidat pada satu
pemilihan, dan hasil bisa dipertanggungjawabkan (dapat diverifikasi tidak
dimanipulasi) tanpa membocorkan siapa memilih siapa.

## 2. Tujuan

1. **Satu mahasiswa satu suara** — dijamin di level database (`UNIQUE
   constraint`), bukan hanya validasi di kode aplikasi, sehingga tetap
   benar walau ada dua request bersamaan dari mahasiswa yang sama.
2. **Suara terpisah dari identitas pemilih** (*secret ballot*) — tabel
   suara (`Ballot`) sama sekali tidak menyimpan kolom/relasi ke
   mahasiswa; bukti "sudah memilih" (`VoteRecord`) dan isi suara
   (`Ballot`) sengaja dipisah ke dua tabel berbeda yang tidak saling
   terhubung.
3. **Hasil realtime setelah voting ditutup** — begitu admin menutup
   pemilihan, halaman hasil yang sedang dibuka pengguna langsung
   menerima tally final lewat push (WebSocket), tanpa perlu refresh.
4. **Audit trail yang bisa diverifikasi** — setiap aksi penting
   (pemilihan dibuka/ditutup, kandidat ditambah, suara masuk) dicatat
   sebagai **hash chain** (mirip blockchain sederhana): tiap entri
   menyertakan hash entri sebelumnya, sehingga manipulasi/penyisipan/
   penghapusan entri di tengah bisa dideteksi dengan menghitung ulang
   rantai hash-nya.

## 3. Solusi Teknis

### 3.1 Satu mahasiswa satu suara — UNIQUE constraint

```prisma
model VoteRecord {
  id         String @id @default(cuid())
  studentId  String
  electionId String
  votedAt    DateTime @default(now())

  @@unique([studentId, electionId])
}
```

Saat submit suara, server mencoba `INSERT` ke `VoteRecord` dulu. Karena
constraint unik ini ditegakkan atomik oleh database, jika dua request
bersamaan datang dari mahasiswa yang sama, **hanya satu** yang berhasil
insert — yang kedua gagal dengan error constraint (ditangkap dan
dikembalikan sebagai "sudah memilih"), tanpa race condition.

### 3.2 Suara rahasia — pemisahan tabel

```
VoteRecord(studentId, electionId)      <- BUKTI mahasiswa X sudah memilih di pemilihan Y
                                            (tidak menyimpan kandidat pilihannya)
Ballot(electionId, candidateId, castAt) <- ISI suara (tidak menyimpan siapa pemilihnya)
```

Kedua insert terjadi dalam satu transaksi database (agar konsisten: tidak
mungkin ada `VoteRecord` tanpa `Ballot` yang sesuai atau sebaliknya), tapi
secara SKEMA tidak ada foreign key atau kolom apa pun di `Ballot` yang
menunjuk balik ke mahasiswa — bahkan dump database penuh tidak bisa
menghubungkan satu suara ke pemilihnya secara langsung.

### 3.3 Hasil realtime setelah ditutup

Server custom (Next.js + Socket.IO) menyiarkan event ke room
`election:<id>` setiap kali admin menutup pemilihan
(`POST /api/elections/:id/close`) — klien yang sedang membuka halaman
hasil menerima tally final secara instan lewat WebSocket, bukan lewat
polling atau refresh manual.

### 3.4 Audit trail terverifikasi — hash chain

```
entry.hash = SHA256(entry.prevHash + entry.action + JSON(entry.details) + entry.createdAt)
```

Setiap aksi (`ELECTION_CREATED`, `ELECTION_OPENED`, `VOTE_CAST`,
`ELECTION_CLOSED`) menambah satu entri yang meng-hash entri sebelumnya.
Fungsi `verifyAuditChain(electionId)` menghitung ulang seluruh rantai dan
membandingkan dengan hash tersimpan — jika ada satu entri saja yang
diubah/disisipkan/dihapus di luar proses resmi, verifikasi akan gagal di
titik tersebut.

## 4. Model Data (ringkas)

- `Student` — `nim`, `name`, `email`, `passwordHash`.
- `Admin` — akun panitia pemilihan.
- `Election` — `title`, `status` (DRAFT/OPEN/CLOSED), `startAt`, `endAt`.
- `Candidate` — `electionId`, `name`, `vision`, `mission`, `voteCount`
  (counter didenormalisasi, di-increment atomik saat suara masuk).
- `VoteRecord` — bukti sudah memilih (lihat 3.1).
- `Ballot` — isi suara anonim (lihat 3.2).
- `AuditLog` — hash chain (lihat 3.4).

## 5. Verifikasi yang direncanakan

- `verify-one-vote-per-student.ts` — mengirim **request vote konkuren**
  (`Promise.all`) dari mahasiswa yang sama, memverifikasi TEPAT satu yang
  berhasil dan sisanya ditolak, serta `Candidate.voteCount` bertambah
  tepat 1 (bukan lebih).
- `verify-ballot-secrecy.ts` — memeriksa langsung skema/isi tabel
  `Ballot`, memverifikasi tidak ada kolom yang menunjuk ke `studentId`
  atau data mahasiswa mana pun.
- `verify-realtime-results.ts` — klien socket bergabung ke room hasil,
  admin menutup pemilihan lewat API, memverifikasi klien menerima event
  hasil final tanpa polling.
- `verify-audit-chain.ts` — menjalankan siklus pemilihan penuh (buat →
  buka → beberapa suara → tutup), memverifikasi `verifyAuditChain`
  mengembalikan valid; lalu **sengaja mengubah satu entri log di
  database**, memverifikasi fungsi verifikasi mendeteksi dan melaporkan
  titik manipulasinya.

## 6. Di luar cakupan (v1)

- Verifikasi identitas mahasiswa via SSO kampus sungguhan (pakai
  login+password sederhana).
- Enkripsi suara end-to-end (homomorphic encryption dsb) — v1 cukup
  memisahkan tabel secara skema untuk anonimitas.
- Multi-kandidat per posisi berbeda dalam satu pemilihan (v1: satu
  pemilihan = satu daftar kandidat).
