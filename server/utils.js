export function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

let _id = 1;
export function nextId(prefix) {
  return `${prefix}_${_id++}`;
}
