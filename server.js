import express from 'express';
import bodyParser from 'body-parser';
import bot from './bot.js';

const app = express();

app.use(bodyParser.json());

app.post('/bot', (req, res) => {
  console.log('Received a webhook:', req.body);
  bot.handleUpdate(req.body, res);
  res.status(200).send('OK');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Bot is running on port ${port}`);
});
