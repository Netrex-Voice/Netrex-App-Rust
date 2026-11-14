// Güvenlik kuralı testleri (firestore.rules + database.rules.json), yerel emülatörde çalışır:
//   npm run test:rules      (Java gerekir; bu depoda tools/jdk17 kullanılabilir)
// Gerçek Firebase projesine ASLA bağlanmaz (proje: demo-netrex).

import { test, before, after, beforeEach } from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from "@firebase/rules-unit-testing";
import {
  doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc, collection, query, where, limit,
  writeBatch, increment, arrayUnion, arrayRemove, serverTimestamp, Timestamp, documentId, deleteField,
} from "firebase/firestore";
import { ref, set, get, remove } from "firebase/database";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SID = "srv1";
const OWNER = "owner";
const MOD = "mod";       // KICK_MEMBERS + MANAGE_CHANNELS rolü var
const MEMBER = "member"; // yalnızca varsayılan rol
const STRANGER = "stranger";

let env;
const fs_ = (uid) => env.authenticatedContext(uid).firestore();
const db_ = (uid) => env.authenticatedContext(uid).database();

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-netrex",
    firestore: { rules: fs.readFileSync(path.join(root, "firestore.rules"), "utf8"), host: "127.0.0.1", port: 8080 },
    database: { rules: fs.readFileSync(path.join(root, "database.rules.json"), "utf8"), host: "127.0.0.1", port: 9000 },
  });
});

after(async () => {
  await env.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.clearDatabase();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, "servers", SID), {
      name: "Sunucu", ownerId: OWNER, memberIds: [OWNER, MOD, MEMBER], defaultRoleId: "everyone",
    });
    await setDoc(doc(db, "servers", SID, "roles", "everyone"), { name: "@everyone", permissions: [] });
    await setDoc(doc(db, "servers", SID, "roles", "modrole"), { name: "Mod", permissions: ["KICK_MEMBERS", "MANAGE_CHANNELS"] });
    await setDoc(doc(db, "servers", SID, "meta", "perms"), { KICK_MEMBERS: ["modrole"], MANAGE_CHANNELS: ["modrole"] });
    await setDoc(doc(db, "servers", SID, "members", OWNER), { id: OWNER, roles: ["everyone"] });
    await setDoc(doc(db, "servers", SID, "members", MOD), { id: MOD, roles: ["everyone", "modrole"] });
    await setDoc(doc(db, "servers", SID, "members", MEMBER), { id: MEMBER, roles: ["everyone"] });
    await setDoc(doc(db, "servers", SID, "channels", "ch1"), { name: "genel", type: "text" });
    await setDoc(doc(db, "invites", "good"), { code: "good", serverId: SID, creatorId: OWNER, uses: 0, maxUses: 0, expiresAt: null });
    await setDoc(doc(db, "invites", "full"), { code: "full", serverId: SID, creatorId: OWNER, uses: 1, maxUses: 1, expiresAt: null });
    await setDoc(doc(db, "invites", "old"), {
      code: "old", serverId: SID, creatorId: OWNER, uses: 0, maxUses: 0, expiresAt: Timestamp.fromMillis(Date.now() - 60_000),
    });
    for (const u of [OWNER, MOD, MEMBER, STRANGER]) {
      await setDoc(doc(db, "users", u), { uid: u, displayName: u, presence: "online" });
    }
  });
});

/** Davetle katılma işlemi (istemcideki joinServer ile aynı toplu yazma). */
function joinBatch(uid, code, memberData = {}) {
  const db = fs_(uid);
  const batch = writeBatch(db);
  batch.set(doc(db, "servers", SID, "members", uid), { id: uid, userId: uid, roles: ["everyone"], inviteCode: code, ...memberData });
  batch.update(doc(db, "invites", code), { uses: increment(1) });
  batch.update(doc(db, "servers", SID), { memberIds: arrayUnion(uid) });
  return batch.commit();
}

// ───────────────────────── Sunucuya katılma ─────────────────────────

test("geçerli davetle katılma başarılı", async () => {
  await assertSucceeds(joinBatch(STRANGER, "good"));
});

test("davetsiz üyelik yazılamaz", async () => {
  const db = fs_(STRANGER);
  await assertFails(setDoc(doc(db, "servers", SID, "members", STRANGER), { id: STRANGER, roles: [] }));
  // Davet kodu verip sayacı artırmadan da olmaz
  await assertFails(setDoc(doc(db, "servers", SID, "members", STRANGER), { id: STRANGER, roles: [], inviteCode: "good" }));
});

