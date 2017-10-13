PATH := node_modules/.bin:$(PATH)

.NOTPARALLEL:
.ONESHELL:

input := $(shell mktemp -u)

default:
	docker build -t quay.io/mojodna/osm-pds-pipelines .

deploy: project.json node_modules/.bin/interp
	for f in functions/* ; do \
		interp < $$f/function.json.hbs > $$f/function.json; \
	done
	apex deploy

install: project.json

project.json: project.json.hbs node_modules/.bin/interp
	interp < $< > $@

node_modules/.bin/interp:
	npm install

compute-environment: node_modules/.bin/interp
	interp < aws/compute-environment.json.hbs > $(input)
	aws batch create-compute-environment --cli-input-json file://$(input)
	rm -f $(input)

job-queue: node_modules/.bin/interp
	interp < aws/job-queue.json.hbs > $(input)
	aws batch create-job-queue --cli-input-json file://$(input)
	rm -f $(input)

register-mirror-job-definition: node_modules/.bin/interp
	interp < aws/mirror-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

register-transcode-changesets-job-definition: node_modules/.bin/interp
	interp < aws/transcode-changesets-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

register-transcode-planet-job-definition: node_modules/.bin/interp
	interp < aws/transcode-planet-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

register-transcode-history-job-definition: node_modules/.bin/interp
	interp < aws/transcode-history-job-definition.json.hbs > $(input)
	aws batch register-job-definition --cli-input-json file://$(input)
	rm -f $(input)

register-job-definitions: register-mirror-job-definition \
	register-transcode-changesets-job-definition \
	register-transcode-planet-job-definition \
	register-transcode-history-job-definition

submit-job: node_modules/.bin/interp
	interp < $(job) > $(input)
	aws batch submit-job --cli-input-json file://$(input)
	rm -f $(input)
