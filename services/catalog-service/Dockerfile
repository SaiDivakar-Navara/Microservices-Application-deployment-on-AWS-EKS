FROM golang:1.22 AS builder

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY main.go .

RUN go build -o catalog-service .

FROM debian:bookworm-slim

WORKDIR /app

COPY --from=builder /app/catalog-service .

EXPOSE 8082

CMD ["./catalog-service"]
