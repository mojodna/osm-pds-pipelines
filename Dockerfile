FROM openjdk
MAINTAINER Seth Fitzsimmons <seth@mojodna.net>

ENV DEBIAN_FRONTEND noninteractive

RUN \
  curl https://bootstrap.pypa.io/get-pip.py | python \
  && pip install -U awscli && \
  rm -rf /root/.cache

COPY . /app

ENTRYPOINT ["/app/osm-pds.sh"]
