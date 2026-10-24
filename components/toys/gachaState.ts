import { toyCharacters, type ToyCharacterId } from '../../data/toyCharacters';

export const GACHA_KEY = 'moliang:toy-gacha:v1';
export const DAILY_DRAWS = 3;
export type GachaState = {
  version: 1;
  day: string;
  used: number;
  collection: Partial<Record<ToyCharacterId, number>>;
  lastDraw: { characterId: ToyCharacterId; at: string } | null;
};
const ids = new Set<string>(toyCharacters.map(character => character.id));
export function shanghaiDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: string) => parts.find(part => part.type === type)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function readGacha(raw: string | null, now = new Date()): GachaState {
  const day = shanghaiDay(now);
  if (raw === null) return { version: 1, day, used: 0, collection: {}, lastDraw: null };
  const saved = JSON.parse(raw);
  if (saved?.version !== 1 || typeof saved.day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(saved.day) || !Number.isInteger(saved.used) || saved.used < 0 || saved.used > DAILY_DRAWS || !saved.collection || typeof saved.collection !== 'object' || Array.isArray(saved.collection)) throw new Error('收藏记录暂时无法读取，请先保留浏览器中的现有记录。');
  for (const [id, count] of Object.entries(saved.collection)) {
    if (!ids.has(id) || !Number.isSafeInteger(count) || (count as number) < 1) throw new Error('收藏记录暂时无法读取，请先保留浏览器中的现有记录。');
  }
  if (saved.lastDraw !== null && (!saved.lastDraw || !ids.has(saved.lastDraw.characterId) || !Number.isFinite(Date.parse(saved.lastDraw.at)))) throw new Error('收藏记录暂时无法读取，请先保留浏览器中的现有记录。');
  return { ...saved, used: saved.day === day ? saved.used : 0, day };
}
export function nextDraw(state: GachaState, random: number, now = new Date()): GachaState {
  const current = readGacha(JSON.stringify(state), now);
  if (current.used >= DAILY_DRAWS) throw new Error('今天的 3 次机会已用完，上海时间零点再来吧。');
  if (!Number.isFinite(random) || random < 0 || random >= 1) throw new Error('暂时无法抽取，请重试。');
  const characterId = toyCharacters[Math.floor(random * toyCharacters.length)].id;
  return { ...current, used: current.used + 1, collection: { ...current.collection, [characterId]: (current.collection[characterId] || 0) + 1 }, lastDraw: { characterId, at: now.toISOString() } };
}

let localQueue: Promise<unknown> = Promise.resolve();
/** Web Locks serialize the read-modify-write across tabs on the same origin. */
export function saveDraw(): Promise<GachaState> {
  const transaction = () => {
    const current = readGacha(localStorage.getItem(GACHA_KEY));
    const random = crypto.getRandomValues(new Uint32Array(1))[0] / 4294967296;
    const next = nextDraw(current, random);
    localStorage.setItem(GACHA_KEY, JSON.stringify(next));
    if (localStorage.getItem(GACHA_KEY) !== JSON.stringify(next)) throw new Error('收藏未能保存，本次结果未确认，请重试。');
    return next;
  };
  const run = async () => {
    if (navigator.locks) return navigator.locks.request(GACHA_KEY, transaction);
    // A readwrite IDB transaction serializes older browsers too; a localStorage
    // lease alone cannot guarantee mutual exclusion between simultaneous tabs.
    return new Promise<GachaState>((resolve, reject) => {
      let abandoned = false;
      const request = indexedDB.open('moliang-toy-lock', 1);
      request.onupgradeneeded = () => request.result.createObjectStore('mutex');
      request.onerror = () => reject(new Error('收藏无法安全保存，请允许浏览器存储后重试。'));
      request.onblocked = () => { abandoned = true; reject(new Error('另一个页面正在更新收藏，请关闭旧页面后重试。')); };
      request.onsuccess = () => {
        const db = request.result;
        if (abandoned) { db.close(); return; }
        const tx = db.transaction('mutex', 'readwrite');
        let next: GachaState;
        let reason: unknown;
        tx.objectStore('mutex').get('draw').onsuccess = () => {
          try { next = transaction(); tx.objectStore('mutex').put(Date.now(), 'draw'); }
          catch (error) { reason = error; tx.abort(); }
        };
        tx.oncomplete = () => { db.close(); resolve(next); };
        tx.onabort = tx.onerror = () => { db.close(); reject(reason || new Error('收藏未能确认保存，请重新读取收藏。')); };
      };
    });
  };
  const job = localQueue.then(run, run);
  localQueue = job.catch(() => {});
  return job;
}
