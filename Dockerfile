FROM public.ecr.aws/amazoncorretto/amazoncorretto:17-al2023
LABEL maintainer="Seth Fitzsimmons <seth@mojodna.net>"

ENV DEBIAN_FRONTEND noninteractive
ENV PATH /app/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN yum install -y aws-cli bsdtar findutils pv

WORKDIR /app

RUN \
  curl -sfL https://github.com/mojodna/osm2orc/releases/download/v0.5.5/osm2orc-0.5.5.tar.gz | bsdtar zxf - --strip-components=1 && chmod +x bin/osm2orc

COPY . /app

ENTRYPOINT ["/app/osm-pds.sh"]