test("katılırken kendine rol / susturma alanı verilemez", async () => {
  await assertFails(joinBatch(STRANGER, "good", { roles: ["modrole"] }));
  await assertFails(joinBatch(STRANGER, "good", { roles: ["everyone", "modrole"] }));
  await assertFails(joinBatch(STRANGER, "good", { badges: ["x"] }));
});

test("dolmuş ve süresi geçmiş davet reddedilir", async () => {
  await assertFails(joinBatch(STRANGER, "full"));
  await assertFails(joinBatch(STRANGER, "old"));
});

test("yasaklı kullanıcı katılamaz ve kendi yasağını silemez", async () => {
  await env.withSecurityRulesDisabled((ctx) =>
    setDoc(doc(ctx.firestore(), "servers", SID, "bans", STRANGER), { userId: STRANGER, reason: "test" }));
  await assertFails(joinBatch(STRANGER, "good"));
  await assertFails(deleteDoc(doc(fs_(STRANGER), "servers", SID, "bans", STRANGER)));
  await assertSucceeds(getDoc(doc(fs_(STRANGER), "servers", SID, "bans", STRANGER))); // "yasaklı mıyım?" okunabilir
});

test("üye olmayan kişi memberIds'e kendini ekleyemez (üyelik belgesi olmadan)", async () => {
  await assertFails(updateDoc(doc(fs_(STRANGER), "servers", SID), { memberIds: arrayUnion(STRANGER) }));
});

// ───────────────────────── Sunucu yönetimi ─────────────────────────

test("üye sunucuyu ele geçiremez", async () => {
  const db = fs_(MEMBER);
  await assertFails(updateDoc(doc(db, "servers", SID), { ownerId: MEMBER }));
  await assertFails(updateDoc(doc(db, "servers", SID), { name: "hacked" }));
  await assertFails(deleteDoc(doc(db, "servers", SID)));
  await assertFails(updateDoc(doc(db, "servers", SID, "members", MEMBER), { roles: ["everyone", "modrole"] }));
  await assertFails(setDoc(doc(db, "servers", SID, "roles", "evil"), { name: "x", permissions: ["MANAGE_SERVER"] }));
  await assertFails(setDoc(doc(db, "servers", SID, "meta", "perms"), { MANAGE_ROLES: ["everyone"] }));
  await assertFails(setDoc(doc(db, "servers", SID, "bans", MOD), { userId: MOD }));
  await assertFails(deleteDoc(doc(db, "servers", SID, "members", MOD)));
  await assertFails(setDoc(doc(db, "servers", SID, "channels", "yeni"), { name: "yeni", type: "text" }));
});

test("sahip bile ownerId'yi değiştiremez; diğer ayarları değiştirir", async () => {
  const db = fs_(OWNER);
  await assertFails(updateDoc(doc(db, "servers", SID), { ownerId: MEMBER }));
  await assertSucceeds(updateDoc(doc(db, "servers", SID), { name: "Yeni ad" }));
  await assertSucceeds(setDoc(doc(db, "servers", SID, "roles", "r2"), { name: "r2", permissions: [] }));
  await assertSucceeds(setDoc(doc(db, "servers", SID, "meta", "perms"), { KICK_MEMBERS: ["modrole"] }));
  await assertSucceeds(updateDoc(doc(db, "servers", SID, "members", MEMBER), { roles: ["everyone", "modrole"] }));
});

test("rol izni olan üye atabilir ve kanal yönetebilir; sahibi atamaz, rol veremez", async () => {
  const db = fs_(MOD);
  await assertSucceeds(setDoc(doc(db, "servers", SID, "channels", "yeni"), { name: "yeni", type: "text" }));
  await assertFails(deleteDoc(doc(db, "servers", SID, "members", OWNER)));
  await assertFails(updateDoc(doc(db, "servers", SID), { memberIds: arrayRemove(OWNER) }));
  await assertFails(updateDoc(doc(db, "servers", SID, "members", MEMBER), { roles: [] })); // MANAGE_ROLES yok
  await assertFails(setDoc(doc(db, "servers", SID, "bans", MEMBER), { userId: MEMBER })); // BAN_MEMBERS yok
  await assertSucceeds(deleteDoc(doc(db, "servers", SID, "members", MEMBER)));
  await assertSucceeds(updateDoc(doc(db, "servers", SID), { memberIds: arrayRemove(MEMBER) }));
});

