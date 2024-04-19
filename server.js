import express from 'express';
import bodyParser from 'body-parser';
import { TelegramBot } from 'node-telegram-bot-api';

const bot = new TelegramBot(process.env.bot_token);

const app = express();

// Middleware для парсинга JSON
app.use(bodyParser.json());

// Эндпоинт для обработки Webhook запросов от Telegram
app.post('/bot', (req, res) => {
  bot.handleUpdate(req.body, res);
  res.status(200).send('OK');
});

// Запускаем сервер
app.listen(3000, () => {
  console.log('Bot is running on port 3000');
});

// Убедитесь, что вы установили webhook адрес, чтобы он указывал на ваш сервер
// Например: https://your-domain.com/bot
// Это можно сделать программно или через API Telegram
bot.setWebhook('https://emotions-tracker.vercel.app/bot');