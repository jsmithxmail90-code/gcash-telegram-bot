require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');
const sqlite3 = require('sqlite3').verbose();

// Load your bot token from .env file
const token = process.env.TELEGRAM_BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Your user ID (only you can use the bot)
const AUTHORIZED_USER = parseInt(process.env.YOUR_USER_ID);

// Database setup
const db = new sqlite3.Database('./bot.db');

// Create table if it doesn't exist
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      amount REAL,
      phone TEXT,
      status TEXT,
      timestamp TEXT
    )
  `);
});

// Validate if user is authorized
function isAuthorized(userId) {
  return userId === AUTHORIZED_USER;
}

// Log transaction to database
function logTransaction(userId, amount, phone, status) {
  const timestamp = new Date().toISOString();
  db.run(
    `INSERT INTO transactions (user_id, amount, phone, status, timestamp)
     VALUES (?, ?, ?, ?, ?)`,
    [userId, amount, phone, status, timestamp],
    (err) => {
      if (err) console.error('DB Error:', err);
    }
  );
}

// START COMMAND
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAuthorized(userId)) {
    return bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
  }

  bot.sendMessage(chatId,
    `👋 Welcome to GCash Bot!\n\n` +
    `Available Commands:\n` +
    `/send <amount> <phone> - Send money to GCash\n` +
    `/balance - Check your GCash balance\n` +
    `/history - View transaction history\n` +
    `/help - Show this message\n\n` +
    `Example:\n` +
    `/send 500 09123456789`
  );
});

// HELP COMMAND
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAuthorized(userId)) {
    return bot.sendMessage(chatId, '❌ Not authorized.');
  }

  bot.sendMessage(chatId,
    `📚 How to use:\n\n` +
    `1️⃣ Send Money:\n` +
    `   /send 500 09123456789\n` +
    `   Format: /send <amount> <phone>\n\n` +
    `2️⃣ Check Balance:\n` +
    `   /balance\n\n` +
    `3️⃣ View History:\n` +
    `   /history\n\n` +
    `⚠️ Only authorized users can access this bot.`
  );
});

// SEND COMMAND - Send money
bot.onText(/\/send (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  // Check if authorized
  if (!isAuthorized(userId)) {
    return bot.sendMessage(chatId, '❌ You are not authorized to use this bot.');
  }

  try {
    // Parse the command: /send 500 09123456789
    const args = match[1].trim().split(' ');
    const amount = parseFloat(args[0]);
    const phoneNumber = args[1];

    // Validate input
    if (!amount || !phoneNumber || amount <= 0) {
      return bot.sendMessage(chatId,
        `❌ Invalid format!\n\n` +
        `Correct format:\n` +
        `/send <amount> <phone>\n\n` +
        `Example:\n` +
        `/send 500 09123456789`
      );
    }

    // Check if phone number is valid (9-11 digits)
    if (!/^\d{10,11}$/.test(phoneNumber)) {
      return bot.sendMessage(chatId,
        `❌ Invalid phone number!\n` +
        `Must be 10-11 digits (e.g., 09123456789)`
      );
    }

    // Simulate payment processing
    bot.sendMessage(chatId, `⏳ Processing payment...\n\nAmount: ₱${amount}\nTo: ${phoneNumber}`);

    // Log transaction
    logTransaction(userId, amount, phoneNumber, 'PENDING');

    // Simulate API response (replace this with real GCash API later)
    setTimeout(() => {
      const success = Math.random() > 0.2; // 80% success rate for demo

      if (success) {
        const txnId = 'TXN' + Date.now();
        logTransaction(userId, amount, phoneNumber, 'SUCCESS');

        bot.sendMessage(chatId,
          `✅ Payment Successful!\n\n` +
          `Amount: ₱${amount}\n` +
          `Recipient: ${phoneNumber}\n` +
          `Transaction ID: ${txnId}\n` +
          `Status: Completed`
        );
      } else {
        logTransaction(userId, amount, phoneNumber, 'FAILED');
        bot.sendMessage(chatId,
          `❌ Payment Failed!\n\n` +
          `Amount: ₱${amount}\n` +
          `Reason: Insufficient balance or network error\n\n` +
          `Please try again later.`
        );
      }
    }, 2000);

  } catch (error) {
    console.error('Error:', error);
    bot.sendMessage(chatId, '❌ An error occurred. Please try again.');
    logTransaction(userId, 0, '', 'ERROR');
  }
});

// BALANCE COMMAND
bot.onText(/\/balance/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAuthorized(userId)) {
    return bot.sendMessage(chatId, '❌ Not authorized.');
  }

  // Simulate balance (replace with real GCash API call later)
  bot.sendMessage(chatId,
    `💰 GCash Balance\n\n` +
    `Balance: ₱5,000.00\n` +
    `Last Updated: Just now\n\n` +
    `⚠️ This is a demo. Connect to real GCash API to see actual balance.`
  );
});

// HISTORY COMMAND
bot.onText(/\/history/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!isAuthorized(userId)) {
    return bot.sendMessage(chatId, '❌ Not authorized.');
  }

  db.all(
    `SELECT * FROM transactions WHERE user_id = ? ORDER BY timestamp DESC LIMIT 5`,
    [userId],
    (err, rows) => {
      if (err) {
        return bot.sendMessage(chatId, '❌ Could not fetch history.');
      }

      if (rows.length === 0) {
        return bot.sendMessage(chatId, '📭 No transactions yet.');
      }

      let message = `📋 Last 5 Transactions:\n\n`;
      rows.forEach((row, index) => {
        const date = new Date(row.timestamp).toLocaleString();
        message += `${index + 1}. ₱${row.amount} → ${row.phone}\n   Status: ${row.status}\n   ${date}\n\n`;
      });

      bot.sendMessage(chatId, message);
    }
  );
});

// Handle any errors
bot.on('polling_error', (error) => {
  console.log('Polling error:', error.code);
});

console.log('🤖 Bot is running...');
