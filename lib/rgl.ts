/**
 * @author V. H.
 * @file rgl.ts
 * @since 2020
 */

"use strict";

import * as util from "util";
import * as fs from "fs-extra";
import * as assert from "assert";
import * as path from "path";
import chalk from "chalk";
import { StringDecoder } from "string_decoder";

const debug = util.debuglog("RGL"),
	debug_v = util.debuglog("RGLv"),
	debug_e = util.debuglog("RGLe"),
	voidfn: () => void = () => { };

export module rgl {
	debug("RGL loaded.");


	const _mappings_c: Map<number, Mapping> = require(path.resolve(__dirname, "..", "..", "RGLMappings_c.js")),
		_mappings_b: Map<number, Mapping> = require(path.resolve(__dirname, "..", "..", "RGLMappings_b.js"));
	

	/**
	 * Container of Errors.
	 */
	export namespace Errors {
		export const ENOBIN = new TypeError("Buffer is not binary.");
		export const ENOBUF = new TypeError("Not a Buffer.");
		export const EBADBUF = new RangeError("Bad data, Wrong size or format.");
		export const EBADTPYE = new TypeError("Bad parameter type.");
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
	type Class<T> = new (...args: any[]) => T;
	/**
	 * 'Mapping' type.
	 */
	export type Mapping = (text: string) => string;


	/**
	 * Responsible for representing Chunks.
	 */
	class RGLTile implements Types.Convertable {

		public static decoder: StringDecoder = new StringDecoder("utf8");
		private static trim: RegExp = /\u0000/gim;

		protected precalc: string = "";


		protected constructor(protected readonly origin: Readonly<Buffer>) {
			assert.ok(origin.length == 8, Errors.EBADBUF);

			this.precalc = RGLTile.decoder.write(origin.slice(0, 4)).replace(RGLTile.trim, '');  // TODO: Colors!
		} //ctor


		public serialize(): Buffer {
			return Buffer.allocUnsafe(0);
		} //serialize

		public static parse(chunk: Readonly<Buffer>): RGLTile {
			return new RGLTile(chunk);
		} //parse

	} //RGLTile

	/**
	 * Responsible for parsing and stripping Chunks.
	 */
	class RGLMap implements Types.Convertable {

		private static readonly MAGIC: Buffer = Buffer.from([0x03, 0x00, 0x00, 0x00, 0x01]);


		protected constructor(
			protected reserved: Buffer = Buffer.alloc(3, 0),
			protected size: Buffer = Buffer.alloc(2, 0),
			protected tiles: RGLTile[] = [],
			protected trailing: Buffer = Buffer.allocUnsafe(0),
			protected _fromFile: string = ""
		) {

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

			const map: RGLMap = new RGLMap(data.slice(0, 3), data.slice(7, 9));

			let idx: number = 9;

			while (idx < data.length && !data.slice(idx, idx + 5).equals(RGLMap.MAGIC))
				map.tiles.push(RGLTile.parse(data.slice(idx, idx += 8)));

			if (idx != data.length) map.trailing = data.slice(idx + 5);

			return map;
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
								const map: RGLMap = RGLMap.parse(Buffer.from(data, "binary"));

								map._fromFile = file;

								res(map);
							});
						});
					}
				});
			});
		} //parseFile

	} //RGLMap

	/**
	 * Responsible for controlling transitions and settings.
	 */
	export class RGL {

		protected constructor(
			autoconfig: boolean = true,
			public mappings_c: Map<number, Mapping> = _mappings_c,
			public mappings_b: Map<number, Mapping> = _mappings_b,
			public _Map: typeof RGLMap = RGLMap,
			public _Tile: typeof RGLTile = RGLTile

		) {
			if (!chalk.supportsColor) console.warn("Terminal colors are not supported!");

			this.mappings_c = new Map<number, Mapping>(mappings_c);

			if (autoconfig) {
				Promise.all([
					this.loadMappings_c(),
					this.loadMappings_b()
				]).catch(() => debug_e("RGL.autoconf: EMAPPING"));
			}
		} //ctor


		public async loadMappings_c(path?: Readonly<string>): Promise<Map<number, Mapping>>;
		public loadMappings_c(map?: Readonly<Map<number, Mapping>>): Promise<Map<number, Mapping>>;
		public loadMappings_c(map: Readonly<string | Map<number, Mapping>> = "RGLMappings_c.js"): Promise<Map<number, Mapping>> {
			return this.loadMappings(map, this.mappings_c);
		} //loadMappings_c

		public async loadMappings_b(path?: Readonly<string>): Promise<Map<number, Mapping>>;
		public loadMappings_b(map?: Readonly<Map<number, Mapping>>): Promise<Map<number, Mapping>>;
		public loadMappings_b(map: Readonly<string | Map<number, Mapping>> = "RGLMappings_b.js"): Promise<Map<number, Mapping>> {
			return this.loadMappings(map, this.mappings_b);
		} //loadMappings_c
		
		/**
		 * Include custom mappings.
		 * 
		 * @param {string | Map.<number, Mapping>} map - Load new mappings
		 * @param {Map.<number, Mapping>} orig - Mappings to override
		 */
		public async loadMappings(map: Readonly<string | Map<number, Mapping>>, orig: Map<number, Mapping>): Promise<Map<number, Mapping>> {
			debug("RGL.loadMappings:", util.inspect(orig, { breakLength: Infinity }));

			if (typeof map === "string") {
				delete require.cache[require.resolve(map)];

				const data: Map<number, Mapping> = require(map);

				for (let sig of data) orig.set(sig[0], sig[1]);
			} else if (map instanceof Map) {
				for (let sig of map) orig.set(sig[0], sig[1]);
			} else throw Errors.EBADTPYE;

			return orig;
		} //loadMappings

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

export default rgl;
