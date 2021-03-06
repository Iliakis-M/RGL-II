// @ts-nocheck
"use strict";

const mod = require("../").rgl.RGL.create(false),
	fs = require("fs-extra");

fs.outputFileSync("test/test1.rglmap", Buffer.from([
	0x00, 0x00, 0x00, 0x52, 0x47, 0x4C, 0x02, 0xFF, 0xFF,
	0x00, 0x00, 0x00, 0x53, 0x01, 0x02, 0x03, 0x00, 0x00, 0x00, 0xCE, 0xB1, 0x02, 0x03, 0x04, 0x02,
	0x03, 0x00, 0x00, 0x00, 0x01, 0x01, 0x02, 0x03, 0x04
]));

mod._Map.parseFile("test/test1.rglmap").then(map => {
	console.dir(map, { depth: 3, showProxy: true, colors: true, breakLength: 80 });
	console.log(map.toString());
	mod.bind();
	mod.on("key", console.log);
	mod.once("_exit", () => console.info("Exiting..."));

	map.serializeFile();
});
