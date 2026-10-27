FROM ruby:3.4-bookworm

WORKDIR /app

COPY Gemfile Gemfile.lock ./

RUN bundle install

COPY app.rb .

EXPOSE 8086

CMD ["ruby", "app.rb"]