test("üye kendi kaydını günceller ama rolüne/susturmasına dokunamaz; ayrılabilir", async () => {
  const db = fs_(MEMBER);
  await assertSucceeds(updateDoc(doc(db, "servers", SID, "members", MEMBER), { displayName: "Yeni", photoURL: null }));
  await assertFails(updateDoc(doc(db, "servers", SID, "members", MEMBER), { isMutedByServer: false }));
  await assertFails(updateDoc(doc(db, "servers", SID, "members", MEMBER), { badges: ["b1"] }));
  await assertSucceeds(deleteDoc(doc(db, "servers", SID, "members", MEMBER)));
  await assertSucceeds(updateDoc(doc(db, "servers", SID), { memberIds: arrayRemove(MEMBER) }));
});

test("üye başkasını memberIds'ten çıkaramaz", async () => {
  await assertFails(updateDoc(doc(fs_(MEMBER), "servers", SID), { memberIds: arrayRemove(MOD) }));
});

test("sunucu verisini yalnızca üyeler okur", async () => {
  await assertFails(getDocs(collection(fs_(STRANGER), "servers", SID, "channels")));
  await assertFails(getDocs(collection(fs_(STRANGER), "servers", SID, "members")));
  await assertFails(getDoc(doc(fs_(STRANGER), "servers", SID, "members", OWNER)));
  await assertSucceeds(getDoc(doc(fs_(STRANGER), "servers", SID, "members", STRANGER))); // "zaten üye miyim?"
  await assertSucceeds(getDoc(doc(fs_(STRANGER), "servers", SID))); // davet önizlemesi
  await assertSucceeds(getDocs(collection(fs_(MEMBER), "servers", SID, "channels")));
  await assertSucceeds(getDocs(collection(fs_(MEMBER), "servers", SID, "members")));
  await assertSucceeds(getDocs(query(collection(fs_(MEMBER), "servers"), where("memberIds", "array-contains", MEMBER))));
});

test("sunucu oluşturma: sahibi kendisi olmalı", async () => {
  const db = fs_(STRANGER);
  await assertFails(setDoc(doc(db, "servers", "s2"), { name: "x", ownerId: OWNER, memberIds: [STRANGER] }));
  await assertSucceeds(setDoc(doc(db, "servers", "s2"), { name: "x", ownerId: STRANGER, memberIds: [STRANGER] }));
  await assertSucceeds(setDoc(doc(db, "servers", "s2", "roles", "r"), { name: "@everyone", permissions: [] }));
  await assertSucceeds(setDoc(doc(db, "servers", "s2", "members", STRANGER), { id: STRANGER, roles: ["r"] }));
  await assertSucceeds(setDoc(doc(db, "servers", "s2", "channels", "c"), { name: "genel", type: "text" }));
});

test("davet: üye oluşturur, yabancı oluşturamaz, sayaç yalnızca 1 artar", async () => {
  const inv = { code: "n1", serverId: SID, creatorId: MEMBER, uses: 0, maxUses: 0, expiresAt: null };
  await assertSucceeds(setDoc(doc(fs_(MEMBER), "invites", "n1"), inv));
  await assertSucceeds(setDoc(doc(fs_(MEMBER), "servers", SID, "invites", "n1"), inv));
  await assertFails(setDoc(doc(fs_(STRANGER), "invites", "n2"), { ...inv, code: "n2", creatorId: STRANGER }));
  await assertFails(updateDoc(doc(fs_(STRANGER), "invites", "good"), { uses: 50 }));
  await assertFails(updateDoc(doc(fs_(STRANGER), "invites", "good"), { serverId: "baska" }));
  await assertFails(getDocs(collection(fs_(MEMBER), "invites")));
});

// ───────────────────────── Mesajlar ─────────────────────────

test("kanal mesajı: kendi adına yazılır, başkası adına yazılamaz", async () => {
  const col = (uid) => collection(fs_(uid), "servers", SID, "channels", "ch1", "messages");
  await assertSucceeds(setDoc(doc(col(MEMBER), "m1"), { userId: MEMBER, text: "selam", timestamp: 1 }));
  await assertSucceeds(setDoc(doc(col(MEMBER), "b1"), {
    userId: MEMBER, timestamp: 2, items: [{ id: "a", text: "bir", timestamp: 2 }, { id: "b", text: "iki", timestamp: 3 }],
  }));
  await assertFails(setDoc(doc(col(MEMBER), "m2"), { userId: OWNER, text: "sahte", timestamp: 1 }));
  await assertFails(setDoc(doc(col(STRANGER), "m3"), { userId: STRANGER, text: "dışarıdan", timestamp: 1 }));
  await assertFails(getDocs(col(STRANGER)));
});

