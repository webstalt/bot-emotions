import sqlite3 from 'sqlite3';

export const db = new sqlite3.Database('mydatabase.db', (err) => {
  if (err) {
    console.error('Ошибка при подключении к базе данных:', err);
    return;
  }
  console.log('Подключение к базе данных установлено.');
});

db.serialize(() => {
  db.run(`
  CREATE TABLE IF NOT EXISTS emotions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      emotions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`,);
  db.run("CREATE TABLE IF NOT EXISTS user_settings (user_id INTEGER PRIMARY KEY, timezone_offset INTEGER, reminder_interval INTEGER);", function(err) {
    if (err) {
      console.error('Ошибка при создании таблицы user_settings:', err);
    } else {
      console.log('Таблица user_settings успешно создана или уже существует.');
    }
  });
});

export const safeStringify = (obj) => {
  const seen = new Set();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return; // Дубликаты не будут сериализованы повторно
      }
      seen.add(value);
    }
    return value;
  });
}

// Функция для добавления выбора эмоций в базу данных
export const addEmotionSelection = (userId, selectedEmotions) => {
  const query = "INSERT INTO emotions (user_id, emotions) VALUES (?, ?)";
  db.run(query, [userId, JSON.stringify(selectedEmotions)], function(err) {
    if (err) {
      console.error('Ошибка при добавлении данных:', err);
    } else {
      console.log(`Запись добавлена с ID: ${this.lastID}`);
    }
  });
}