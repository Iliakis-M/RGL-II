/**
 * @author V. H.
 * @file rgl.ts
 * @since 2020
 */

"use strict";

import * as util from "util";
import * as fs from "fs-extra";
import * as assert from "assert";
import { StringDecoder } from "string_decoder";

const debug = util.debuglog("RGL"),
	debug_v = util.debuglog("RGLv"),
	debug_e = util.debuglog("RGLe"),
	decoder = new StringDecoder("utf8");  // Variable type??

export module RGL {
	debug("RGL loaded.");
	

	/**
	 * Container of Errors.
	 */
	export namespace Errors {
		export const ENOBIN = new TypeError("Buffer is not binary.");
		export const ENOBUF = new TypeError("Not a Buffer.");
		export const EBADBUF = new RangeError("Bad data, Wrong size or format.");
	} //Errors

	/**
	 * Container of ADT contracts.
	 */
	export namespace Types {

		/**
		 * Anything that can be serialized and parsed.
		 */
		export interface Convertable {
			/**
			 * Convert 'T' to writable Buffer.
			 */
			serialize(): Buffer;
			/**
			 * Convert Buffer to 'T'.
			 * 
			 * @param {!Buffer} data - Strictly a binary buffer
			 */
			parse?(data: Readonly<Buffer>): Convertable;
		} //Convertable

	} //Types


	/**
	 * 'Class' type.
	 */
	type Class<T> = new(...args: any[]) => T;


	/**
	 * Responsible for representing Chunks.
	 */
	class RGLTile implements Types.Convertable {

		protected constructor() {

		} //ctor


		public serialize(): Buffer {
			return Buffer.allocUnsafe(0);
		} //serialize

		public static parse(chunk: Readonly<Buffer>): RGLTile {
			return new RGLTile;
		} //parse

	} //Tile

	/**
	 * Responsible for parsing and stripping Chunks.
	 */
	class RGLMap implements Types.Convertable {

		protected constructor(protected _fromFile: Readonly<string> = "") {

		} //ctor


		public serialize(): Buffer {
			return Buffer.allocUnsafe(0);
		} //serialize
		/**
		 * Store 'T' to writable 'file'.
		 *
		 * @param {string} file - Target file
		 */
		public serializeFile(file: Readonly<string> = this._fromFile): Buffer {
			return Buffer.allocUnsafe(0);
		} //serializeFile
		
		public static parse(data: Readonly<Buffer>): RGLMap {
			debug(`RGLMap.parse`);

			assert.ok(Buffer.isBuffer(data), Errors.ENOBUF);
			assert.ok(Buffer.isEncoding("binary"), Errors.ENOBIN);
			assert.ok(data.length >= 9, Errors.EBADBUF);

			return new RGL.Map;
		} //parse
		/**
		 * Read Buffer from 'file'.
		 * 
		 * @param {string} file - Target file
		 */
		public static async parseFile(file: Readonly<string>): Promise<RGLMap> {
			debug(`RGLMap.parseFile: ${file}`);

			return new Promise(async (res, rej) => {
				debug_v(`RGLMap.parseFile: ACCESS`);

				fs.access(file, fs.constants.F_OK | fs.constants.R_OK, err => {
					if (err) {
						debug_e(`RGLMap.parseFile: ${file} -> EACCESS`);

						rej(err);
					} else {
						debug_v(`RGLMap.parseFile: RSTREAM`);

						const str: fs.ReadStream = fs.createReadStream(file, {
							flags: "r",
							encoding: "binary",
							mode: fs.constants.S_IRUSR | fs.constants.S_IRGRP | fs.constants.S_IXUSR,
							emitClose: true
						})
						.once("readable", async () => {
							debug_v(`RGLMap.parseFile: ${file} -> Readable.`);

							let data: string = '';

							str.setEncoding("binary");

							for await (let chunk of str) data += chunk;
							
							str.once("close", () => {
								const map: RGLMap = RGL.Map.parse(Buffer.from(data, "binary"));

								map._fromFile = file;

								res(map);
							});
						});
					}
				});
			});
		} //parseFile

	} //Map

	/**
	 * Responsible for controlling transitions and settings.
	 */
	export class RGL {

		public static readonly Tile: typeof RGLTile = RGLTile;
		public static readonly Map: typeof RGLMap = RGLMap;


		protected constructor(...params: any[]) {

		} //ctor


		/**
		 * Start an instance of RGL.
		 * 
		 * @param {any[]} params - Options passed to constructor
		 */
		public static create(...params: ReadonlyArray<any>): RGL {
			return new RGL(...params);
		} //create

	} //RGL

} //RGL

export default RGL;
