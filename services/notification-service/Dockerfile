FROM ruby:3.4-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends build-essential libpq-dev \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV RACK_ENV=production
COPY Gemfile Gemfile.lock ./
RUN bundle install
COPY app.rb .
RUN useradd -u 10001 app
USER app
EXPOSE 8086
CMD ["ruby", "app.rb"]
