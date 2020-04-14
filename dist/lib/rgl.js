/**
 * @author V. H.
 * @file rgl.ts
 * @since 2020
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const util = tslib_1.__importStar(require("util"));
const fs = tslib_1.__importStar(require("fs-extra"));
const assert = tslib_1.__importStar(require("assert"));
const path = tslib_1.__importStar(require("path"));
const event = tslib_1.__importStar(require("events"));
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const string_decoder_1 = require("string_decoder");
const debug = util.debuglog("RGL"), debug_v = util.debuglog("RGLv"), debug_e = util.debuglog("RGLe"), voidfn = () => { };
var rgl;
(function (rgl) {
    debug("rgl loaded.");
    const _mappings_c = require(path.resolve(__dirname, "..", "..", "RGLMappings_c.js")), _mappings_b = require(path.resolve(__dirname, "..", "..", "RGLMappings_b.js")), _mappings_s = require(path.resolve(__dirname, "..", "..", "RGLMappings_s.js"));
    /**
     * Container of Errors.
     */
    let Errors;
    (function (Errors) {
        Errors.ENOBIN = new TypeError("Buffer is not binary.");
        Errors.ENOBUF = new TypeError("Not a Buffer.");
        Errors.EBADBUF = new RangeError("Bad data, Wrong size or format.");
        Errors.EBADTPYE = new TypeError("Bad parameter type.");
        Errors.ENOTTY = new TypeError("Not a TTY.");
    })(Errors = rgl.Errors || (rgl.Errors = {})); //Errors
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile {
        constructor(origin) {
            this.origin = origin;
            this._id = RGLTile._idcntr++;
            this.precalc = "";
            assert.ok(origin.length == 8, Errors.EBADBUF);
            this.origin = Buffer.from(origin);
            this.precalc = (RGLTile.mappings_s.get(origin[6]) || (t => t))((RGLTile.mappings_b.get(origin[5]) || (t => t))((RGLTile.mappings_c.get(origin[4]) || (t => t))(RGLTile.decoder.write(origin.slice(0, 4)).replace(RGLTile.trim, ''))));
            this.reserved = origin[7];
        } //ctor
        get serialize() {
            debug(`RGLTile.serialize`);
            return Buffer.from(this.origin);
        } //serialize
        /**
         * Parse data into a Convertable.
         *
         * @param {Readonly<Buffer>} chunk
         */
        static parse(chunk) {
            debug(`RGLTile.parse`);
            return new RGLTile(chunk);
        } //parse
        toString() {
            return this.precalc;
        } //toString
        [Symbol.toPrimitive](hint) {
            if (hint === "string")
                return this.toString();
            else
                return this;
        }
    } //RGLTile
    RGLTile.trim = /\u0000/gim;
    RGLTile._idcntr = 0;
    RGLTile.decoder = new string_decoder_1.StringDecoder("utf8");
    /**
     * Responsible for parsing and stripping Chunks.
     */
    class RGLMap {
        constructor(reserved = Buffer.alloc(3, 0), size = Buffer.alloc(2, 0), tiles = [], trailing = Buffer.allocUnsafe(0), _fromFile = "") {
            this.reserved = reserved;
            this.size = size;
            this.tiles = tiles;
            this.trailing = trailing;
            this._fromFile = _fromFile;
            this._id = RGLMap._idcntr++;
            this._fromFile = path.resolve(path.normalize(_fromFile));
        } //ctor
        get serialize() {
            debug(`RGLMap.serialize`);
            let ret = Buffer.concat([this.reserved, RGLMap.RGL, this.size]);
            for (const tile of this.tiles)
                ret = Buffer.concat([ret, tile.serialize]);
            return Buffer.concat([ret, RGLMap.MAGIC, this.trailing]);
        } //serialize
        /**
         * Store Convertable into a writable 'file'.
         *
         * @param file - Target file
         */
        async serializeFile(file = this._fromFile) {
            debug(`RGLMap.serializeFile: ${file}`);
            let data;
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
        static parse(data) {
            debug(`RGLMap.parse`);
            assert.ok(Buffer.isBuffer(data), Errors.ENOBUF);
            assert.ok(Buffer.isEncoding("binary"), Errors.ENOBIN);
            assert.ok(data.length >= 9, Errors.EBADBUF);
            const map = new RGLMap(data.slice(0, 3), data.slice(7, 9));
            let idx = 9;
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
        static async parseFile(file) {
            debug(`RGLMap.parseFile: ${file}`);
            return new Promise(async (res, rej) => {
                debug_v(`RGLMap.parseFile: ACCESS`);
                fs.access(file, fs.constants.F_OK | fs.constants.R_OK, err => {
                    if (err) {
                        debug_e(`RGLMap.parseFile: ${file} -> EACCESS`);
                        rej(err);
                    }
                    else {
                        debug_v(`RGLMap.parseFile: RSTREAM`);
                        const str = fs.createReadStream(file, {
                            flags: "r",
                            encoding: "binary",
                            mode: fs.constants.S_IRUSR | fs.constants.S_IXGRP,
                            emitClose: true
                        })
                            .once("readable", async () => {
                            debug_v(`RGLMap.parseFile: ${file} -> Readable`);
                            let data = '';
                            str.setEncoding("binary");
                            for await (let chunk of str)
                                data += chunk;
                            str.once("close", () => {
                                const map = RGLMap.parse(Buffer.from(data, "binary"));
                                map._fromFile = file;
                                res(map);
                            });
                        });
                    }
                });
            });
        } //parseFile
        toString() {
            return this.tiles.map((tile) => tile.toString()).join('');
        } //toString
        [Symbol.toPrimitive](hint) {
            if (hint === "string")
                return this.toString();
            else
                return this;
        }
    } //RGLMap
    RGLMap.MAGIC = Buffer.from([0x03, 0x00, 0x00, 0x00, 0x01]);
    RGLMap.RGL = Buffer.from([0x52, 0x47, 0x4C, 0x02]);
    RGLMap._idcntr = 0;
    /**
     * Responsible for controlling transitions and settings.
     *
     * TODO: Add controls.
     */
    class RGL extends event.EventEmitter {
        constructor(autoconfig = true, mappings_c = _mappings_c, mappings_b = _mappings_b, _Map = RGLMap, _Tile = RGLTile) {
            super();
            this.mappings_c = mappings_c;
            this.mappings_b = mappings_b;
            this._Map = _Map;
            this._Tile = _Tile;
            this.secureSwitch = true; /* Unbind CTRL-C */
            this.binds = null;
            if (!RGL.supportsColors)
                console.warn("Terminal colors are not supported!");
            this.mappings_c = new Map(mappings_c);
            this.mappings_b = new Map(mappings_b);
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
        static get supportsColors() {
            return !!chalk_1.default.level;
        } //supportsColors
        loadMappings_c(map = "RGLMappings_c.js") {
            this.emit("_loadColors", map);
            return RGL.loadMappings(map, this.mappings_c);
        } //loadMappings_c
        loadMappings_b(map = "RGLMappings_b.js") {
            this.emit("_loadBackground", map);
            return RGL.loadMappings(map, this.mappings_b);
        } //loadMappings_c
        /**
         * Include custom mappings.
         *
         * @param map - Load new mappings
         * @param orig - Mappings to override
         */
        static async loadMappings(map, orig) {
            debug("RGL.loadMappings:", util.inspect(orig, { breakLength: Infinity }));
            if (typeof map === "string") {
                delete require.cache[require.resolve(map)];
                const data = require(map);
                for (let sig of data)
                    orig.set(sig[0], sig[1]);
            }
            else if (map instanceof Map) {
                for (let sig of map)
                    orig.set(sig[0], sig[1]);
            }
            else
                throw Errors.EBADTPYE;
            return orig;
        } //loadMappings
        /**
         * Bind the RGL engine to I/O.
         *
         * @param inp - The target user-input stream to bind, must be a TTY
         * @param out - The target user-input stream to bind, must be a TTY
         */
        bind(inp = (this.binds ? this.binds.input : process.stdin) || process.stdin, out = (this.binds ? this.binds.output : process.stdout) || process.stdout, err = (this.binds ? this.binds.error : process.stderr) || process.stderr) {
            debug(`RGL.bind: ${this.binds}`);
            assert.ok(inp.isTTY && out.isTTY, Errors.ENOTTY);
            if (!!this.binds && !!this.binds.input) {
                debug(`RGL.bind: unbound`);
                this.binds.input.setRawMode(false);
                if (!!this.binds._inpCb)
                    this.binds.input.removeListener("data", this.binds._inpCb);
            }
            this.binds = {
                input: inp,
                output: out,
                error: err || process.stderr
            };
            this.binds.input.setRawMode(true);
            this.binds.input.on("data", this.binds._inpCb = data => {
                this.emit("rawkey", data);
                this.emit("key", data.toString());
                if (this.secureSwitch && data.toString() === '\u0003') {
                    this.emit("_exit");
                    process.exit();
                }
            });
            return this;
        } //bind
        /**
         * Start an instance of RGL.
         *
         * @param {any[]} params - Options passed to constructor
         */
        static create(...params) {
            debug(`RGL.create`);
            return new RGL(...params);
        } //create
    } //RGL
    RGL.mappings_s = new Map(_mappings_s);
    rgl.RGL = RGL;
})(rgl = exports.rgl || (exports.rgl = {})); //rgl
exports.default = rgl;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmdsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3JnbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUgsWUFBWSxDQUFDOzs7QUFFYixtREFBNkI7QUFDN0IscURBQStCO0FBQy9CLHVEQUFpQztBQUNqQyxtREFBNkI7QUFFN0Isc0RBQWdDO0FBQ2hDLDBEQUEwQjtBQUMxQixtREFBK0M7QUFFL0MsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFDakMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQy9CLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUMvQixNQUFNLEdBQWUsR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0FBRWhDLElBQWMsR0FBRyxDQTZZaEI7QUE3WUQsV0FBYyxHQUFHO0lBQ2hCLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUdyQixNQUFNLFdBQVcsR0FBK0IsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxFQUMvRyxXQUFXLEdBQStCLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUMsRUFDMUcsV0FBVyxHQUErQixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7SUFHNUc7O09BRUc7SUFDSCxJQUFpQixNQUFNLENBTXRCO0lBTkQsV0FBaUIsTUFBTTtRQUNULGFBQU0sR0FBRyxJQUFJLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ2hELGFBQU0sR0FBRyxJQUFJLFNBQVMsQ0FBQyxlQUFlLENB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QUFFLEtBQUssUUFBUSxFQUFFO29CQUN0RCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO29CQUNuQixPQUFPLENBQUMsSUFBSSxFQUFFLENBQUM7aUJBQ2Y7WUFDRixDQUFDLENBQUMsQ0FBQztZQUVILE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQyxDQUFDLE1BQU07UUFFUjs7OztXQUlHO1FBQ0ksTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQTBCO1lBQ2pELEtBQUssQ0FBQyxZQUFZLENBQUMsQ0FBQztZQUVwQixPQUFPLElBQUksR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLENBQUM7UUFDM0IsQ0FBQyxDQUFDLFFBQVE7TUFFVCxLQUFLO0lBdklXLGNBQVUsR0FBK0IsSUFBSSxHQUFHLENBQXdCLFdBQVcsQ0FBQyxDQUFDO0lBRjFGLE9BQUcsTUF5SWYsQ0FBQTtBQUVGLENBQUMsRUE3WWEsR0FBRyxHQUFILFdBQUcsS0FBSCxXQUFHLFFBNlloQixDQUFDLEtBQUs7QUFFUCxrQkFBZSxHQUFHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQGF1dGhvciBWLiBILlxyXG4gKiBAZmlsZSByZ2wudHNcclxuICogQHNpbmNlIDIwMjBcclxuICovXHJcblxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSBcInV0aWxcIjtcclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzLWV4dHJhXCI7XHJcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tIFwiYXNzZXJ0XCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgdHR5IGZyb20gXCJ0dHlcIjtcclxuaW1wb3J0ICogYXMgZXZlbnQgZnJvbSBcImV2ZW50c1wiO1xyXG5pbXBvcnQgY2hhbGsgZnJvbSBcImNoYWxrXCI7XHJcbmltcG9ydCB7IFN0cmluZ0RlY29kZXIgfSBmcm9tIFwic3RyaW5nX2RlY29kZXJcIjtcclxuXHJcbmNvbnN0IGRlYnVnID0gdXRpbC5kZWJ1Z2xvZyhcIlJHTFwiKSxcclxuXHRkZWJ1Z192ID0gdXRpbC5kZWJ1Z2xvZyhcIlJHTHZcIiksXHJcblx0ZGVidWdfZSA9IHV0aWwuZGVidWdsb2coXCJSR0xlXCIpLFxyXG5cdHZvaWRmbjogKCkgPT4gdm9pZCA9ICgpID0+IHsgfTtcclxuXHJcbmV4cG9ydCBtb2R1bGUgcmdsIHtcclxuXHRkZWJ1ZyhcInJnbCBsb2FkZWQuXCIpO1xyXG5cdFxyXG5cdFxyXG5cdGNvbnN0IF9tYXBwaW5nc19jOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPiA9IHJlcXVpcmUocGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLlwiLCBcIi4uXCIsIFwiUkdMTWFwcGluZ3NfYy5qc1wiKSksXHJcblx0XHRfbWFwcGluZ3NfYjogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4gPSByZXF1aXJlKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi5cIiwgXCIuLlwiLCBcIlJHTE1hcHBpbmdzX2IuanNcIikpLFxyXG5cdFx0X21hcHBpbmdzX3M6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+ID0gcmVxdWlyZShwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uXCIsIFwiLi5cIiwgXCJSR0xNYXBwaW5nc19zLmpzXCIpKTtcclxuXHRcclxuXHRcclxuXHQvKipcclxuXHQgKiBDb250YWluZXIgb2YgRXJyb3JzLlxyXG5cdCAqL1xyXG5cdGV4cG9ydCBuYW1lc3BhY2UgRXJyb3JzIHtcclxuXHRcdGV4cG9ydCBjb25zdCBFTk9CSU4gPSBuZXcgVHlwZUVycm9yKFwiQnVmZmVyIGlzIG5vdCBiaW5hcnkuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVOT0JVRiA9IG5ldyBUeXBlRXJyb3IoXCJOb3QgYSBCdWZmZXIuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURCVUYgPSBuZXcgUmFuZ2VFcnJvcihcIkJhZCBkYXRhLCBXcm9uZyBzaXplIG9yIGZvcm1hdC5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBRFRQWUUgPSBuZXcgVHlwZUVycm9yKFwiQmFkIHBhcmFtZXRlciB0eXBlLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFTk9UVFkgPSBuZXcgVHlwZUVycm9yKFwiTm90IGEgVFRZLlwiKTtcclxuXHR9IC8vRXJyb3JzXHJcblx0XHJcblx0LyoqXHJcblx0ICogQ29udGFpbmVyIG9mIEFEVCBjb250cmFjdHMuXHJcblx0ICovXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBUeXBlcyB7XHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQW55dGhpbmcgdGhhdCBjYW4gYmUgc2VyaWFsaXplZCBhbmQgcGFyc2VkLlxyXG5cdFx0ICovXHJcblx0XHRleHBvcnQgaW50ZXJmYWNlIENvbnZlcnRhYmxlIHtcclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIENvbnZlcnQgQ29udmVydGFibGUgaW50byBhIHdyaXRhYmxlIEJ1ZmZlci5cclxuXHRcdFx0ICovXHJcblx0XHRcdHNlcmlhbGl6ZTogQnVmZmVyO1xyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBvYmplY3QuXHJcblx0XHRcdCAqL1xyXG5cdFx0XHR0b1N0cmluZygpOiBzdHJpbmc7XHJcblx0XHR9IC8vQ29udmVydGFibGVcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiAnQ2xhc3MnIHR5cGUuXHJcblx0XHQgKi9cclxuXHRcdGV4cG9ydCB0eXBlIENsYXNzPFQ+ID0gbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVDtcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBJL08gYmluZGluZyB0eXBlLlxyXG5cdFx0ICovXHJcblx0XHRleHBvcnQgdHlwZSBJTyA9IHtcclxuXHRcdFx0aW5wdXQ6IE5vZGVKUy5SZWFkU3RyZWFtO1xyXG5cdFx0XHRvdXRwdXQ6IE5vZGVKUy5Xcml0ZVN0cmVhbTtcclxuXHRcdFx0ZXJyb3I/OiBOb2RlSlMuUmVhZFdyaXRlU3RyZWFtO1xyXG5cdFx0XHRfaW5wQ2I/OiAoZGF0YTogQnVmZmVyKSA9PiB2b2lkO1xyXG5cdFx0fTtcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiAnTWFwcGluZycgdHlwZS5cclxuXHRcdCAqL1xyXG5cdFx0ZXhwb3J0IHR5cGUgTWFwcGluZyA9ICh0ZXh0OiBzdHJpbmcpID0+IHN0cmluZztcclxuXHR9IC8vVHlwZXNcclxuXHRcclxuXHRcclxuXHQvKipcclxuXHQgKiBSZXNwb25zaWJsZSBmb3IgcmVwcmVzZW50aW5nIENodW5rcy5cclxuXHQgKi9cclxuXHRjbGFzcyBSR0xUaWxlIGltcGxlbWVudHMgVHlwZXMuQ29udmVydGFibGUge1xyXG5cdFx0XHJcblx0XHRwcml2YXRlIHN0YXRpYyByZWFkb25seSB0cmltOiBSZWdFeHAgPSAvXFx1MDAwMC9naW07XHJcblx0XHRwcml2YXRlIHN0YXRpYyBfaWRjbnRyOiBudW1iZXIgPSAwO1xyXG5cdFx0cHJvdGVjdGVkIHN0YXRpYyBkZWNvZGVyOiBTdHJpbmdEZWNvZGVyID0gbmV3IFN0cmluZ0RlY29kZXIoXCJ1dGY4XCIpO1xyXG5cdFx0c3RhdGljIG1hcHBpbmdzX2M6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+O1xyXG5cdFx0c3RhdGljIG1hcHBpbmdzX2I6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+O1xyXG5cdFx0c3RhdGljIG1hcHBpbmdzX3M6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+O1xyXG5cdFx0XHJcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pZDogbnVtYmVyID0gUkdMVGlsZS5faWRjbnRyKys7XHJcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgcHJlY2FsYzogc3RyaW5nID0gXCJcIjtcclxuXHRcdHByb3RlY3RlZCByZWFkb25seSByZXNlcnZlZDogbnVtYmVyO1xyXG5cdFx0XHJcblx0XHRcclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgcmVhZG9ubHkgb3JpZ2luOiBSZWFkb25seTxCdWZmZXI+KSB7XHJcblx0XHRcdGFzc2VydC5vayhvcmlnaW4ubGVuZ3RoID09IDgsIEVycm9ycy5FQkFEQlVGKTtcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMub3JpZ2luID0gQnVmZmVyLmZyb20ob3JpZ2luKTtcclxuXHRcdFx0dGhpcy5wcmVjYWxjID0gKFJHTFRpbGUubWFwcGluZ3Nfcy5nZXQob3JpZ2luWzZdKSB8fCAodCA9PiB0KSkoKFJHTFRpbGUubWFwcGluZ3NfYi5nZXQob3JpZ2luWzVdKSB8fCAodCA9PiB0KSkoKFJHTFRpbGUubWFwcGluZ3NfYy5nZXQob3JpZ2luWzRdKSB8fCAodCA9PiB0KSkoUkdMVGlsZS5kZWNvZGVyLndyaXRlKG9yaWdpbi5zbGljZSgwLCA0KSkucmVwbGFjZShSR0xUaWxlLnRyaW0sICcnKSkpKTtcclxuXHRcdFx0dGhpcy5yZXNlcnZlZCA9IG9yaWdpbls3XTtcclxuXHRcdH0gLy9jdG9yXHJcblx0XHRcclxuXHRcdFxyXG5cdFx0cHVibGljIGdldCBzZXJpYWxpemUoKTogQnVmZmVyIHtcclxuXHRcdFx0ZGVidWcoYFJHTFRpbGUuc2VyaWFsaXplYCk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gQnVmZmVyLmZyb20odGhpcy5vcmlnaW4pO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZVxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIFBhcnNlIGRhdGEgaW50byBhIENvbnZlcnRhYmxlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7UmVhZG9ubHk8QnVmZmVyPn0gY2h1bmtcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBwYXJzZShjaHVuazogUmVhZG9ubHk8QnVmZmVyPik6IFJHTFRpbGUge1xyXG5cdFx0XHRkZWJ1ZyhgUkdMVGlsZS5wYXJzZWApO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIG5ldyBSR0xUaWxlKGNodW5rKTtcclxuXHRcdH0gLy9wYXJzZVxyXG5cdFx0XHJcblx0XHRcclxuXHRcdHB1YmxpYyB0b1N0cmluZygpOiBzdHJpbmcge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5wcmVjYWxjO1xyXG5cdFx0fSAvL3RvU3RyaW5nXHJcblxyXG5cdFx0cHVibGljIFtTeW1ib2wudG9QcmltaXRpdmVdKGhpbnQ6IHN0cmluZykge1xyXG5cdFx0XHRpZiAoaGludCA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIHRoaXMudG9TdHJpbmcoKTtcclxuXHRcdFx0ZWxzZSByZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHRcdFxyXG5cdH0gLy9SR0xUaWxlXHJcblx0XHJcblx0LyoqXHJcblx0ICogUmVzcG9uc2libGUgZm9yIHBhcnNpbmcgYW5kIHN0cmlwcGluZyBDaHVua3MuXHJcblx0ICovXHJcblx0Y2xhc3MgUkdMTWFwIGltcGxlbWVudHMgVHlwZXMuQ29udmVydGFibGUge1xyXG5cdFx0XHJcblx0XHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQUdJQzogQnVmZmVyID0gQnVmZmVyLmZyb20oWzB4MDMsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTtcclxuXHRcdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJHTDogQnVmZmVyID0gQnVmZmVyLmZyb20oWzB4NTIsIDB4NDcsIDB4NEMsIDB4MDJdKTtcclxuXHRcdHByaXZhdGUgc3RhdGljIF9pZGNudHI6IG51bWJlciA9IDA7XHJcblx0XHRcclxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lkOiBudW1iZXIgPSBSR0xNYXAuX2lkY250cisrO1xyXG5cdFx0XHJcblx0XHRcclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3RvcihcclxuXHRcdFx0cHJvdGVjdGVkIHJlc2VydmVkOiBCdWZmZXIgPSBCdWZmZXIuYWxsb2MoMywgMCksXHJcblx0XHRcdHByb3RlY3RlZCBzaXplOiBCdWZmZXIgPSBCdWZmZXIuYWxsb2MoMiwgMCksXHJcblx0XHRcdHByb3RlY3RlZCB0aWxlczogUkdMVGlsZVtdID0gWyBdLFxyXG5cdFx0XHRwcm90ZWN0ZWQgdHJhaWxpbmc6IEJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZSgwKSxcclxuXHRcdFx0cHJvdGVjdGVkIF9mcm9tRmlsZTogc3RyaW5nID0gXCJcIlxyXG5cdFx0KSB7XHJcblx0XHRcdHRoaXMuX2Zyb21GaWxlID0gcGF0aC5yZXNvbHZlKHBhdGgubm9ybWFsaXplKF9mcm9tRmlsZSkpO1xyXG5cdFx0fSAvL2N0b3JcclxuXHRcdFxyXG5cdFx0XHJcblx0XHRwdWJsaWMgZ2V0IHNlcmlhbGl6ZSgpOiBCdWZmZXIge1xyXG5cdFx0XHRkZWJ1ZyhgUkdMTWFwLnNlcmlhbGl6ZWApO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IHJldDogQnVmZmVyID0gQnVmZmVyLmNvbmNhdChbdGhpcy5yZXNlcnZlZCwgUkdMTWFwLlJHTCwgdGhpcy5zaXplXSk7XHJcblx0XHRcdFxyXG5cdFx0XHRmb3IgKGNvbnN0IHRpbGUgb2YgdGhpcy50aWxlcykgcmV0ID0gQnVmZmVyLmNvbmNhdChbcmV0LCB0aWxlLnNlcmlhbGl6ZV0pO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIEJ1ZmZlci5jb25jYXQoW3JldCwgUkdMTWFwLk1BR0lDLCB0aGlzLnRyYWlsaW5nIF0pO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZVxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdG9yZSBDb252ZXJ0YWJsZSBpbnRvIGEgd3JpdGFibGUgJ2ZpbGUnLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBmaWxlIC0gVGFyZ2V0IGZpbGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIGFzeW5jIHNlcmlhbGl6ZUZpbGUoZmlsZTogUmVhZG9ubHk8c3RyaW5nPiA9IHRoaXMuX2Zyb21GaWxlKTogUHJvbWlzZTxCdWZmZXI+IHtcclxuXHRcdFx0ZGVidWcoYFJHTE1hcC5zZXJpYWxpemVGaWxlOiAke2ZpbGV9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgZGF0YTogQnVmZmVyO1xyXG5cdFx0XHRcclxuXHRcdFx0YXdhaXQgZnMub3V0cHV0RmlsZShmaWxlLCBkYXRhID0gdGhpcy5zZXJpYWxpemUsIHtcclxuXHRcdFx0XHRtb2RlOiAwbzc1MSxcclxuXHRcdFx0XHRlbmNvZGluZzogXCJiaW5hcnlcIixcclxuXHRcdFx0XHRmbGFnOiBcIndcIlxyXG5cdFx0XHR9KTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBkYXRhO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZUZpbGVcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBkYXRhIGludG8gYSBDb252ZXJ0YWJsZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1JlYWRvbmx5PEJ1ZmZlcj59IGNodW5rXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgcGFyc2UoZGF0YTogUmVhZG9ubHk8QnVmZmVyPik6IFJHTE1hcCB7XHJcblx0XHRcdGRlYnVnKGBSR0xNYXAucGFyc2VgKTtcclxuXHRcdFx0XHJcblx0XHRcdGFzc2VydC5vayhCdWZmZXIuaXNCdWZmZXIoZGF0YSksIEVycm9ycy5FTk9CVUYpO1xyXG5cdFx0XHRhc3NlcnQub2soQnVmZmVyLmlzRW5jb2RpbmcoXCJiaW5hcnlcIiksIEVycm9ycy5FTk9CSU4pO1xyXG5cdFx0XHRhc3NlcnQub2soZGF0YS5sZW5ndGggPj0gOSwgRXJyb3JzLkVCQURCVUYpO1xyXG5cdFx0XHRcclxuXHRcdFx0Y29uc3QgbWFwOiBSR0xNYXAgPSBuZXcgUkdMTWFwKGRhdGEuc2xpY2UoMCwgMyksIGRhdGEuc2xpY2UoNywgOSkpO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IGlkeDogbnVtYmVyID0gOTtcclxuXHRcdFx0XHJcblx0XHRcdHdoaWxlIChpZHggPCBkYXRhLmxlbmd0aCAmJiAhZGF0YS5zbGljZShpZHgsIGlkeCArIDUpLmVxdWFscyhSR0xNYXAuTUFHSUMpKVxyXG5cdFx0XHRcdG1hcC50aWxlcy5wdXNoKFJHTFRpbGUucGFyc2UoZGF0YS5zbGljZShpZHgsIGlkeCArPSA4KSkpO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKGlkeCAhPSBkYXRhLmxlbmd0aCkge1xyXG5cdFx0XHRcdGRlYnVnX3YoYFJHTE1hcC5wYXJzZTogaGFzIHRyYWlsaW5nYCk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0bWFwLnRyYWlsaW5nID0gZGF0YS5zbGljZShpZHggKyA1KTtcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIG1hcDtcclxuXHRcdH0gLy9wYXJzZVxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWFkIEJ1ZmZlciBmcm9tICdmaWxlJy5cclxuXHRcdCAqIFxyXG5cdFx0ICogQHBhcmFtIGZpbGUgLSBUYXJnZXQgZmlsZVxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGFzeW5jIHBhcnNlRmlsZShmaWxlOiBSZWFkb25seTxzdHJpbmc+KTogUHJvbWlzZTxSR0xNYXA+IHtcclxuXHRcdFx0ZGVidWcoYFJHTE1hcC5wYXJzZUZpbGU6ICR7ZmlsZX1gKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzLCByZWopID0+IHtcclxuXHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2VGaWxlOiBBQ0NFU1NgKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRmcy5hY2Nlc3MoZmlsZSwgZnMuY29uc3RhbnRzLkZfT0sgfCBmcy5jb25zdGFudHMuUl9PSywgZXJyID0+IHtcclxuXHRcdFx0XHRcdGlmIChlcnIpIHtcclxuXHRcdFx0XHRcdFx0ZGVidWdfZShgUkdMTWFwLnBhcnNlRmlsZTogJHtmaWxlfSAtPiBFQUNDRVNTYCk7XHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRyZWooZXJyKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGRlYnVnX3YoYFJHTE1hcC5wYXJzZUZpbGU6IFJTVFJFQU1gKTtcclxuXHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdGNvbnN0IHN0cjogZnMuUmVhZFN0cmVhbSA9IGZzLmNyZWF0ZVJlYWRTdHJlYW0oZmlsZSwge1xyXG5cdFx0XHRcdFx0XHRcdGZsYWdzOiBcInJcIixcclxuXHRcdFx0XHRcdFx0XHRlbmNvZGluZzogXCJiaW5hcnlcIixcclxuXHRcdFx0XHRcdFx0XHRtb2RlOiBmcy5jb25zdGFudHMuU19JUlVTUiB8IGZzLmNvbnN0YW50cy5TX0lYR1JQLFxyXG5cdFx0XHRcdFx0XHRcdGVtaXRDbG9zZTogdHJ1ZVxyXG5cdFx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0XHQub25jZShcInJlYWRhYmxlXCIsIGFzeW5jICgpID0+IHtcclxuXHRcdFx0XHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2VGaWxlOiAke2ZpbGV9IC0+IFJlYWRhYmxlYCk7XHJcblx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0bGV0IGRhdGE6IHN0cmluZyA9ICcnO1xyXG5cdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdHN0ci5zZXRFbmNvZGluZyhcImJpbmFyeVwiKTtcclxuXHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRmb3IgYXdhaXQgKGxldCBjaHVuayBvZiBzdHIpIGRhdGEgKz0gY2h1bms7XHJcblx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0c3RyLm9uY2UoXCJjbG9zZVwiLCAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBtYXA6IFJHTE1hcCA9IFJHTE1hcC5wYXJzZShCdWZmZXIuZnJvbShkYXRhLCBcImJpbmFyeVwiKSk7XHJcblx0XHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRcdG1hcC5fZnJvbUZpbGUgPSBmaWxlO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0XHRyZXMobWFwKTtcclxuXHRcdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSAvL3BhcnNlRmlsZVxyXG5cdFx0XHJcblx0XHRcclxuXHRcdHB1YmxpYyB0b1N0cmluZygpOiBzdHJpbmcge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy50aWxlcy5tYXAoKHRpbGU6IFJHTFRpbGUpOiBzdHJpbmcgPT4gdGlsZS50b1N0cmluZygpKS5qb2luKCcnKTtcclxuXHRcdH0gLy90b1N0cmluZ1xyXG5cdFx0XHJcblx0XHRwdWJsaWMgW1N5bWJvbC50b1ByaW1pdGl2ZV0oaGludDogc3RyaW5nKSB7XHJcblx0XHRcdGlmIChoaW50ID09PSBcInN0cmluZ1wiKSByZXR1cm4gdGhpcy50b1N0cmluZygpO1xyXG5cdFx0XHRlbHNlIHJldHVybiB0aGlzO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0fSAvL1JHTE1hcFxyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIFJlc3BvbnNpYmxlIGZvciBjb250cm9sbGluZyB0cmFuc2l0aW9ucyBhbmQgc2V0dGluZ3MuXHJcblx0ICogXHJcblx0ICogVE9ETzogQWRkIGNvbnRyb2xzLlxyXG5cdCAqL1xyXG5cdGV4cG9ydCBjbGFzcyBSR0wgZXh0ZW5kcyBldmVudC5FdmVudEVtaXR0ZXIge1xyXG5cdFx0XHJcblx0XHRwcm90ZWN0ZWQgc3RhdGljIG1hcHBpbmdzX3M6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+ID0gbmV3IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+KF9tYXBwaW5nc19zKTtcclxuXHRcdFxyXG5cdFx0cHJvdGVjdGVkIHNlY3VyZVN3aXRjaDogYm9vbGVhbiA9IHRydWU7ICAvKiBVbmJpbmQgQ1RSTC1DICovXHJcblx0XHRwcm90ZWN0ZWQgYmluZHM6IFR5cGVzLklPIHwgbnVsbCA9IG51bGw7XHJcblx0XHRcclxuXHRcdFxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxyXG5cdFx0XHRhdXRvY29uZmlnOiBib29sZWFuID0gdHJ1ZSxcclxuXHRcdFx0cHJvdGVjdGVkIG1hcHBpbmdzX2M6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+ID0gX21hcHBpbmdzX2MsXHJcblx0XHRcdHByb3RlY3RlZCBtYXBwaW5nc19iOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPiA9IF9tYXBwaW5nc19iLFxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgX01hcDogdHlwZW9mIFJHTE1hcCA9IFJHTE1hcCxcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9UaWxlOiB0eXBlb2YgUkdMVGlsZSA9IFJHTFRpbGVcclxuXHRcdCkge1xyXG5cdFx0XHRzdXBlcigpO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKCFSR0wuc3VwcG9ydHNDb2xvcnMpIGNvbnNvbGUud2FybihcIlRlcm1pbmFsIGNvbG9ycyBhcmUgbm90IHN1cHBvcnRlZCFcIik7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLm1hcHBpbmdzX2MgPSBuZXcgTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4obWFwcGluZ3NfYyk7XHJcblx0XHRcdHRoaXMubWFwcGluZ3NfYiA9IG5ldyBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPihtYXBwaW5nc19iKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmIChhdXRvY29uZmlnKSB7XHJcblx0XHRcdFx0UHJvbWlzZS5hbGwoW1xyXG5cdFx0XHRcdFx0dGhpcy5sb2FkTWFwcGluZ3NfYygpLFxyXG5cdFx0XHRcdFx0dGhpcy5sb2FkTWFwcGluZ3NfYigpXHJcblx0XHRcdFx0XSkuY2F0Y2goKCkgPT4gZGVidWdfZShcIlJHTC5hdXRvY29uZjogRU1BUFBJTkdcIikpLnRoZW4oKCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19jID0gdGhpcy5tYXBwaW5nc19jO1xyXG5cdFx0XHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19iID0gdGhpcy5tYXBwaW5nc19iO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRkZWJ1ZyhcIlJHTC5jdG9yIGRlZmZlcmVkIG1hcHBpbmdzLlwiKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR0aGlzLmJpbmQoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19jID0gdGhpcy5tYXBwaW5nc19jO1xyXG5cdFx0XHR0aGlzLl9UaWxlLm1hcHBpbmdzX2IgPSB0aGlzLm1hcHBpbmdzX2I7XHJcblx0XHRcdHRoaXMuX1RpbGUubWFwcGluZ3NfcyA9IFJHTC5tYXBwaW5nc19zO1xyXG5cdFx0fSAvL2N0b3JcclxuXHRcdFxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIFdoZXRoZXIgdGhlIFRUWSBzdXBwb3J0cyBiYXNpYyBjb2xvcnMuXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgZ2V0IHN1cHBvcnRzQ29sb3JzKCk6IGJvb2xlYW4ge1xyXG5cdFx0XHRyZXR1cm4gISFjaGFsay5sZXZlbDtcclxuXHRcdH0gLy9zdXBwb3J0c0NvbG9yc1xyXG5cdFx0XHJcblx0XHRwdWJsaWMgYXN5bmMgbG9hZE1hcHBpbmdzX2MocGF0aD86IFJlYWRvbmx5PHN0cmluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYyhtYXA/OiBSZWFkb25seTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYyhtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PiA9IFwiUkdMTWFwcGluZ3NfYy5qc1wiKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4ge1xyXG5cdFx0XHR0aGlzLmVtaXQoXCJfbG9hZENvbG9yc1wiLCBtYXApO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIFJHTC5sb2FkTWFwcGluZ3MobWFwLCB0aGlzLm1hcHBpbmdzX2MpO1xyXG5cdFx0fSAvL2xvYWRNYXBwaW5nc19jXHJcblx0XHRcclxuXHRcdHB1YmxpYyBhc3luYyBsb2FkTWFwcGluZ3NfYihwYXRoPzogUmVhZG9ubHk8c3RyaW5nPik6IFByb21pc2U8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+O1xyXG5cdFx0cHVibGljIGxvYWRNYXBwaW5nc19iKG1hcD86IFJlYWRvbmx5PE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+Pik6IFByb21pc2U8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+O1xyXG5cdFx0cHVibGljIGxvYWRNYXBwaW5nc19iKG1hcDogUmVhZG9ubHk8c3RyaW5nIHwgTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+ID0gXCJSR0xNYXBwaW5nc19iLmpzXCIpOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PiB7XHJcblx0XHRcdHRoaXMuZW1pdChcIl9sb2FkQmFja2dyb3VuZFwiLCBtYXApO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIFJHTC5sb2FkTWFwcGluZ3MobWFwLCB0aGlzLm1hcHBpbmdzX2IpO1xyXG5cdFx0fSAvL2xvYWRNYXBwaW5nc19jXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogSW5jbHVkZSBjdXN0b20gbWFwcGluZ3MuXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSBtYXAgLSBMb2FkIG5ldyBtYXBwaW5nc1xyXG5cdFx0ICogQHBhcmFtIG9yaWcgLSBNYXBwaW5ncyB0byBvdmVycmlkZVxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGFzeW5jIGxvYWRNYXBwaW5ncyhtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+Piwgb3JpZzogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PiB7XHJcblx0XHRcdGRlYnVnKFwiUkdMLmxvYWRNYXBwaW5nczpcIiwgdXRpbC5pbnNwZWN0KG9yaWcsIHsgYnJlYWtMZW5ndGg6IEluZmluaXR5IH0pKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmICh0eXBlb2YgbWFwID09PSBcInN0cmluZ1wiKSB7XHJcblx0XHRcdFx0ZGVsZXRlIHJlcXVpcmUuY2FjaGVbcmVxdWlyZS5yZXNvbHZlKG1hcCldO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGNvbnN0IGRhdGE6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+ID0gcmVxdWlyZShtYXApO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGZvciAobGV0IHNpZyBvZiBkYXRhKSBvcmlnLnNldChzaWdbMF0sIHNpZ1sxXSk7XHJcblx0XHRcdH0gZWxzZSBpZiAobWFwIGluc3RhbmNlb2YgTWFwKSB7XHJcblx0XHRcdFx0Zm9yIChsZXQgc2lnIG9mIG1hcCkgb3JpZy5zZXQoc2lnWzBdLCBzaWdbMV0pO1xyXG5cdFx0XHR9IGVsc2UgdGhyb3cgRXJyb3JzLkVCQURUUFlFO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIG9yaWc7XHJcblx0XHR9IC8vbG9hZE1hcHBpbmdzXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQmluZCB0aGUgUkdMIGVuZ2luZSB0byBJL08uXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSBpbnAgLSBUaGUgdGFyZ2V0IHVzZXItaW5wdXQgc3RyZWFtIHRvIGJpbmQsIG11c3QgYmUgYSBUVFlcclxuXHRcdCAqIEBwYXJhbSBvdXQgLSBUaGUgdGFyZ2V0IHVzZXItaW5wdXQgc3RyZWFtIHRvIGJpbmQsIG11c3QgYmUgYSBUVFlcclxuXHRcdCAqL1xyXG5cdFx0YmluZChpbnA6IHR0eS5SZWFkU3RyZWFtID0gKHRoaXMuYmluZHMgPyB0aGlzLmJpbmRzLmlucHV0IDogcHJvY2Vzcy5zdGRpbikgfHwgcHJvY2Vzcy5zdGRpbiwgb3V0OiB0dHkuV3JpdGVTdHJlYW0gPSAodGhpcy5iaW5kcyA/IHRoaXMuYmluZHMub3V0cHV0IDogcHJvY2Vzcy5zdGRvdXQpIHx8IHByb2Nlc3Muc3Rkb3V0LCBlcnI6IE5vZGVKUy5SZWFkV3JpdGVTdHJlYW0gPSAodGhpcy5iaW5kcyA/IHRoaXMuYmluZHMuZXJyb3IgOiBwcm9jZXNzLnN0ZGVycikgfHwgcHJvY2Vzcy5zdGRlcnIpOiB0aGlzIHtcclxuXHRcdFx0ZGVidWcoYFJHTC5iaW5kOiAke3RoaXMuYmluZHN9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRhc3NlcnQub2soaW5wLmlzVFRZICYmIG91dC5pc1RUWSwgRXJyb3JzLkVOT1RUWSk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoISF0aGlzLmJpbmRzICYmICEhdGhpcy5iaW5kcyEuaW5wdXQpIHtcclxuXHRcdFx0XHRkZWJ1ZyhgUkdMLmJpbmQ6IHVuYm91bmRgKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR0aGlzLmJpbmRzIS5pbnB1dC5zZXRSYXdNb2RlKGZhbHNlKTtcclxuXHRcdFx0XHRpZiAoISF0aGlzLmJpbmRzIS5faW5wQ2IpIHRoaXMuYmluZHMhLmlucHV0LnJlbW92ZUxpc3RlbmVyKFwiZGF0YVwiLCB0aGlzLmJpbmRzIS5faW5wQ2IpO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmJpbmRzID0gPFR5cGVzLklPPntcclxuXHRcdFx0XHRpbnB1dDogaW5wLFxyXG5cdFx0XHRcdG91dHB1dDogb3V0LFxyXG5cdFx0XHRcdGVycm9yOiBlcnIgfHwgcHJvY2Vzcy5zdGRlcnJcclxuXHRcdFx0fTtcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMuYmluZHMhLmlucHV0LnNldFJhd01vZGUodHJ1ZSk7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmJpbmRzIS5pbnB1dC5vbihcImRhdGFcIiwgdGhpcy5iaW5kcyEuX2lucENiID0gZGF0YSA9PiB7XHJcblx0XHRcdFx0dGhpcy5lbWl0KFwicmF3a2V5XCIsIGRhdGEpO1xyXG5cdFx0XHRcdHRoaXMuZW1pdChcImtleVwiLCBkYXRhLnRvU3RyaW5nKCkpO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh0aGlzLnNlY3VyZVN3aXRjaCAmJiBkYXRhLnRvU3RyaW5nKCkgPT09ICdcXHUwMDAzJykge1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0KFwiX2V4aXRcIik7XHJcblx0XHRcdFx0XHRwcm9jZXNzLmV4aXQoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHR9IC8vYmluZFxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIFN0YXJ0IGFuIGluc3RhbmNlIG9mIFJHTC5cclxuXHRcdCAqIFxyXG5cdFx0ICogQHBhcmFtIHthbnlbXX0gcGFyYW1zIC0gT3B0aW9ucyBwYXNzZWQgdG8gY29uc3RydWN0b3JcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBjcmVhdGUoLi4ucGFyYW1zOiBSZWFkb25seUFycmF5PGFueT4pOiBSR0wge1xyXG5cdFx0XHRkZWJ1ZyhgUkdMLmNyZWF0ZWApO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIG5ldyBSR0woLi4ucGFyYW1zKTtcclxuXHRcdH0gLy9jcmVhdGVcclxuXHRcdFxyXG5cdH0gLy9SR0xcclxuXHRcclxufSAvL3JnbFxyXG5cclxuZXhwb3J0IGRlZmF1bHQgcmdsO1xyXG4iXX0=