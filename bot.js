import { Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { db, addEmotionSelection, safeStringify } from './database.js';
import { HELLO_TEXT, getCurrentChoicesConfirmText, ASK_FOR_TIMEZONE_TEXT } from './texts.js';
import { formatDate, isValidTimezone } from './utils.js';

import('./emotions.json', { assert: { type: 'json' } })
  .then((module) => {
    emotions = module.default;
  })
  .catch(error => console.error('Ошибка загрузки JSON:', error));


let emotions;
dotenv.config();
  
const bot = new Telegraf(process.env.bot_token);

bot.start((ctx) => {
  userChoices[ctx.from.id] = [];
  ctx.reply(HELLO_TEXT);
  ctx.reply("Выбери команду:", {
    reply_markup: {
      keyboard: [
        [{ text: '/newcheckup' }, { text: '/stats' }],
      ],
      resize_keyboard: true,
      one_time_keyboard: true
    }
  });
});

bot.command('newcheckup', (ctx) => {
  sendCategoryMenu(ctx.from.id);
});

let userChoices = {};

const options = {
  reply_markup: JSON.stringify({
    keyboard: [
      [{ text: '/newcheckup' }, { text: '/stats' }]
    ],
    resize_keyboard: true,  // Делает клавиатуру меньше
    one_time_keyboard: true // Скрывает клавиатуру после использования
  })
};

bot.command('start', (ctx) => {
  const chatId = ctx.from.i
  userChoices[chatId] = []; // Инициализация выбора для пользователя
  bot.telegram.sendMessage(chatId, HELLO_TEXT, options);

  bot.telegram.sendMessage(chatId, "Выбери команду:");
});

function sendCategoryMenu(chatId) {
  const keys = Object.keys(emotions);
  const keyboard = keys.map(key => [{
    text: key,
    callback_data: `category:${key}`
  }]);
  if (userChoices?.[chatId]?.length > 0) {
    keyboard.push([{ text: 'Завершить ✅', callback_data: 'finish' }]);
  }
  bot.telegram.sendMessage(chatId, 'Выбери категорию эмоций:', {
    reply_markup: { inline_keyboard: keyboard }
  });
}

function sendEmotionSelectionMenu(chatId, category) {
  const emotionList = emotions[category];
  const keyboard = emotionList.map(emotion => [{ text: emotion, callback_data: `emotion:${emotion}` }]);
  keyboard.push([{ text: 'Назад к категориям ⏪️', callback_data: 'backToCategories' }]);
  if (userChoices?.[chatId]?.length > 0) {
    keyboard.push([{ text: 'Завершить ✅', callback_data: 'finish' }]);
  }
  bot.telegram.sendMessage(chatId, `Выбери эмоцию из категории ${category}:`, {
    reply_markup: { inline_keyboard: keyboard }
  });
}

function saveEmotions(chatId, emotions) {
  const queryCheck = "SELECT * FROM emotions WHERE user_id = ? AND emotions = ? AND created_at >= datetime('now', '-1 minute')";
  db.get(queryCheck, [chatId, JSON.stringify(emotions)], (err, row) => {
    if (err) {
      console.error('Ошибка при проверке эмоций:', err);
    } else if (row) {
      console.log('Такие эмоции уже сохранены недавно:', emotions);
    } else {
      const queryInsert = "INSERT INTO emotions (user_id, emotions) VALUES (?, ?)";
      db.run(queryInsert, [chatId, JSON.stringify(emotions)], function(err) {
        if (err) {
          console.error('Ошибка при сохранении эмоций:', err);
        } else {
          console.log('Эмоции успешно сохранены для пользователя:', chatId);
        }
      });
    }
  });
}

bot.on('callback_query', (ctx) => {
  const message = ctx.update.callback_query.message;
  const chatId = ctx.from.id;

  userChoices[chatId] = userChoices[chatId] || [];
  const data = ctx.update.callback_query.data;
 
  const [prefix, value] = data.split(':');
  if (prefix === 'category') {
    // Это выбор категории, переходим к выбору эмоций
    sendEmotionSelectionMenu(chatId, value);
  } else if (prefix === 'emotion') {
    // Это выбор эмоции, добавляем или удаляем из списка
    const index = userChoices[chatId].indexOf(value);
    if (index === -1) {
      if (userChoices[chatId].length < 5) {
        userChoices[chatId].push(value);
      }
    } else {
      userChoices[chatId].splice(index, 1); // Удаляем выбранную эмоцию при повторном нажатии
    } 
    // Логирование или отправка данных с использованием safeStringify
    console.log(safeStringify(userChoices[chatId]));
    const currentChoices = userChoices[chatId];
    bot.telegram.sendMessage(chatId, getCurrentChoicesConfirmText(currentChoices));
  } else if (data === 'backToCategories') {
    sendCategoryMenu(chatId);
  } else if (data === 'finish') {
    finish(message);
  }
});

function finish(ctx) {
  const chatId = ctx.from.id;
  if (!userChoices?.[chatId]?.length) {
    bot.telegram.sendMessage(chatId, `Нечего сохранять.
/newcheckup`);
    return;
  };
  addEmotionSelection(chatId, userChoices[chatId]);
  saveEmotions(chatId, userChoices[chatId]);
  bot.telegram.sendMessage(chatId, `Твой выбор сохранен: ${userChoices[chatId].join(', ')}`, options);
  delete userChoices[chatId];

  checkUserSettings(chatId, (err, settingsExist, timezoneOffset, reminderInterval) => {
    if (err) {
      bot.telegram.sendMessage(chatId, "Произошла ошибка, попробуйте еще раз.", options);
      return;
    }
    if (settingsExist) {
      // Если настройки уже известны, запускаем напоминания
      scheduleNextReminder(chatId, timezoneOffset, reminderInterval);
    } else {
      // Если настройки не полные, запрашиваем их
      askForTimezone(chatId);
    }
  });
}

function checkUserSettings(chatId, callback) {
  db.get("SELECT timezone_offset, reminder_interval FROM user_settings WHERE user_id = ?", [chatId], (err, row) => {
    if (err) {
      console.error('Ошибка при проверке настроек пользователя:', err);
      return callback(err);
    }
    if (row && row.timezone_offset !== null && row.reminder_interval !== null) {
      callback(null, true, row.timezone_offset, row.reminder_interval);
    } else {
      callback(null, false);
    }
  });
}


function askForTimezone(chatId) {
  bot.telegram.sendMessage(chatId, ASK_FOR_TIMEZONE_TEXT);
  bot.once("message", (msg) => {
    if (isValidTimezone(msg.text)) {
      const timezoneOffset = parseInt(msg.text);
      askForReminderInterval(chatId, timezoneOffset);
    } else if (msg.text === '-') {
      bot.telegram.sendMessage(chatId, "Хорошо, напоминаний не будет :)", options);
    } else {
      bot.telegram.sendMessage(chatId, "Пожалуйста, введи корректное значение временной зоны, например '+3' или '-5'");
    }
  });
}

function askForReminderInterval(chatId, timezoneOffset) {
  bot.telegram.sendMessage(chatId, "Как часто ты хочешь получать напоминания? Введи интервал в часах (например, '4' для напоминаний каждые 4 часа).");
  bot.once("message", (msg) => {
    const reminderInterval = parseInt(msg.text);
    saveUserSettings(chatId, timezoneOffset, reminderInterval);
    bot.telegram.sendMessage(chatId, "Спасибо! Твои настройки сохранены.", options);
    scheduleNextReminder(chatId, timezoneOffset, reminderInterval);
  });
}

bot.command('complete', (ctx) => {
  finish(ctx);
});

function saveUserSettings(userId, timezoneOffset, reminderInterval) {
  const query = "INSERT INTO user_settings (user_id, timezone_offset, reminder_interval) VALUES (?, ?, ?) ON CONFLICT(user_id) DO UPDATE SET timezone_offset = excluded.timezone_offset, reminder_interval = excluded.reminder_interval";
  db.run(query, [userId, timezoneOffset, reminderInterval], function(err) {
    if (err) {
      console.error('Ошибка при сохранении настроек пользователя:', err);
    } else {
      console.log('Настройки пользователя успешно сохранены:', userId);
    }
  });
}

bot.command('stats', (ctx) => {
  const chatId = ctx.from.id;

  db.all("SELECT * FROM emotions WHERE user_id = ?", [chatId], (err, rows) => {
    if (err) {
      bot.telegram.sendMessage(chatId, "Произошла ошибка при извлечении данных.", options);
      console.error(err);
      return;
    }
    
    if (rows.length === 0) {
      bot.telegram.sendMessage(chatId, "Записи не найдены.", options);
      return;
    }
    let response = "Твои сохраненные чекапы:\n\n";
    rows.forEach((row) => {
      if (!row.emotions) {
        console.error('Невалидные данные в row.emotions: ', row);
        return;
      }
      response += `${formatDate(row.timestamp)}:  ${JSON.parse(row.emotions).join(', ')}\n`;
    });
    bot.telegram.sendMessage(chatId, response, options);
  });
});


bot.on('polling_error', (error) => {
  console.error(error);
});

function scheduleNextReminder(chatId, timezoneOffset, reminderInterval) {
  const now = new Date();
  const userTime = new Date(now.getTime() + timezoneOffset * 3600 * 1000);
  const startHour = 9;
  const endHour = 22;
  const interval = reminderInterval * 3600 * 1000;

  let nextReminder = new Date(userTime);

  // Выставляем первое напоминание на 9 утра, если текущее время ранее
  if (userTime.getHours() < startHour) {
    nextReminder.setHours(startHour, 0, 0, 0);
  } else {
    // Планируем следующее напоминание в зависимости от интервала
    nextReminder.setTime(userTime.getTime() + interval);
    // Если следующее напоминание выходит за пределы рабочего времени, отложим его на утро
    if (nextReminder.getHours() >= endHour || nextReminder.getHours() < startHour) {
      nextReminder.setDate(nextReminder.getDate() + 1);
      nextReminder.setHours(startHour, 0, 0, 0);
    }
  }

  const delay = nextReminder.getTime() - now.getTime();
  setTimeout(() => {
    bot.telegram.sendMessage(chatId, "Что ты сейчас испытываешь?");
    scheduleNextReminder(chatId, timezoneOffset, reminderInterval);
  }, delay);
}

// Запускаем бота
bot.launch().then(() => {
  console.log("Бот успешно запущен");
}).catch((error) => {
  console.error("Ошибка при запуске бота:", error);
});

export default bot;  // Экспорт экземпляра бота для использования в других файлах