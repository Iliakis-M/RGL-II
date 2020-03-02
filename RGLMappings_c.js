"use strict";

const chalk = require("chalk");

module.exports = new Map([
	[0, text => chalk["black"](text)],
	[1, text => chalk["red"](text)],
	[2, text => chalk["green"](text)],
	[3, text => chalk["yellow"](text)],
	[4, text => chalk["blue"](text)],
	[5, text => chalk["magenta"](text)],
	[6, text => chalk["cyan"](text)],
	[7, text => chalk["white"](text)],
	[8, text => chalk["blackBright"](text)],
	[9, text => chalk["redBright"](text)],
	[10, text => chalk["greenBright"](text)],
	[11, text => chalk["yellowBright"](text)],
	[12, text => chalk["blueBright"](text)],
	[13, text => chalk["magentaBright"](text)],
	[14, text => chalk["cyanBright"](text)],
	[15, text => chalk["whiteBright"](text)],
]);
