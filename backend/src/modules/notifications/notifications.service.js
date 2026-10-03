import { randomUUID } from "node:crypto";
import { all, run } from "../../db/client.js";

export async function createNotification({
  userId = null,
  email = null,
  type,
  title,
  message,
  metadata = null,
}) {
  await run(
    `INSERT INTO Notification (id, userId, email, type, title, message, metadata) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      randomUUID(),
      userId,
      email,
      type,
      title,
      message,
      metadata ? JSON.stringify(metadata) : null,
    ],
  );
}

export async function listNotifications(userId) {
  return all(
    `SELECT * FROM Notification WHERE userId = ? ORDER BY createdAt DESC LIMIT 50`,
    [userId],
  );
}

export async function markNotificationRead(id, userId) {
  await run(
    `UPDATE Notification SET readAt = CURRENT_TIMESTAMP WHERE id = ? AND userId = ?`,
    [id, userId],
  );
}
