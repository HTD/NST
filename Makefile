VERSION=$(shell grep em:version install.rdf | sed -e 's/.*>\(.*\)<.*/\1/')

dist:
	@rm -rf mkdir ./build
	@rm -f NST-$(VERSION).ko.xpi
	@mkdir -p ./build/xpi
	@cp -r ./content ./build/xpi/
	@cp -r ./skin ./build/xpi/
	@cp -r ./xtk2 ./build/xpi/
	@cp chrome.manifest ./build/xpi/
	@cp install.rdf ./build/xpi/
	cd ./build/xpi/ && \
	zip -X -r NST-$(VERSION).ko.xpi *
	@mv ./build/xpi/NST-$(VERSION).ko.xpi .
	@rm -rf ./build
	@echo ""
	@echo "created:"
	@ls -la NST-$(VERSION).ko.xpi

clean:
	rm -f *.xpi

mrproper:
	git clean -xfd

version:
	newversion=$$(dialog --stdout --inputbox "New Version:" 0 0 "$(VERSION)") ; \
	if [ -n "$$newversion" ] && [ "$$newversion" != "$(VERSION)" ]; then \
		sed -ri "s/$(VERSION)/$$newversion/" content/NST.js install.rdf; \
	fi ;