FROM php:8.3-cli
RUN apt-get update \
    && apt-get install -y --no-install-recommends libpq-dev \
    && docker-php-ext-install pdo_pgsql \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY index.php .
COPY src ./src
RUN useradd -u 10001 app
USER app
# The built-in server handles one request at a time per worker.
ENV PHP_CLI_SERVER_WORKERS=4
EXPOSE 8087
CMD ["php", "-S", "0.0.0.0:8087", "index.php"]
