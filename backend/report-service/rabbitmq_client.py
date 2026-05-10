import json

import pika

from models import Job
from shared.config import settings


QUEUE_NAME = "report_jobs"


class ReportQueueError(RuntimeError):
    pass


def rabbitmq_parameters() -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(settings.rabbitmq_user, settings.rabbitmq_password)
    return pika.ConnectionParameters(
        host=settings.rabbitmq_host,
        port=settings.rabbitmq_port,
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=30,
    )


def publish_report_job(job: Job) -> None:
    message = {
        "job_id": job.id,
        "type": job.type,
        "requested_by": job.requested_by,
    }

    connection: pika.BlockingConnection | None = None
    try:
        connection = pika.BlockingConnection(rabbitmq_parameters())
        channel = connection.channel()
        channel.queue_declare(queue=QUEUE_NAME, durable=True)
        channel.basic_publish(
            exchange="",
            routing_key=QUEUE_NAME,
            body=json.dumps(message).encode("utf-8"),
            properties=pika.BasicProperties(
                delivery_mode=pika.DeliveryMode.Persistent,
                content_type="application/json",
            ),
        )
    except pika.exceptions.AMQPError as exc:
        raise ReportQueueError("Could not queue report job.") from exc
    finally:
        if connection and connection.is_open:
            connection.close()
