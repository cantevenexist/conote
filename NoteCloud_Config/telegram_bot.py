import asyncio
import sqlite3
from aiogram import Bot, Dispatcher, Router, F
from aiogram.types import Message, InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.filters import Command
from aiogram.utils.markdown import hlink
import logging
from aiogram.exceptions import TelegramBadRequest, TelegramForbiddenError, TelegramRetryAfter, TelegramUnauthorizedError
import os


API_TOKEN = os.environ.get("TELEGRAM_SECRET")
DATABASE = "subscribers.db"

bot = Bot(token=API_TOKEN)
dp = Dispatcher()
router = Router()
dp.include_router(router)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)
file_handler = logging.FileHandler("telegram_bot.log")
file_handler.setLevel(logging.DEBUG)
formatter = logging.Formatter("%(asctime)s - %(name)s - %(levelname)s - %(message)s")
file_handler.setFormatter(formatter)
logger.addHandler(file_handler)


def init_db():
    """Создаёт таблицу подписчиков, если её ещё нет."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
            CREATE TABLE IF NOT EXISTS subscribers (
                user_id INTEGER PRIMARY KEY,
                username TEXT,
                subscribed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
    cursor.execute('''
            CREATE UNIQUE INDEX IF NOT EXISTS idx_user_id ON subscribers(user_id)
        ''')
    conn.commit()
    conn.close()


def add_subscriber(user_id: int, username: str):
    """Добавляет пользователя в базу данных, если он ещё не подписан."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('''
        INSERT OR IGNORE INTO subscribers (user_id, username) VALUES (?, ?)
    ''', (user_id, username))
    conn.commit()
    conn.close()


def get_all_user_ids():
    """
    Получение списка, состоящего из user_id всех пользователей
    """
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute("SELECT user_id FROM subscribers")
    results = cursor.fetchall()
    conn.close()

    user_ids = [int(row[0]) for row in results]
    return user_ids


def is_subscribed(user_id: int) -> bool:
    """Проверяет, подписан ли пользователь (есть ли он в базе)."""
    conn = sqlite3.connect(DATABASE)
    cursor = conn.cursor()
    cursor.execute('SELECT 1 FROM subscribers WHERE user_id = ?', (user_id,))
    result = cursor.fetchone()
    conn.close()
    return result is not None


@router.message(Command("start"))
async def start_handler(message: Message):
    """Обработчик команды /start: добавляет пользователя в подписчики."""
    user_id = message.from_user.id
    username = message.from_user.username or "Неизвестный"
    add_subscriber(user_id, username)

    url = "http://127.0.0.1:8000/account/settings/3rdparty/signup/"
    linked_site_text = hlink("сайте", url)
    website_button = InlineKeyboardButton(text="Перейте на сайт CoNote", url=url)
    keyboard = InlineKeyboardMarkup(inline_keyboard=[[website_button]])
    text = f"Спасибо за подписку! Теперь вы можете зарегистрироваться на {linked_site_text} ✅"
    await message.answer(
        text,
        parse_mode="HTML",
        reply_markup=keyboard
    )


async def send_message_to_users_handler(
    user_id: int, text: str, disable_notification: bool = False
) -> bool:
    """
    Безопасная отправка сообщений
    :param user_id:
    :param text:
    :param disable_notification:
    :return:
    """
    try:
        await bot.send_message(
            user_id,
            text,
            disable_notification=disable_notification
        )
    except TelegramForbiddenError:
        logger.error(f"Target [ID:{user_id}]: blocked by user or user deactivated")
    except TelegramBadRequest:
        logger.error(f"Target [ID:{user_id}]: invalid user ID")
    except TelegramRetryAfter as e:
        logger.error(
            f"Target [ID:{user_id}]: Flood limit is exceeded. "
            f"Sleep {e.retry_after} seconds."
        )
        await asyncio.sleep(e.retry_after)
        return await bot.send_message(user_id, text)  # Recursive call
    except TelegramUnauthorizedError:
        logger.error(f"Bot token is invalid or unauthorized")
    except Exception as e:
        logger.exception(f"Target [ID:{user_id}]: failed due to {type(e).__name__}")
    else:
        logger.info(f"Target [ID:{user_id}]: success")
        return True
    return False


async def send_message_to_users(text, users_list) -> int:
    """
    Отправка сообщения все пользователям
    :return: количество отправленных сообщений
    """
    count = 0
    try:
        for user_id in users_list:
            if await send_message_to_users_handler(user_id, text):
                count += 1
            # 20 сообщений в секунду (Ограничение: 30 сообщений в секунду)
            await asyncio.sleep(.05)
    finally:
        logging.info(f"{count} messages successful sent.")

    return count


async def main():
    init_db()
    await dp.start_polling(bot)


if __name__ == "__main__":
    asyncio.run(main())
