/** Directory search text. Matches official floor rooms and facilities. */

export function entrySearchBlob(entry) {
  const parts = [];
  const push = (value) => {
    if (value === 0 || value) parts.push(String(value));
  };
  push(entry.nameZh);
  push(entry.nameKo);
  push(entry.labelZh);
  push(entry.labelKo);
  push(entry.faqId);
  push(entry.entryId);
  push(entry.textZh);
  push(entry.textKo);
  push(entry.summaryZh);
  push(entry.summaryKo);
  push(entry.hoursZh);
  push(entry.hoursKo);
  for (const item of entry.facilitiesZh || []) push(item);
  for (const item of entry.facilitiesKo || []) push(item);
  for (const phone of entry.phones || []) {
    push(phone.number);
    push(phone.labelZh);
    push(phone.labelKo);
  }
  for (const floor of entry.floors || []) {
    push(floor.floor);
    push(floor.labelZh);
    push(floor.labelKo);
    for (const room of floor.roomsAndUsesZh || []) push(room);
    for (const room of floor.roomsAndUsesKo || []) push(room);
  }
  return parts.join("\n").toLowerCase();
}

export function blobMatchesQuery(blob, query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return true;
  if (blob.includes(q)) return true;
  if (q.includes("打印") && (blob.includes("复印") || blob.includes("복사실") || blob.includes("출력"))) return true;
  return false;
}
