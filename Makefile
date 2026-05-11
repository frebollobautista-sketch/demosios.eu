.PHONY: pack-canteras pack-province mockup-songkick mockup-bloque lod-ladder catalog-export

pack-canteras:
	python3 -m packages.pack.batch --zone canteras

pack-province:
	python3 -m packages.pack.batch --zone province

mockup-songkick:
	python3 -m packages.mockups.songkick 3501602052 24

mockup-bloque:
	python3 -m packages.mockups.bloque_compare 3501602052 24

lod-ladder:
	python3 -m packages.mockups.lod_ladder 3501602052 24

catalog-export:
	@echo "Catálogo en public/catalog/archetypes.json — editar el JSON directamente"
