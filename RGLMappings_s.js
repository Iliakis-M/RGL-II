"use strict";

const chalk = require("chalk");

module.exports = new Map([
	[0, text => chalk["reset"](text)],
	[1, text => chalk["bold"](text)],
	[2, text => chalk["dim"](text)],
	[4, text => chalk["italic"](text)],
	[8, text => chalk["underline"](text)],
	[16, text => chalk["inverse"](text)],
	[32, text => chalk["hidden"](text)],
	[64, text => chalk["strikethrough"](text)],
	[128, text => chalk["visible"](text)],
]);
