"use strict";

const chalk = require("chalk");

module.exports = new Map([
	[0, text => chalk["bgBlack"](text)],
	[1, text => chalk["bgRed"](text)],
	[2, text => chalk["bgGreen"](text)],
	[3, text => chalk["bgYellow"](text)],
	[4, text => chalk["bgBlue"](text)],
	[5, text => chalk["bgMagenta"](text)],
	[6, text => chalk["bgCyan"](text)],
	[7, text => chalk["bgWhite"](text)],
	[8, text => chalk["bgBlackBright"](text)],
	[9, text => chalk["bgRedBright"](text)],
	[10, text => chalk["bgGreenBright"](text)],
	[11, text => chalk["bgYellowBright"](text)],
	[12, text => chalk["bgBlueBright"](text)],
	[13, text => chalk["bgMagentaBright"](text)],
	[14, text => chalk["bgCyanBright"](text)],
	[15, text => chalk["bgWhiteBright"](text)],
]);