test("kanal mesajı: düzenleme yazara, tepki herkese, silme yazara ya da yetkiliye", async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    const c = collection(ctx.firestore(), "servers", SID, "channels", "ch1", "messages");
    await setDoc(doc(c, "m1"), { userId: OWNER, text: "ilk", timestamp: 1 });
    await setDoc(doc(c, "b1"), { userId: OWNER, timestamp: 2, items: [{ id: "a", text: "bir", timestamp: 2 }] });
  });
  const d = (uid, id) => doc(fs_(uid), "servers", SID, "channels", "ch1", "messages", id);
  await assertFails(updateDoc(d(MEMBER, "m1"), { text: "değiştirildi" }));
  await assertFails(updateDoc(d(MEMBER, "b1"), { items: [] }));
  await assertFails(updateDoc(d(OWNER, "m1"), { userId: MEMBER }));
  await assertSucceeds(updateDoc(d(MEMBER, "m1"), { reactions: { "👍": [MEMBER] } }));
  await assertSucceeds(updateDoc(d(OWNER, "m1"), { text: "düzeltildi" }));
  await assertSucceeds(updateDoc(d(MOD, "b1"), { items: [] })); // yetkili toplu belgeden mesaj çıkarır
  await assertFails(deleteDoc(d(MEMBER, "m1")));
  await assertSucceeds(deleteDoc(d(MOD, "m1")));
});

// ───────────────────────── Kullanıcılar ─────────────────────────

test("users: toplu döküm yok, e-posta eklenemez, başkası yalnızca oda bilgisini boşaltır", async () => {
  const db = fs_(MEMBER);
  await assertFails(getDocs(collection(db, "users")));
  await assertSucceeds(getDocs(query(collection(db, "users"), where(documentId(), "in", [OWNER, MOD]), limit(30))));
  await assertSucceeds(getDoc(doc(db, "users", OWNER)));
  await assertSucceeds(updateDoc(doc(db, "users", MEMBER), { displayName: "ben" }));
  await assertFails(updateDoc(doc(db, "users", MEMBER), { email: "a@b.c" }));
  await assertFails(updateDoc(doc(db, "users", OWNER), { displayName: "hacked" }));
  await assertFails(updateDoc(doc(db, "users", OWNER), { gameActivity: { name: "sahte" } }));
  await assertSucceeds(updateDoc(doc(db, "users", OWNER), { currentRoom: null, gameActivity: null }));
});

test("users: eski kayıttaki e-posta silinebilir ve silinmeden de diğer alanlar güncellenir", async () => {
  await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), "users", MEMBER), { uid: MEMBER, email: "eski@x.y" }));
  const db = fs_(MEMBER);
  await assertSucceeds(updateDoc(doc(db, "users", MEMBER), { presence: "idle" }));
  await assertFails(updateDoc(doc(db, "users", MEMBER), { email: "yeni@x.y" }));
  await assertSucceeds(updateDoc(doc(db, "users", MEMBER), { email: deleteField() }));
});

// ───────────────────────── Arkadaşlık / DM ─────────────────────────

test("arkadaşlık: isteği yalnızca alan kabul eder; engeli yalnızca engelleyen kaldırır", async () => {
  await assertSucceeds(setDoc(doc(fs_(MEMBER), "friendships", "f1"), { senderId: MEMBER, receiverId: OWNER, status: "pending" }));
  await assertFails(setDoc(doc(fs_(MEMBER), "friendships", "f2"), { senderId: OWNER, receiverId: MEMBER, status: "pending" }));
  await assertFails(setDoc(doc(fs_(MEMBER), "friendships", "f3"), { senderId: MEMBER, receiverId: OWNER, status: "accepted" }));
  await assertFails(updateDoc(doc(fs_(MEMBER), "friendships", "f1"), { status: "accepted" }));
  await assertFails(getDoc(doc(fs_(STRANGER), "friendships", "f1")));
  await assertSucceeds(updateDoc(doc(fs_(OWNER), "friendships", "f1"), { status: "accepted" }));
  await assertSucceeds(updateDoc(doc(fs_(OWNER), "friendships", "f1"), { status: "blocked", blockedBy: OWNER }));
  await assertFails(deleteDoc(doc(fs_(MEMBER), "friendships", "f1")));
  await assertFails(updateDoc(doc(fs_(MEMBER), "friendships", "f1"), { status: "blocked", blockedBy: MEMBER }));
  await assertSucceeds(deleteDoc(doc(fs_(OWNER), "friendships", "f1")));
});

