CWD=$(shell pwd)
PATH := $(PATH):/usr/local/go/bin/
prefix := $(DESTDIR)/usr
vardir := $(DESTDIR)/var
confdir := $(DESTDIR)/etc
NAME:=carp


all: build

build:
	npm install
	npm dedupe

install: build
	install -d ${prefix}/bin
	install -d ${prefix}/lib
	install -d ${prefix}/lib/carp
	install -m 755 ./bin/carp ${prefix}/bin/carp
	install -m 644 index.js ${prefix}/lib/carp/
	install -m 644 package.json ${prefix}/lib/carp/
	cp -r node_modules ${prefix}/lib/carp/node_modules

.PHONY: build
