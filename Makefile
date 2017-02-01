PATH := node_modules/.bin:$(PATH)

default:
	docker build -t quay.io/mojodna/osm-pds-pipelines .

install:
	npm install

.ONESHELL:
input := $(shell mktemp -u)
compute-environment:
	interp < aws/compute-environment.json.hbs > $(input)
	aws batch create-compute-environment --cli-input-json file://$(input)
	rm -f $(input)

.ONESHELL:
input := $(shell mktemp -u)
job-queue:
	interp < aws/job-queue.json.hbs > $(input)
	aws batch create-job-queue --cli-input-json file://$(input)
	rm -f $(input)

.ONESHELL:
input := $(shell mktemp -u)
register-mirror-job-definition:
	interp < aws/mirror-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

.ONESHELL:
input := $(shell mktemp -u)
register-transcode-changesets-job-definition:
	interp < aws/transcode-changesets-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

.ONESHELL:
input := $(shell mktemp -u)
register-transcode-planet-job-definition:
	interp < aws/transcode-planet-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

.ONESHELL:
input := $(shell mktemp -u)
register-transcode-history-job-definition:
	interp < aws/transcode-history-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

register-job-definitions: register-mirror-job-definition \
	register-transcode-changesets-job-definition \
	register-transcode-planet-job-definition \
	register-transcode-history-job-definition

.ONESHELL:
input := $(shell mktemp -u)
submit-job:
	interp < $(job) > $(input)
	aws batch submit-job --cli-input-json file://$(input)
	rm -f $(input)
