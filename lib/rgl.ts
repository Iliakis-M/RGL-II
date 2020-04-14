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
import * as tty from "tty";
import * as event from "events";
import chalk from "chalk";
import { StringDecoder } from "string_decoder";

const debug = util.debuglog("RGL"),
	debug_v = util.debuglog("RGLv"),
	debug_e = util.debuglog("RGLe"),
	voidfn: () => void = () => { };

export module rgl {
	debug("rgl loaded.");
	
	
	const _mappings_c: Map<number, Types.Mapping> = require(path.resolve(__dirname, "..", "..", "RGLMappings_c.js")),
		_mappings_b: Map<number, Types.Mapping> = require(path.resolve(__dirname, "..", "..", "RGLMappings_b.js")),
		_mappings_s: Map<number, Types.Mapping> = require(path.resolve(__dirname, "..", "..", "RGLMappings_s.js"));
	
	
	/**
	 * Container of Errors.
	 */
	export namespace Errors {
		export const ENOBIN = new TypeError("Buffer is not binary.");
		export const ENOBUF = new TypeError("Not a Buffer.");
		export const EBADBUF = new RangeError("Bad data, Wrong size or format.");
		export const EBADTPYE = new TypeError("Bad parameter type.");
		export const ENOTTY = new TypeError("Not a TTY.");
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
			 * Convert Convertable into a writable Buffer.
			 */
			serialize: Buffer;
			/**
			 * Returns a string representation of an object.
			 */
			toString(): string;
		} //Convertable
		
		/**
		 * 'Class' type.
		 */
		export type Class<T> = new (...args: any[]) => T;
		
		/**
		 * I/O binding type.
		 */
		export type IO = {
			input: NodeJS.ReadStream;
			output: NodeJS.WriteStream;
			error?: NodeJS.ReadWriteStream;
			_inpCb?: (data: Buffer) => void;
		};
		
