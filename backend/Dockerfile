FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    wget ca-certificates fonts-noto-cjk xz-utils \
    && rm -rf /var/lib/apt/lists/*

ARG PANDOC_VERSION=3.6.4
RUN wget -qO pandoc.deb "https://github.com/jgm/pandoc/releases/download/${PANDOC_VERSION}/pandoc-${PANDOC_VERSION}-1-amd64.deb" \
    && dpkg -i pandoc.deb && rm pandoc.deb

ARG TYPST_VERSION=0.13.1
RUN wget -qO- "https://github.com/typst/typst/releases/download/v${TYPST_VERSION}/typst-x86_64-unknown-linux-musl.tar.xz" \
    | tar xJ --strip-components=1 -C /usr/local/bin/

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p /app/data/papers

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
