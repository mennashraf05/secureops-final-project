import os
import time

import pika


def rabbitmq_parameters() -> pika.ConnectionParameters:
    credentials = pika.PlainCredentials(
        os.environ["RABBITMQ_USER"],
        os.environ["RABBITMQ_PASSWORD"],
    )
    return pika.ConnectionParameters(
        host=os.getenv("RABBITMQ_HOST", "rabbitmq"),
        port=int(os.getenv("RABBITMQ_PORT", "5672")),
        credentials=credentials,
        heartbeat=60,
        blocked_connection_timeout=30,
    )


def connect_with_retry(max_attempts: int = 12, delay_seconds: int = 5) -> pika.BlockingConnection:
    for attempt in range(1, max_attempts + 1):
        try:
            return pika.BlockingConnection(rabbitmq_parameters())
        except pika.exceptions.AMQPConnectionError:
            print(f"RabbitMQ not ready, retrying ({attempt}/{max_attempts})...", flush=True)
            time.sleep(delay_seconds)

    raise RuntimeError("Could not connect to RabbitMQ after retries.")


def main() -> None:
    connection = connect_with_retry()
    print("Worker connected to RabbitMQ", flush=True)
    print("Waiting for jobs...", flush=True)

    try:
        while connection.is_open:
            connection.process_data_events(time_limit=1)
            time.sleep(1)
    except KeyboardInterrupt:
        print("Worker shutting down", flush=True)
    finally:
        if connection.is_open:
            connection.close()


if __name__ == "__main__":
    main()
