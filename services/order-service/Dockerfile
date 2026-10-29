FROM python:3.12-slim
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY app ./app
RUN useradd -u 10001 app
USER app
EXPOSE 8084
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8084"]
