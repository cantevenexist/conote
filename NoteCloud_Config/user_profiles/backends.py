from django.core.mail.backends.smtp import EmailBackend as SmtpEmailBackend
from django.core.mail.message import sanitize_address
import smtplib
import json
from django.conf import settings
from .tasks import async_send_messages_with_smtp


class AsyncSmtpEmailBackend(SmtpEmailBackend):
    def serialize_message(self, email_message):
        if not email_message.recipients():
            return False

        encoding = email_message.encoding or settings.DEFAULT_CHARSET
        from_email = sanitize_address(email_message.from_email, encoding)
        recipients = [
            sanitize_address(addr, encoding) for addr in email_message.recipients()
        ]
        msg = email_message.message()
        charset = msg.get_charset().get_output_charset() if msg.get_charset() else "utf-8"

        msg_data = msg.as_bytes(linesep="\r\n").decode(charset)
        serialized_data = {
            "from_email": from_email,
            "recipients": recipients,
            "message": msg_data,
        }

        return json.dumps(serialized_data, ensure_ascii=False)

    def send_messages(self, email_messages):
        msgs = [self.serialize_message(msg) for msg in email_messages]
        async_send_messages_with_smtp.delay(msgs)

        return len(email_messages)

    def _send(self, email_message):
        email_message = json.loads(email_message)
        from_email = email_message['from_email']
        recipients = email_message['recipients']
        message = email_message['message'].encode("utf-8")
        try:
            self.connection.sendmail(
                from_email, recipients, message
            )
        except smtplib.SMTPException:
            if not self.fail_silently:
                raise
            return False

        return True
