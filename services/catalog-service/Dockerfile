FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY *.go ./
RUN CGO_ENABLED=0 go build -o /out/catalog-service .

FROM alpine:3.20
RUN adduser -D -u 10001 app
USER app
COPY --from=build /out/catalog-service /usr/local/bin/catalog-service
EXPOSE 8082
CMD ["catalog-service"]
