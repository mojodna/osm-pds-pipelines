FROM public.ecr.aws/amazoncorretto/amazoncorretto:17-al2023
LABEL maintainer="Seth Fitzsimmons <seth@mojodna.net>"

ENV DEBIAN_FRONTEND noninteractive
ENV PATH /app/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin

RUN yum install -y aws-cli bsdtar bzip2 findutils pv

WORKDIR /app

RUN \
  curl -sfL https://github.com/mojodna/osm2orc/releases/download/v0.6.1/osm2orc-0.6.1.zip | bsdtar zxf - --strip-components=1 && chmod +x bin/osm2orc

COPY . /app

ENTRYPOINT ["/app/osm-pds.sh"]