		/**
		 * 'Mapping' type.
		 */
		export type Mapping = (text: string) => string;
	} //Types
	
	
	/**
	 * Responsible for representing Chunks.
	 */
	class RGLTile implements Types.Convertable {
		
		private static readonly trim: RegExp = /\u0000/gim;
		private static _idcntr: number = 0;
		protected static decoder: StringDecoder = new StringDecoder("utf8");
		static mappings_c: Map<number, Types.Mapping>;
		static mappings_b: Map<number, Types.Mapping>;
		static mappings_s: Map<number, Types.Mapping>;
		
		private readonly _id: number = RGLTile._idcntr++;
		protected readonly precalc: string = "";
		protected readonly reserved: number;
		
		
		protected constructor(protected readonly origin: Readonly<Buffer>) {
			assert.ok(origin.length == 8, Errors.EBADBUF);
			
			this.origin = Buffer.from(origin);
			this.precalc = (RGLTile.mappings_s.get(origin[6]) || (t => t))((RGLTile.mappings_b.get(origin[5]) || (t => t))((RGLTile.mappings_c.get(origin[4]) || (t => t))(RGLTile.decoder.write(origin.slice(0, 4)).replace(RGLTile.trim, ''))));
			this.reserved = origin[7];
		} //ctor
		
		
		public get serialize(): Buffer {
			debug(`RGLTile.serialize`);
			
			return Buffer.from(this.origin);
		} //serialize
		
		/**
		 * Parse data into a Convertable.
		 *
		 * @param {Readonly<Buffer>} chunk
		 */
		public static parse(chunk: Readonly<Buffer>): RGLTile {
			debug(`RGLTile.parse`);
			
			return new RGLTile(chunk);
		} //parse
		
		
		public toString(): string {
			return this.precalc;
		} //toString

		public [Symbol.toPrimitive](hint: string) {
			if (hint === "string") return this.toString();
			else return this;
		}
		
	} //RGLTile
	
	/**
	 * Responsible for parsing and stripping Chunks.
	 */
	class RGLMap implements Types.Convertable {
		
		private static readonly MAGIC: Buffer = Buffer.from([0x03, 0x00, 0x00, 0x00, 0x01]);
		private static readonly RGL: Buffer = Buffer.from([0x52, 0x47, 0x4C, 0x02]);
		private static _idcntr: number = 0;
		
		private readonly _id: number = RGLMap._idcntr++;
		
		
		protected constructor(
			protected reserved: Buffer = Buffer.alloc(3, 0),
			protected size: Buffer = Buffer.alloc(2, 0),
			protected tiles: RGLTile[] = [ ],
			protected trailing: Buffer = Buffer.allocUnsafe(0),
			protected _fromFile: string = ""
		) {
			this._fromFile = path.resolve(path.normalize(_fromFile));
		} //ctor
		
		
		public get serialize(): Buffer {
			debug(`RGLMap.serialize`);
			
			let ret: Buffer = Buffer.concat([this.reserved, RGLMap.RGL, this.size]);
			
			for (const tile of this.tiles) ret = Buffer.concat([ret, tile.serialize]);
			
			return Buffer.concat([ret, RGLMap.MAGIC, this.trailing ]);
		} //serialize
		/**
		 * Store Convertable into a writable 'file'.
		 *
		 * @param file - Target file
		 */
		public async serializeFile(file: Readonly<string> = this._fromFile): Promise<Buffer> {
			debug(`RGLMap.serializeFile: ${file}`);
			
			let data: Buffer;
			
			await fs.outputFile(file, data = this.serialize, {
				mode: 0o751,
				encoding: "binary",
				flag: "w"
			});
			
			return data;
		} //serializeFile
		
		/**
		 * Parse data into a Convertable.
		 *
		 * @param {Readonly<Buffer>} chunk
		 */
		public static parse(data: Readonly<Buffer>): RGLMap {
			debug(`RGLMap.parse`);
			
			assert.ok(Buffer.isBuffer(data), Errors.ENOBUF);
			assert.ok(Buffer.isEncoding("binary"), Errors.ENOBIN);
			assert.ok(data.length >= 9, Errors.EBADBUF);
			
			const map: RGLMap = new RGLMap(data.slice(0, 3), data.slice(7, 9));
			
			let idx: number = 9;
			
			while (idx < data.length && !data.slice(idx, idx + 5).equals(RGLMap.MAGIC))
				map.tiles.push(RGLTile.parse(data.slice(idx, idx += 8)));
			
			if (idx != data.length) {
				debug_v(`RGLMap.parse: has trailing`);
				
				map.trailing = data.slice(idx + 5);
			}
			
			return map;
		} //parse
		/**
		 * Read Buffer from 'file'.
		 * 
		 * @param file - Target file
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
							mode: fs.constants.S_IRUSR | fs.constants.S_IXGRP,
							emitClose: true
						})
						.once("readable", async () => {
							debug_v(`RGLMap.parseFile: ${file} -> Readable`);
							
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
		
		
		public toString(): string {
			return this.tiles.map((tile: RGLTile): string => tile.toString()).join('');
		} //toString
		
		public [Symbol.toPrimitive](hint: string) {
			if (hint === "string") return this.toString();
			else return this;
		}
		
	} //RGLMap
	
	/**
	 * Responsible for controlling transitions and settings.
	 * 
	 * TODO: Add controls.
	 */
	export class RGL extends event.EventEmitter {
		
		protected static mappings_s: Map<number, Types.Mapping> = new Map<number, Types.Mapping>(_mappings_s);
		
		protected secureSwitch: boolean = true;  /* Unbind CTRL-C */
		protected binds: Types.IO | null = null;
		
		
		protected constructor(
			autoconfig: boolean = true,
			protected mappings_c: Map<number, Types.Mapping> = _mappings_c,
			protected mappings_b: Map<number, Types.Mapping> = _mappings_b,
			protected readonly _Map: typeof RGLMap = RGLMap,
			protected readonly _Tile: typeof RGLTile = RGLTile
		) {
			super();
			
			if (!RGL.supportsColors) console.warn("Terminal colors are not supported!");
			
			this.mappings_c = new Map<number, Types.Mapping>(mappings_c);
			this.mappings_b = new Map<number, Types.Mapping>(mappings_b);
			
			if (autoconfig) {
				Promise.all([
					this.loadMappings_c(),
					this.loadMappings_b()
				]).catch(() => debug_e("RGL.autoconf: EMAPPING")).then(() => {
					this._Tile.mappings_c = this.mappings_c;
					this._Tile.mappings_b = this.mappings_b;
					
					debug("RGL.ctor deffered mappings.");
				});
				
				this.bind();
			}
			
			this._Tile.mappings_c = this.mappings_c;
			this._Tile.mappings_b = this.mappings_b;
			this._Tile.mappings_s = RGL.mappings_s;
		} //ctor
		
		
		/**
		 * Whether the TTY supports basic colors.
		 */
		public static get supportsColors(): boolean {
			return !!chalk.level;
		} //supportsColors
		
		public async loadMappings_c(path?: Readonly<string>): Promise<Map<number, Types.Mapping>>;
		public loadMappings_c(map?: Readonly<Map<number, Types.Mapping>>): Promise<Map<number, Types.Mapping>>;
		public loadMappings_c(map: Readonly<string | Map<number, Types.Mapping>> = "RGLMappings_c.js"): Promise<Map<number, Types.Mapping>> {
			this.emit("_loadColors", map);
			
			return RGL.loadMappings(map, this.mappings_c);
		} //loadMappings_c
		
		public async loadMappings_b(path?: Readonly<string>): Promise<Map<number, Types.Mapping>>;
		public loadMappings_b(map?: Readonly<Map<number, Types.Mapping>>): Promise<Map<number, Types.Mapping>>;
		public loadMappings_b(map: Readonly<string | Map<number, Types.Mapping>> = "RGLMappings_b.js"): Promise<Map<number, Types.Mapping>> {
			this.emit("_loadBackground", map);
			
			return RGL.loadMappings(map, this.mappings_b);
		} //loadMappings_c
		
		/**
		 * Include custom mappings.
		 * 
		 * @param map - Load new mappings
		 * @param orig - Mappings to override
		 */
		public static async loadMappings(map: Readonly<string | Map<number, Types.Mapping>>, orig: Map<number, Types.Mapping>): Promise<Map<number, Types.Mapping>> {
			debug("RGL.loadMappings:", util.inspect(orig, { breakLength: Infinity }));
			
			if (typeof map === "string") {
				delete require.cache[require.resolve(map)];
				
				const data: Map<number, Types.Mapping> = require(map);
				
				for (let sig of data) orig.set(sig[0], sig[1]);
			} else if (map instanceof Map) {
				for (let sig of map) orig.set(sig[0], sig[1]);
			} else throw Errors.EBADTPYE;
			
			return orig;
		} //loadMappings
		
		/**
		 * Bind the RGL engine to I/O.
		 * 
		 * @param inp - The target user-input stream to bind, must be a TTY
		 * @param out - The target user-input stream to bind, must be a TTY
		 */
		bind(inp: tty.ReadStream = (this.binds ? this.binds.input : process.stdin) || process.stdin, out: tty.WriteStream = (this.binds ? this.binds.output : process.stdout) || process.stdout, err: NodeJS.ReadWriteStream = (this.binds ? this.binds.error : process.stderr) || process.stderr): this {
			debug(`RGL.bind: ${this.binds}`);
			
			assert.ok(inp.isTTY && out.isTTY, Errors.ENOTTY);
			
			if (!!this.binds && !!this.binds!.input) {
				debug(`RGL.bind: unbound`);
				
				this.binds!.input.setRawMode(false);
				if (!!this.binds!._inpCb) this.binds!.input.removeListener("data", this.binds!._inpCb);
			}
			
			this.binds = <Types.IO>{
				input: inp,
				output: out,
				error: err || process.stderr
			};
			
			this.binds!.input.setRawMode(true);
			
			this.binds!.input.on("data", this.binds!._inpCb = data => {
				this.emit("rawkey", data);
				this.emit("key", data.toString());
				
				if (this.secureSwitch && data.toString() === '\u0003') {
					this.emit("_exit");
					process.exit();
				}
			});
			
			return this;
		} //bind
		
		public emit(event: "key", data: string): boolean;
		public emit(event: "rawkey", data: Buffer): boolean;
		public emit(event: "_exit"): boolean;
		public emit(event: "_loadBackground", data: string | Readonly<Map<number, Types.Mapping>>): boolean;
		public emit(event: "_loadColors", data: string | Readonly<Map<number, Types.Mapping>>): boolean;
		public emit(event: string | symbol, ...args: any[]): boolean;
		public emit(event: string | symbol, ...args: any[]): boolean {
			return super.emit(event, ...args);
		} //emit
		
		public on(event: "key", listener: (data: string) => void): this;
		public on(event: "rawkey", listener: (data: Buffer) => void): this;
		public on(event: "_exit", listener: () => void): this;
		public on(event: "_loadBackground", listener: (data: string | Readonly<Map<number, Types.Mapping>>) => void): this;
		public on(event: "_loadColors", listener: (data: string | Readonly<Map<number, Types.Mapping>>) => void): this;
		public on(event: string | symbol, listener: (...args: any[]) => void): this;
		public on(event: string | symbol, listener: (...args: any[]) => void): this {
			return super.on(event, listener);
		} //on
		
		/* Implement whole events, :remove!! */
		
		/**
		 * Start an instance of RGL.
		 * 
		 * @param {any[]} params - Options passed to constructor
		 */
		public static create(...params: ReadonlyArray<any>): RGL {
			debug(`RGL.create`);
			
			return new RGL(...params);
		} //create
		
	} //RGL
	
} //rgl

export default rgl;
