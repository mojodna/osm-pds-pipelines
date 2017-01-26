FROM openjdk
MAINTAINER Seth Fitzsimmons <seth@mojodna.net>

ENV DEBIAN_FRONTEND noninteractive
ENV PATH /app/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN \
  curl https://bootstrap.pypa.io/get-pip.py | python \
  && pip install -U awscli && \
  rm -rf /root/.cache

COPY . /app

ENTRYPOINT ["/app/osm-pds.sh"]
