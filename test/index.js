// @ts-nocheck
"use strict";

const mod = require("../").RGL,
	fs = require("fs-extra");

fs.outputFileSync("test/test1.rglmap", Buffer.from([
	0x00, 0x00, 0x00, 0x52, 0x47, 0x4C, 0x02, 0xFF, 0xFF,
	0x00, 0x00, 0x00, 0x53, 0x01, 0x02, 0x03, 0x00, 0x00, 0x00, 0x54, 0x01, 0x02, 0x03,
	0x03, 0x00, 0x00, 0x00, 0x01, 0x01, 0x02, 0x03, 0x04
]));

mod.RGL.Map.parseFile("test/test1.rglmap").then(console.dir);