test("DM: yalnızca katılımcılar; gönderen taklit edilemez", async () => {
  const cid = `${MEMBER}_${OWNER}`;
  await assertSucceeds(setDoc(doc(fs_(MEMBER), "dm_conversations", cid), { participantIds: [MEMBER, OWNER] }));
  await assertFails(setDoc(doc(fs_(STRANGER), "dm_conversations", "x"), { participantIds: [MEMBER, OWNER] }));
  const msg = (uid, id) => doc(fs_(uid), "dm_conversations", cid, "messages", id);
  await assertSucceeds(setDoc(msg(MEMBER, "m1"), { senderId: MEMBER, text: "selam" }));
  await assertFails(setDoc(msg(MEMBER, "m2"), { senderId: OWNER, text: "sahte" }));
  await assertFails(setDoc(msg(STRANGER, "m3"), { senderId: STRANGER, text: "dışarıdan" }));
  await assertFails(getDoc(msg(STRANGER, "m1")));
  await assertFails(updateDoc(msg(OWNER, "m1"), { text: "değişti" }));
  await assertSucceeds(updateDoc(msg(OWNER, "m1"), { reactions: { "👍": [OWNER] } }));
  await assertFails(updateDoc(doc(fs_(OWNER), "dm_conversations", cid), { participantIds: [OWNER, STRANGER] }));
  await assertSucceeds(updateDoc(doc(fs_(OWNER), "dm_conversations", cid), { [`unreadCounts.${OWNER}`]: 0 }));
});

// ───────────────────────── LiveKit havuzu / eski koleksiyonlar ─────────────────────────

test("livekitPool: yalnızca sıradaki sunucuya, aralıklı geçiş", async () => {
  const p = (uid) => doc(fs_(uid), "system", "livekitPool");
  await assertSucceeds(setDoc(p(MEMBER), { activeServerIndex: 0, serverCount: 3, lastRotation: serverTimestamp(), createdAt: serverTimestamp() }));
  // az önce oluşturuldu: bekleme süresi dolmadan geçiş yok
  await assertFails(setDoc(p(STRANGER), { activeServerIndex: 1, lastRotation: serverTimestamp() }, { merge: true }));
  await env.withSecurityRulesDisabled((ctx) =>
    updateDoc(doc(ctx.firestore(), "system", "livekitPool"), { lastRotation: Timestamp.fromMillis(Date.now() - 60_000) }));
  await assertFails(setDoc(p(STRANGER), { activeServerIndex: 2, lastRotation: serverTimestamp() }, { merge: true })); // atlama
  await assertFails(setDoc(p(STRANGER), { activeServerIndex: -1, lastRotation: serverTimestamp() }, { merge: true }));
  await assertSucceeds(setDoc(p(STRANGER), { activeServerIndex: 1, lastRotation: serverTimestamp() }, { merge: true }));
  await assertFails(setDoc(doc(fs_(MEMBER), "system", "baska"), { x: 1 }));
});

test("eski/tanımsız koleksiyonlar kapalı", async () => {
  await assertFails(setDoc(doc(fs_(MEMBER), "rooms", "r"), { x: 1 }));
  await assertFails(getDocs(collection(fs_(MEMBER), "text_channels")));
  await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), "servers", SID)));
});

// ───────────────────────── Realtime Database ─────────────────────────

test("room_presence: yalnızca kendi kaydım; kök listelenemez", async () => {
  await assertSucceeds(set(ref(db_(MEMBER), `room_presence/ch1/${MEMBER}`), { userId: MEMBER, username: "m" }));
  await assertFails(set(ref(db_(MEMBER), `room_presence/ch1/${OWNER}`), { userId: OWNER, username: "sahte" }));
  await assertFails(set(ref(db_(MEMBER), `room_presence/ch1/${MEMBER}`), { userId: OWNER }));
  await assertFails(remove(ref(db_(STRANGER), `room_presence/ch1/${MEMBER}`)));
  await assertSucceeds(get(ref(db_(STRANGER), "room_presence/ch1")));
  await assertFails(get(ref(db_(STRANGER), "room_presence")));
  await assertSucceeds(remove(ref(db_(MEMBER), `room_presence/ch1/${MEMBER}`)));
});

test("user_voice_state ve user_presence: yalnızca sahibi yazar", async () => {
  await assertSucceeds(set(ref(db_(MEMBER), `user_voice_state/${MEMBER}`), { roomName: "ch1", timestamp: 1 }));
  await assertFails(get(ref(db_(STRANGER), `user_voice_state/${MEMBER}`)));
  await assertFails(set(ref(db_(STRANGER), `user_voice_state/${MEMBER}`), { roomName: "x" }));
  await assertSucceeds(set(ref(db_(MEMBER), `user_presence/${MEMBER}/lastOnline`), 1));
  await assertFails(set(ref(db_(STRANGER), `user_presence/${MEMBER}/lastOnline`), 1));
  await assertSucceeds(get(ref(db_(STRANGER), `user_presence/${MEMBER}`)));
});
