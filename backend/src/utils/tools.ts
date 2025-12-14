export function generateTempId(length = 8) {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `guest_${result}`;
}

export function generateGameCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}
