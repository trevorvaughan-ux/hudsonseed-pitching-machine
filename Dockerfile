FROM python:3.11-slim

WORKDIR /app

COPY grok_poller.py .
RUN pip install supabase==2.0.0 python-dotenv==1.0.0

CMD ["python", "grok_poller.py"]
