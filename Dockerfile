FROM openjdk:8-jre
LABEL maintainer="Seth Fitzsimmons <seth@mojodna.net>"

ENV DEBIAN_FRONTEND noninteractive
ENV PATH /app/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN \
  apt update \
  && apt install -y --no-install-recommends \
    pv \
    python \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* \
  && curl https://bootstrap.pypa.io/get-pip.py | python \
  && pip install -U awscli \
  && rm -rf /root/.cache

WORKDIR /app

RUN \
  curl -sfL https://github.com/mojodna/osm2orc/releases/download/v0.5.4/osm2orc-0.5.4.tar.gz | tar zxf - --strip-components=1

COPY . /app

ENTRYPOINT ["/app/osm-pds.sh"]
