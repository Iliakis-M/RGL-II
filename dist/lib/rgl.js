/**
 * @author V. H.
 * @file rgl.ts
 * @since 2020
 */
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.rgl = void 0;
const tslib_1 = require("tslib");
const fs = tslib_1.__importStar(require("fs-extra"));
const assert = tslib_1.__importStar(require("assert"));
const path = tslib_1.__importStar(require("path"));
const event = tslib_1.__importStar(require("events"));
const util_1 = require("util");
const string_decoder_1 = require("string_decoder");
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const debug = util_1.debuglog("RGL"), debug_v = util_1.debuglog("RGLv"), debug_e = util_1.debuglog("RGLe"), voidfn = () => { };
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
        Errors.EBADBIND = new ReferenceError("Bad bindings.");
    })(Errors = rgl.Errors || (rgl.Errors = {})); //Errors
    let util;
    (function (util) {
        function idxToCrd(idx, sz) {
            return [idx % sz, Math.floor(idx / sz)];
        } //idxToCrd
        util.idxToCrd = idxToCrd;
        function crdToIdx(crd, sz) {
            return crd[1] * sz + crd[0];
        } //crdToIdx
        util.crdToIdx = crdToIdx;
    })(util = rgl.util || (rgl.util = {})); //util
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile {
        constructor(origin) {
            this.origin = origin;
            this._id = RGLTile._idcntr++;
            this.precalc = "";
            this.coords = [0, 0];
            assert.ok(origin.length == 8, Errors.EBADBUF);
            this.origin = Buffer.from(origin);
            this.precalc = (RGLTile.mappings_s.get(origin[6]) || (t => t))((RGLTile.mappings_b.get(origin[5]) || (t => t))((RGLTile.mappings_c.get(origin[4]) || (t => t))(RGLTile.decoder.write(origin.slice(0, 4)).replace(RGLTile.trim, ''))));
            this.reserved = origin[7];
        } //ctor
        get serialize() {
            //debug(`RGLTile.serialize`);
            return Buffer.from(this.origin);
        } //serialize
        /**
         * Parse data into a Convertable.
         *
         * @param {Readonly<Buffer>} chunk
         */
        static parse(chunk, parent) {
            //debug(`RGLTile.parse`);
            let ret;
            if (chunk instanceof RGLTile) {
                ret = new RGLTile(chunk.origin);
                ret.coords = Array.from(chunk.coords);
            }
            else
                ret = new RGLTile(chunk);
            ret.parent = parent;
            return ret;
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
            this.trans = [0, 0];
            this._fromFile = path.resolve(path.normalize(_fromFile));
        } //ctor
        get serialize() {
            debug(`RGLMap.serialize`);
            let ret = Buffer.concat([this.reserved, RGLMap.RGL, this.size]);
            this._sortTiles();
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
            let idx = 9, cntr = 0;
            while (idx < data.length && !data.slice(idx, idx + 5).equals(RGLMap.MAGIC)) {
                let tile;
                map.tiles.push(tile = RGLTile.parse(data.slice(idx, idx += 8)));
                tile.parent = map;
                tile.coords = [cntr % map.size[0], Math.floor(cntr / map.size[0])];
            }
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
        _sortTiles(tiles = this.tiles) {
            tiles.sort((a, b) => util.crdToIdx(a.coords, this.size[0]) - util.crdToIdx(b.coords, this.size[0]));
        } //_sortTiles
        /**
         * Check validity of tile's coords.
         */
        checkValidity() {
            return true;
        } //checkValidity
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
            debug("RGL.loadMappings:", util_1.inspect(orig, { breakLength: Infinity }));
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
                error: err
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
        unbind() {
            debug(`RGL.unbind: ${this.binds}`);
            assert.ok(this.binds && this.binds.input.isTTY && this.binds.output.isTTY, Errors.EBADBIND);
            this.binds.input.setRawMode(false);
            if (!!this.binds._inpCb)
                this.binds.input.removeListener("data", this.binds._inpCb);
            return this;
        } //unbind
        emit(event, ...args) {
            return super.emit(event, ...args);
        } //emit
        on(event, listener) {
            return super.on(event, listener);
        } //on
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmdsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3JnbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUgsWUFBWSxDQUFDOzs7O0FBRWIscURBQStCO0FBQy9CLHVEQUFpQztBQUNqQyxtREFBNkI7QUFFN0Isc0RBQWdDO0FBQ2hDLCtCQUF5QztBQUN6QyxtREFBK0M7QUFDL0MsMERBQTBCO0FBRTFCLE1BQU0sS0FBSyxHQUFHLGVBQVEsQ0FBQyxLQUFLLENBQUMsRUFDNUIsT0FBTyxHQUFHLGVBQVEsQ0FBQyxNQUFNLENBQUMsRUFDMUIsT0FBTyxHQUFHLGVBQVEsQ0FBQyxNQUFNLENBQUMsRUFDMUIsTUFBTSxHQUFlLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUVoQyxJQUFjLEdBQUcsQ0F3ZGhCO0FBeGRELFdBQWMsR0FBRztJQUNoQixLQUFLLENBQUMsYUFBYSxDQUFDLENBQUM7SUFHckIsTUFBTSxXQUFXLEdBQStCLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUMsRUFDL0csV0FBVyxHQUErQixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLEVBQzFHLFdBQVcsR0FBK0IsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBRzVHOztPQUVHO0lBQ0gsSUFBaUIsTUFBTSxDQU90QjtJQVBELFdBQWlCLE1BQU07UUFDVCxhQUFNLEdBQVUsSUFBSSxTQUFTLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUN2RCxhQUFNLEdBQVUsSUFBSSxTQUFTLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDL0MsY0FBTyxHQUFVLElBQUks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LENBQUMsS0FBTSxDQUFDLE1BQU07Z0JBQUUsSUFBSSxDQUFDLEtBQU0sQ0FBQyxLQUFLLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxJQUFJLENBQUMsS0FBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBRXZGLE9BQU8sSUFBSSxDQUFDO1FBQ2IsQ0FBQyxDQUFDLFFBQVE7UUFRVixJQUFJLENBQUMsS0FBc0IsRUFBRSxHQUFHLElBQVc7WUFDMUMsT0FBTyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO1FBQ25DLENBQUMsQ0FBQyxNQUFNO1FBUUQsRUFBRSxDQUFDLEtBQXNCLEVBQUUsUUFBa0M7WUFDbkUsT0FBTyxLQUFLLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztRQUNsQyxDQUFDLENBQUMsSUFBSTtRQUVOOzs7O1dBSUc7UUFDSSxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBMEI7WUFDakQsS0FBSyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBRXBCLE9BQU8sSUFBSSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztRQUMzQixDQUFDLENBQUMsUUFBUTtNQUVULEtBQUs7SUF0S1csY0FBVSxHQUErQixJQUFJLEdBQUcsQ0FBd0IsV0FBVyxDQUFDLENBQUM7SUFGMUYsT0FBRyxNQXdLZixDQUFBO0FBRUYsQ0FBQyxFQXhkYSxHQUFHLEdBQUgsV0FBRyxLQUFILFdBQUcsUUF3ZGhCLENBQUMsS0FBSztBQUVQLGtCQUFlLEdBQUcsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbIi8qKlxyXG4gKiBAYXV0aG9yIFYuIEguXHJcbiAqIEBmaWxlIHJnbC50c1xyXG4gKiBAc2luY2UgMjAyMFxyXG4gKi9cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzLWV4dHJhXCI7XHJcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tIFwiYXNzZXJ0XCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgdHR5IGZyb20gXCJ0dHlcIjtcclxuaW1wb3J0ICogYXMgZXZlbnQgZnJvbSBcImV2ZW50c1wiO1xyXG5pbXBvcnQgeyBpbnNwZWN0LCBkZWJ1Z2xvZyB9IGZyb20gXCJ1dGlsXCI7XHJcbmltcG9ydCB7IFN0cmluZ0RlY29kZXIgfSBmcm9tIFwic3RyaW5nX2RlY29kZXJcIjtcclxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgZGVidWcgPSBkZWJ1Z2xvZyhcIlJHTFwiKSxcclxuXHRkZWJ1Z192ID0gZGVidWdsb2coXCJSR0x2XCIpLFxyXG5cdGRlYnVnX2UgPSBkZWJ1Z2xvZyhcIlJHTGVcIiksXHJcblx0dm9pZGZuOiAoKSA9PiB2b2lkID0gKCkgPT4geyB9O1xyXG5cclxuZXhwb3J0IG1vZHVsZSByZ2wge1xyXG5cdGRlYnVnKFwicmdsIGxvYWRlZC5cIik7XHJcblx0XHJcblx0XHJcblx0Y29uc3QgX21hcHBpbmdzX2M6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+ID0gcmVxdWlyZShwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uXCIsIFwiLi5cIiwgXCJSR0xNYXBwaW5nc19jLmpzXCIpKSxcclxuXHRcdF9tYXBwaW5nc19iOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPiA9IHJlcXVpcmUocGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLlwiLCBcIi4uXCIsIFwiUkdMTWFwcGluZ3NfYi5qc1wiKSksXHJcblx0XHRfbWFwcGluZ3NfczogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4gPSByZXF1aXJlKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi5cIiwgXCIuLlwiLCBcIlJHTE1hcHBpbmdzX3MuanNcIikpO1xyXG5cdFxyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIENvbnRhaW5lciBvZiBFcnJvcnMuXHJcblx0ICovXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBFcnJvcnMge1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVOT0JJTjogRXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQnVmZmVyIGlzIG5vdCBiaW5hcnkuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVOT0JVRjogRXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiTm90IGEgQnVmZmVyLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEQlVGOiBFcnJvciA9IG5ldyBSYW5nZUVycm9yKFwiQmFkIGRhdGEsIFdyb25nIHNpemUgb3IgZm9ybWF0LlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEVFBZRTogRXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQmFkIHBhcmFtZXRlciB0eXBlLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFTk9UVFk6IEVycm9yID0gbmV3IFR5cGVFcnJvcihcIk5vdCBhIFRUWS5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBREJJTkQ6IEVycm9yID0gbmV3IFJlZmVyZW5jZUVycm9yKFwiQmFkIGJpbmRpbmdzLlwiKTtcclxuXHR9IC8vRXJyb3JzXHJcblx0XHJcblx0LyoqXHJcblx0ICogQ29udGFpbmVyIG9mIEFEVCBjb250cmFjdHMuXHJcblx0ICovXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBUeXBlcyB7XHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQW55dGhpbmcgdGhhdCBjYW4gYmUgc2VyaWFsaXplZCBhbmQgcGFyc2VkLlxyXG5cdFx0ICovXHJcblx0XHRleHBvcnQgaW50ZXJmYWNlIENvbnZlcnRhYmxlIHtcclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIENvbnZlcnQgQ29udmVydGFibGUgaW50byBhIHdyaXRhYmxlIEJ1ZmZlci5cclxuXHRcdFx0ICovXHJcblx0XHRcdHNlcmlhbGl6ZTogQnVmZmVyO1xyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogUmV0dXJucyBhIHN0cmluZyByZXByZXNlbnRhdGlvbiBvZiBhbiBvYmplY3QuXHJcblx0XHRcdCAqL1xyXG5cdFx0XHR0b1N0cmluZygpOiBzdHJpbmc7XHJcblx0XHR9IC8vQ29udmVydGFibGVcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiAnQ2xhc3MnIHR5cGUuXHJcblx0XHQgKi9cclxuXHRcdGV4cG9ydCB0eXBlIENsYXNzPFQ+ID0gbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVDtcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBJL08gYmluZGluZyB0eXBlLlxyXG5cdFx0ICovXHJcblx0XHRleHBvcnQgdHlwZSBJTyA9IHtcclxuXHRcdFx0aW5wdXQ6IE5vZGVKUy5SZWFkU3RyZWFtO1xyXG5cdFx0XHRvdXRwdXQ6IE5vZGVKUy5Xcml0ZVN0cmVhbTtcclxuXHRcdFx0ZXJyb3I/OiBOb2RlSlMuUmVhZFdyaXRlU3RyZWFtO1xyXG5cdFx0XHRfaW5wQ2I/OiAoZGF0YTogQnVmZmVyKSA9PiB2b2lkO1xyXG5cdFx0fTtcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiAnTWFwcGluZycgdHlwZS5cclxuXHRcdCAqL1xyXG5cdFx0ZXhwb3J0IHR5cGUgTWFwcGluZyA9ICh0ZXh0OiBzdHJpbmcpID0+IHN0cmluZztcclxuXHR9IC8vVHlwZXNcclxuXHRcclxuXHRleHBvcnQgbmFtZXNwYWNlIHV0aWwge1xyXG5cdFx0XHJcblx0XHRleHBvcnQgZnVuY3Rpb24gaWR4VG9DcmQoaWR4OiBudW1iZXIsIHN6OiBudW1iZXIpOiBbbnVtYmVyLCBudW1iZXJdIHtcclxuXHRcdFx0cmV0dXJuIFsgaWR4ICUgc3osIE1hdGguZmxvb3IoaWR4IC8gc3opIF07XHJcblx0XHR9IC8vaWR4VG9DcmRcclxuXHRcdGV4cG9ydCBmdW5jdGlvbiBjcmRUb0lkeChjcmQ6IFtudW1iZXIsIG51bWJlcl0sIHN6OiBudW1iZXIpOiBudW1iZXIge1xyXG5cdFx0XHRyZXR1cm4gY3JkWzFdICogc3ogKyBjcmRbMF07XHJcblx0XHR9IC8vY3JkVG9JZHhcclxuXHRcdFxyXG5cdH0gLy91dGlsXHJcblx0XHJcblx0XHJcblx0LyoqXHJcblx0ICogUmVzcG9uc2libGUgZm9yIHJlcHJlc2VudGluZyBDaHVua3MuXHJcblx0ICovXHJcblx0Y2xhc3MgUkdMVGlsZSBpbXBsZW1lbnRzIFR5cGVzLkNvbnZlcnRhYmxlIHtcclxuXHRcdFxyXG5cdFx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgdHJpbTogUmVnRXhwID0gL1xcdTAwMDAvZ2ltO1xyXG5cdFx0cHJpdmF0ZSBzdGF0aWMgX2lkY250cjogbnVtYmVyID0gMDtcclxuXHRcdHByb3RlY3RlZCBzdGF0aWMgZGVjb2RlcjogU3RyaW5nRGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKFwidXRmOFwiKTtcclxuXHRcdHN0YXRpYyBtYXBwaW5nc19jOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPjtcclxuXHRcdHN0YXRpYyBtYXBwaW5nc19iOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPjtcclxuXHRcdHN0YXRpYyBtYXBwaW5nc19zOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPjtcclxuXHRcdFxyXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaWQ6IG51bWJlciA9IFJHTFRpbGUuX2lkY250cisrO1xyXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHByZWNhbGM6IHN0cmluZyA9IFwiXCI7XHJcblx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgcmVzZXJ2ZWQ6IG51bWJlcjtcclxuXHRcdGNvb3JkczogW251bWJlciwgbnVtYmVyXSA9IFsgMCwgMCBdO1xyXG5cdFx0cGFyZW50PzogUmVhZG9ubHk8UkdMTWFwPjtcclxuXHRcdFxyXG5cdFx0XHJcblx0XHRwcm90ZWN0ZWQgY29uc3RydWN0b3IocHJvdGVjdGVkIHJlYWRvbmx5IG9yaWdpbjogUmVhZG9ubHk8QnVmZmVyPikge1xyXG5cdFx0XHRhc3NlcnQub2sob3JpZ2luLmxlbmd0aCA9PSA4LCBFcnJvcnMuRUJBREJVRik7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLm9yaWdpbiA9IEJ1ZmZlci5mcm9tKG9yaWdpbik7XHJcblx0XHRcdHRoaXMucHJlY2FsYyA9IChSR0xUaWxlLm1hcHBpbmdzX3MuZ2V0KG9yaWdpbls2XSkgfHwgKHQgPT4gdCkpKChSR0xUaWxlLm1hcHBpbmdzX2IuZ2V0KG9yaWdpbls1XSkgfHwgKHQgPT4gdCkpKChSR0xUaWxlLm1hcHBpbmdzX2MuZ2V0KG9yaWdpbls0XSkgfHwgKHQgPT4gdCkpKFJHTFRpbGUuZGVjb2Rlci53cml0ZShvcmlnaW4uc2xpY2UoMCwgNCkpLnJlcGxhY2UoUkdMVGlsZS50cmltLCAnJykpKSk7XHJcblx0XHRcdHRoaXMucmVzZXJ2ZWQgPSBvcmlnaW5bN107XHJcblx0XHR9IC8vY3RvclxyXG5cdFx0XHJcblx0XHRcclxuXHRcdHB1YmxpYyBnZXQgc2VyaWFsaXplKCk6IEJ1ZmZlciB7XHJcblx0XHRcdC8vZGVidWcoYFJHTFRpbGUuc2VyaWFsaXplYCk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gQnVmZmVyLmZyb20odGhpcy5vcmlnaW4pO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZVxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIFBhcnNlIGRhdGEgaW50byBhIENvbnZlcnRhYmxlLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7UmVhZG9ubHk8QnVmZmVyPn0gY2h1bmtcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBwYXJzZShjaHVuazogUmVhZG9ubHk8QnVmZmVyIHwgUkdMVGlsZT4sIHBhcmVudD86IFJlYWRvbmx5PFJHTE1hcD4pOiBSR0xUaWxlIHtcclxuXHRcdFx0Ly9kZWJ1ZyhgUkdMVGlsZS5wYXJzZWApO1xyXG5cdFx0XHRsZXQgcmV0OiBSR0xUaWxlO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKGNodW5rIGluc3RhbmNlb2YgUkdMVGlsZSkge1xyXG5cdFx0XHRcdHJldCA9IG5ldyBSR0xUaWxlKGNodW5rLm9yaWdpbik7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0cmV0LmNvb3JkcyA9IDxbbnVtYmVyLCBudW1iZXJdPkFycmF5LmZyb20oY2h1bmsuY29vcmRzKTtcclxuXHRcdFx0fSBlbHNlIHJldCA9IG5ldyBSR0xUaWxlKDxSZWFkb25seTxCdWZmZXI+PmNodW5rKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldC5wYXJlbnQgPSBwYXJlbnQ7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gcmV0O1xyXG5cdFx0fSAvL3BhcnNlXHJcblx0XHRcclxuXHRcdFxyXG5cdFx0cHVibGljIHRvU3RyaW5nKCk6IHN0cmluZyB7XHJcblx0XHRcdHJldHVybiB0aGlzLnByZWNhbGM7XHJcblx0XHR9IC8vdG9TdHJpbmdcclxuXHJcblx0XHRwdWJsaWMgW1N5bWJvbC50b1ByaW1pdGl2ZV0oaGludDogc3RyaW5nKSB7XHJcblx0XHRcdGlmIChoaW50ID09PSBcInN0cmluZ1wiKSByZXR1cm4gdGhpcy50b1N0cmluZygpO1xyXG5cdFx0XHRlbHNlIHJldHVybiB0aGlzO1xyXG5cdFx0fVxyXG5cdFx0XHJcblx0fSAvL1JHTFRpbGVcclxuXHRcclxuXHQvKipcclxuXHQgKiBSZXNwb25zaWJsZSBmb3IgcGFyc2luZyBhbmQgc3RyaXBwaW5nIENodW5rcy5cclxuXHQgKi9cclxuXHRjbGFzcyBSR0xNYXAgaW1wbGVtZW50cyBUeXBlcy5Db252ZXJ0YWJsZSB7XHJcblx0XHRcclxuXHRcdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BR0lDOiBCdWZmZXIgPSBCdWZmZXIuZnJvbShbMHgwMywgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pO1xyXG5cdFx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUkdMOiBCdWZmZXIgPSBCdWZmZXIuZnJvbShbMHg1MiwgMHg0NywgMHg0QywgMHgwMl0pO1xyXG5cdFx0cHJpdmF0ZSBzdGF0aWMgX2lkY250cjogbnVtYmVyID0gMDtcclxuXHRcdFxyXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaWQ6IG51bWJlciA9IFJHTE1hcC5faWRjbnRyKys7XHJcblx0XHRwcm90ZWN0ZWQgdHJhbnM6IFtudW1iZXIsIG51bWJlcl0gPSBbIDAsIDAgXTtcclxuXHRcdFxyXG5cdFx0XHJcblx0XHRwcm90ZWN0ZWQgY29uc3RydWN0b3IoXHJcblx0XHRcdHByb3RlY3RlZCByZXNlcnZlZDogQnVmZmVyID0gQnVmZmVyLmFsbG9jKDMsIDApLFxyXG5cdFx0XHRwcm90ZWN0ZWQgc2l6ZTogQnVmZmVyID0gQnVmZmVyLmFsbG9jKDIsIDApLFxyXG5cdFx0XHRwcm90ZWN0ZWQgdGlsZXM6IFJHTFRpbGVbXSA9IFsgXSxcclxuXHRcdFx0cHJvdGVjdGVkIHRyYWlsaW5nOiBCdWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUoMCksXHJcblx0XHRcdHByb3RlY3RlZCBfZnJvbUZpbGU6IHN0cmluZyA9IFwiXCJcclxuXHRcdCkge1xyXG5cdFx0XHR0aGlzLl9mcm9tRmlsZSA9IHBhdGgucmVzb2x2ZShwYXRoLm5vcm1hbGl6ZShfZnJvbUZpbGUpKTtcclxuXHRcdH0gLy9jdG9yXHJcblx0XHRcclxuXHRcdFxyXG5cdFx0cHVibGljIGdldCBzZXJpYWxpemUoKTogQnVmZmVyIHtcclxuXHRcdFx0ZGVidWcoYFJHTE1hcC5zZXJpYWxpemVgKTtcclxuXHRcdFx0XHJcblx0XHRcdGxldCByZXQ6IEJ1ZmZlciA9IEJ1ZmZlci5jb25jYXQoW3RoaXMucmVzZXJ2ZWQsIFJHTE1hcC5SR0wsIHRoaXMuc2l6ZV0pO1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5fc29ydFRpbGVzKCk7XHJcblx0XHRcdFxyXG5cdFx0XHRmb3IgKGNvbnN0IHRpbGUgb2YgdGhpcy50aWxlcykgcmV0ID0gQnVmZmVyLmNvbmNhdChbIHJldCwgdGlsZS5zZXJpYWxpemUgXSk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gQnVmZmVyLmNvbmNhdChbIHJldCwgUkdMTWFwLk1BR0lDLCB0aGlzLnRyYWlsaW5nIF0pO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZVxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdG9yZSBDb252ZXJ0YWJsZSBpbnRvIGEgd3JpdGFibGUgJ2ZpbGUnLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBmaWxlIC0gVGFyZ2V0IGZpbGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIGFzeW5jIHNlcmlhbGl6ZUZpbGUoZmlsZTogUmVhZG9ubHk8c3RyaW5nPiA9IHRoaXMuX2Zyb21GaWxlKTogUHJvbWlzZTxCdWZmZXI+IHtcclxuXHRcdFx0ZGVidWcoYFJHTE1hcC5zZXJpYWxpemVGaWxlOiAke2ZpbGV9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgZGF0YTogQnVmZmVyO1xyXG5cdFx0XHRcclxuXHRcdFx0YXdhaXQgZnMub3V0cHV0RmlsZShmaWxlLCBkYXRhID0gdGhpcy5zZXJpYWxpemUsIHtcclxuXHRcdFx0XHRtb2RlOiAwbzc1MSxcclxuXHRcdFx0XHRlbmNvZGluZzogXCJiaW5hcnlcIixcclxuXHRcdFx0XHRmbGFnOiBcIndcIlxyXG5cdFx0XHR9KTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBkYXRhO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZUZpbGVcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBkYXRhIGludG8gYSBDb252ZXJ0YWJsZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1JlYWRvbmx5PEJ1ZmZlcj59IGNodW5rXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgcGFyc2UoZGF0YTogUmVhZG9ubHk8QnVmZmVyPik6IFJHTE1hcCB7XHJcblx0XHRcdGRlYnVnKGBSR0xNYXAucGFyc2VgKTtcclxuXHRcdFx0XHJcblx0XHRcdGFzc2VydC5vayhCdWZmZXIuaXNCdWZmZXIoZGF0YSksIEVycm9ycy5FTk9CVUYpO1xyXG5cdFx0XHRhc3NlcnQub2soQnVmZmVyLmlzRW5jb2RpbmcoXCJiaW5hcnlcIiksIEVycm9ycy5FTk9CSU4pO1xyXG5cdFx0XHRhc3NlcnQub2soZGF0YS5sZW5ndGggPj0gOSwgRXJyb3JzLkVCQURCVUYpO1xyXG5cdFx0XHRcclxuXHRcdFx0Y29uc3QgbWFwOiBSR0xNYXAgPSBuZXcgUkdMTWFwKGRhdGEuc2xpY2UoMCwgMyksIGRhdGEuc2xpY2UoNywgOSkpO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IGlkeDogbnVtYmVyID0gOSxcclxuXHRcdFx0XHRjbnRyOiBudW1iZXIgPSAwO1xyXG5cdFx0XHRcclxuXHRcdFx0d2hpbGUgKGlkeCA8IGRhdGEubGVuZ3RoICYmICFkYXRhLnNsaWNlKGlkeCwgaWR4ICsgNSkuZXF1YWxzKFJHTE1hcC5NQUdJQykpIHtcclxuXHRcdFx0XHRsZXQgdGlsZTogUkdMVGlsZTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRtYXAudGlsZXMucHVzaCh0aWxlID0gUkdMVGlsZS5wYXJzZShkYXRhLnNsaWNlKGlkeCwgaWR4ICs9IDgpKSk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0dGlsZS5wYXJlbnQgPSBtYXA7XHJcblx0XHRcdFx0dGlsZS5jb29yZHMgPSBbIGNudHIgJSBtYXAuc2l6ZVswXSwgTWF0aC5mbG9vcihjbnRyIC8gbWFwLnNpemVbMF0pIF07XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdGlmIChpZHggIT0gZGF0YS5sZW5ndGgpIHtcclxuXHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2U6IGhhcyB0cmFpbGluZ2ApO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdG1hcC50cmFpbGluZyA9IGRhdGEuc2xpY2UoaWR4ICsgNSk7XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBtYXA7XHJcblx0XHR9IC8vcGFyc2VcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVhZCBCdWZmZXIgZnJvbSAnZmlsZScuXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSBmaWxlIC0gVGFyZ2V0IGZpbGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBhc3luYyBwYXJzZUZpbGUoZmlsZTogUmVhZG9ubHk8c3RyaW5nPik6IFByb21pc2U8UkdMTWFwPiB7XHJcblx0XHRcdGRlYnVnKGBSR0xNYXAucGFyc2VGaWxlOiAke2ZpbGV9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlcywgcmVqKSA9PiB7XHJcblx0XHRcdFx0ZGVidWdfdihgUkdMTWFwLnBhcnNlRmlsZTogQUNDRVNTYCk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0ZnMuYWNjZXNzKGZpbGUsIGZzLmNvbnN0YW50cy5GX09LIHwgZnMuY29uc3RhbnRzLlJfT0ssIGVyciA9PiB7XHJcblx0XHRcdFx0XHRpZiAoZXJyKSB7XHJcblx0XHRcdFx0XHRcdGRlYnVnX2UoYFJHTE1hcC5wYXJzZUZpbGU6ICR7ZmlsZX0gLT4gRUFDQ0VTU2ApO1xyXG5cdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2VGaWxlOiBSU1RSRUFNYCk7XHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRjb25zdCBzdHI6IGZzLlJlYWRTdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGUsIHtcclxuXHRcdFx0XHRcdFx0XHRmbGFnczogXCJyXCIsXHJcblx0XHRcdFx0XHRcdFx0ZW5jb2Rpbmc6IFwiYmluYXJ5XCIsXHJcblx0XHRcdFx0XHRcdFx0bW9kZTogZnMuY29uc3RhbnRzLlNfSVJVU1IgfCBmcy5jb25zdGFudHMuU19JWEdSUCxcclxuXHRcdFx0XHRcdFx0XHRlbWl0Q2xvc2U6IHRydWVcclxuXHRcdFx0XHRcdFx0fSlcclxuXHRcdFx0XHRcdFx0Lm9uY2UoXCJyZWFkYWJsZVwiLCBhc3luYyAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0ZGVidWdfdihgUkdMTWFwLnBhcnNlRmlsZTogJHtmaWxlfSAtPiBSZWFkYWJsZWApO1xyXG5cdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdGxldCBkYXRhOiBzdHJpbmcgPSAnJztcclxuXHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRzdHIuc2V0RW5jb2RpbmcoXCJiaW5hcnlcIik7XHJcblx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0Zm9yIGF3YWl0IChsZXQgY2h1bmsgb2Ygc3RyKSBkYXRhICs9IGNodW5rO1xyXG5cdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdHN0ci5vbmNlKFwiY2xvc2VcIiwgKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgbWFwOiBSR0xNYXAgPSBSR0xNYXAucGFyc2UoQnVmZmVyLmZyb20oZGF0YSwgXCJiaW5hcnlcIikpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0XHRtYXAuX2Zyb21GaWxlID0gZmlsZTtcclxuXHRcdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdFx0cmVzKG1hcCk7XHJcblx0XHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0gLy9wYXJzZUZpbGVcclxuXHRcdFxyXG5cdFx0cHJvdGVjdGVkIF9zb3J0VGlsZXModGlsZXM6IFJHTFRpbGVbXSA9IHRoaXMudGlsZXMpOiB2b2lkIHtcclxuXHRcdFx0dGlsZXMuc29ydCgoYTogUmVhZG9ubHk8UkdMVGlsZT4sIGI6IFJlYWRvbmx5PFJHTFRpbGU+KTogbnVtYmVyID0+IHV0aWwuY3JkVG9JZHgoYS5jb29yZHMsIHRoaXMuc2l6ZVswXSkgLSB1dGlsLmNyZFRvSWR4KGIuY29vcmRzLCB0aGlzLnNpemVbMF0pKTtcclxuXHRcdH0gLy9fc29ydFRpbGVzXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgdmFsaWRpdHkgb2YgdGlsZSdzIGNvb3Jkcy5cclxuXHRcdCAqL1xyXG5cdFx0Y2hlY2tWYWxpZGl0eT8oKTogYm9vbGVhbiB7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fSAvL2NoZWNrVmFsaWRpdHlcclxuXHRcdFxyXG5cdFx0XHJcblx0XHRwdWJsaWMgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMudGlsZXMubWFwKCh0aWxlOiBSR0xUaWxlKTogc3RyaW5nID0+IHRpbGUudG9TdHJpbmcoKSkuam9pbignJyk7XHJcblx0XHR9IC8vdG9TdHJpbmdcclxuXHRcdFxyXG5cdFx0cHVibGljIFtTeW1ib2wudG9QcmltaXRpdmVdKGhpbnQ6IHN0cmluZykge1xyXG5cdFx0XHRpZiAoaGludCA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIHRoaXMudG9TdHJpbmcoKTtcclxuXHRcdFx0ZWxzZSByZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHRcdFxyXG5cdH0gLy9SR0xNYXBcclxuXHRcclxuXHQvKipcclxuXHQgKiBSZXNwb25zaWJsZSBmb3IgY29udHJvbGxpbmcgdHJhbnNpdGlvbnMgYW5kIHNldHRpbmdzLlxyXG5cdCAqIFxyXG5cdCAqIFRPRE86IEFkZCBjb250cm9scy5cclxuXHQgKi9cclxuXHRleHBvcnQgY2xhc3MgUkdMIGV4dGVuZHMgZXZlbnQuRXZlbnRFbWl0dGVyIHtcclxuXHRcdFxyXG5cdFx0cHJvdGVjdGVkIHN0YXRpYyBtYXBwaW5nc19zOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPiA9IG5ldyBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPihfbWFwcGluZ3Nfcyk7XHJcblx0XHRcclxuXHRcdHByb3RlY3RlZCBzZWN1cmVTd2l0Y2g6IGJvb2xlYW4gPSB0cnVlOyAgLyogVW5iaW5kIENUUkwtQyAqL1xyXG5cdFx0cHJvdGVjdGVkIGJpbmRzOiBUeXBlcy5JTyB8IG51bGwgPSBudWxsO1xyXG5cdFx0XHJcblx0XHRcclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3RvcihcclxuXHRcdFx0YXV0b2NvbmZpZzogYm9vbGVhbiA9IHRydWUsXHJcblx0XHRcdHByb3RlY3RlZCBtYXBwaW5nc19jOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPiA9IF9tYXBwaW5nc19jLFxyXG5cdFx0XHRwcm90ZWN0ZWQgbWFwcGluZ3NfYjogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4gPSBfbWFwcGluZ3NfYixcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9NYXA6IHR5cGVvZiBSR0xNYXAgPSBSR0xNYXAsXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBfVGlsZTogdHlwZW9mIFJHTFRpbGUgPSBSR0xUaWxlXHJcblx0XHQpIHtcclxuXHRcdFx0c3VwZXIoKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmICghUkdMLnN1cHBvcnRzQ29sb3JzKSBjb25zb2xlLndhcm4oXCJUZXJtaW5hbCBjb2xvcnMgYXJlIG5vdCBzdXBwb3J0ZWQhXCIpO1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5tYXBwaW5nc19jID0gbmV3IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+KG1hcHBpbmdzX2MpO1xyXG5cdFx0XHR0aGlzLm1hcHBpbmdzX2IgPSBuZXcgTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4obWFwcGluZ3NfYik7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoYXV0b2NvbmZpZykge1xyXG5cdFx0XHRcdFByb21pc2UuYWxsKFtcclxuXHRcdFx0XHRcdHRoaXMubG9hZE1hcHBpbmdzX2MoKSxcclxuXHRcdFx0XHRcdHRoaXMubG9hZE1hcHBpbmdzX2IoKVxyXG5cdFx0XHRcdF0pLmNhdGNoKCgpID0+IGRlYnVnX2UoXCJSR0wuYXV0b2NvbmY6IEVNQVBQSU5HXCIpKS50aGVuKCgpID0+IHtcclxuXHRcdFx0XHRcdHRoaXMuX1RpbGUubWFwcGluZ3NfYyA9IHRoaXMubWFwcGluZ3NfYztcclxuXHRcdFx0XHRcdHRoaXMuX1RpbGUubWFwcGluZ3NfYiA9IHRoaXMubWFwcGluZ3NfYjtcclxuXHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0ZGVidWcoXCJSR0wuY3RvciBkZWZmZXJlZCBtYXBwaW5ncy5cIik7XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0dGhpcy5iaW5kKCk7XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdHRoaXMuX1RpbGUubWFwcGluZ3NfYyA9IHRoaXMubWFwcGluZ3NfYztcclxuXHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19iID0gdGhpcy5tYXBwaW5nc19iO1xyXG5cdFx0XHR0aGlzLl9UaWxlLm1hcHBpbmdzX3MgPSBSR0wubWFwcGluZ3NfcztcclxuXHRcdH0gLy9jdG9yXHJcblx0XHRcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBXaGV0aGVyIHRoZSBUVFkgc3VwcG9ydHMgYmFzaWMgY29sb3JzLlxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGdldCBzdXBwb3J0c0NvbG9ycygpOiBib29sZWFuIHtcclxuXHRcdFx0cmV0dXJuICEhY2hhbGsubGV2ZWw7XHJcblx0XHR9IC8vc3VwcG9ydHNDb2xvcnNcclxuXHRcdFxyXG5cdFx0cHVibGljIGFzeW5jIGxvYWRNYXBwaW5nc19jKHBhdGg/OiBSZWFkb25seTxzdHJpbmc+KTogUHJvbWlzZTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj47XHJcblx0XHRwdWJsaWMgbG9hZE1hcHBpbmdzX2MobWFwPzogUmVhZG9ubHk8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+KTogUHJvbWlzZTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj47XHJcblx0XHRwdWJsaWMgbG9hZE1hcHBpbmdzX2MobWFwOiBSZWFkb25seTxzdHJpbmcgfCBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4gPSBcIlJHTE1hcHBpbmdzX2MuanNcIik6IFByb21pc2U8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+IHtcclxuXHRcdFx0dGhpcy5lbWl0KFwiX2xvYWRDb2xvcnNcIiwgbWFwKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBSR0wubG9hZE1hcHBpbmdzKG1hcCwgdGhpcy5tYXBwaW5nc19jKTtcclxuXHRcdH0gLy9sb2FkTWFwcGluZ3NfY1xyXG5cdFx0XHJcblx0XHRwdWJsaWMgYXN5bmMgbG9hZE1hcHBpbmdzX2IocGF0aD86IFJlYWRvbmx5PHN0cmluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYihtYXA/OiBSZWFkb25seTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYihtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PiA9IFwiUkdMTWFwcGluZ3NfYi5qc1wiKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4ge1xyXG5cdFx0XHR0aGlzLmVtaXQoXCJfbG9hZEJhY2tncm91bmRcIiwgbWFwKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBSR0wubG9hZE1hcHBpbmdzKG1hcCwgdGhpcy5tYXBwaW5nc19iKTtcclxuXHRcdH0gLy9sb2FkTWFwcGluZ3NfY1xyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIEluY2x1ZGUgY3VzdG9tIG1hcHBpbmdzLlxyXG5cdFx0ICogXHJcblx0XHQgKiBAcGFyYW0gbWFwIC0gTG9hZCBuZXcgbWFwcGluZ3NcclxuXHRcdCAqIEBwYXJhbSBvcmlnIC0gTWFwcGluZ3MgdG8gb3ZlcnJpZGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBhc3luYyBsb2FkTWFwcGluZ3MobWFwOiBSZWFkb25seTxzdHJpbmcgfCBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4sIG9yaWc6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+KTogUHJvbWlzZTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4ge1xyXG5cdFx0XHRkZWJ1ZyhcIlJHTC5sb2FkTWFwcGluZ3M6XCIsIGluc3BlY3Qob3JpZywgeyBicmVha0xlbmd0aDogSW5maW5pdHkgfSkpO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKHR5cGVvZiBtYXAgPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRkZWxldGUgcmVxdWlyZS5jYWNoZVtyZXF1aXJlLnJlc29sdmUobWFwKV07XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Y29uc3QgZGF0YTogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4gPSByZXF1aXJlKG1hcCk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0Zm9yIChsZXQgc2lnIG9mIGRhdGEpIG9yaWcuc2V0KHNpZ1swXSwgc2lnWzFdKTtcclxuXHRcdFx0fSBlbHNlIGlmIChtYXAgaW5zdGFuY2VvZiBNYXApIHtcclxuXHRcdFx0XHRmb3IgKGxldCBzaWcgb2YgbWFwKSBvcmlnLnNldChzaWdbMF0sIHNpZ1sxXSk7XHJcblx0XHRcdH0gZWxzZSB0aHJvdyBFcnJvcnMuRUJBRFRQWUU7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gb3JpZztcclxuXHRcdH0gLy9sb2FkTWFwcGluZ3NcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBCaW5kIHRoZSBSR0wgZW5naW5lIHRvIEkvTy5cclxuXHRcdCAqIFxyXG5cdFx0ICogQHBhcmFtIGlucCAtIFRoZSB0YXJnZXQgdXNlci1pbnB1dCBzdHJlYW0gdG8gYmluZCwgbXVzdCBiZSBhIFRUWVxyXG5cdFx0ICogQHBhcmFtIG91dCAtIFRoZSB0YXJnZXQgdXNlci1pbnB1dCBzdHJlYW0gdG8gYmluZCwgbXVzdCBiZSBhIFRUWVxyXG5cdFx0ICovXHJcblx0XHRiaW5kKGlucDogdHR5LlJlYWRTdHJlYW0gPSAodGhpcy5iaW5kcyA/IHRoaXMuYmluZHMuaW5wdXQgOiBwcm9jZXNzLnN0ZGluKSB8fCBwcm9jZXNzLnN0ZGluLCBvdXQ6IHR0eS5Xcml0ZVN0cmVhbSA9ICh0aGlzLmJpbmRzID8gdGhpcy5iaW5kcy5vdXRwdXQgOiBwcm9jZXNzLnN0ZG91dCkgfHwgcHJvY2Vzcy5zdGRvdXQsIGVycjogTm9kZUpTLlJlYWRXcml0ZVN0cmVhbSA9ICh0aGlzLmJpbmRzID8gdGhpcy5iaW5kcy5lcnJvciA6IHByb2Nlc3Muc3RkZXJyKSB8fCBwcm9jZXNzLnN0ZGVycik6IHRoaXMge1xyXG5cdFx0XHRkZWJ1ZyhgUkdMLmJpbmQ6ICR7dGhpcy5iaW5kc31gKTtcclxuXHRcdFx0XHJcblx0XHRcdGFzc2VydC5vayhpbnAuaXNUVFkgJiYgb3V0LmlzVFRZLCBFcnJvcnMuRU5PVFRZKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmICghIXRoaXMuYmluZHMgJiYgISF0aGlzLmJpbmRzIS5pbnB1dCkge1xyXG5cdFx0XHRcdGRlYnVnKGBSR0wuYmluZDogdW5ib3VuZGApO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdHRoaXMuYmluZHMhLmlucHV0LnNldFJhd01vZGUoZmFsc2UpO1xyXG5cdFx0XHRcdGlmICghIXRoaXMuYmluZHMhLl9pbnBDYikgdGhpcy5iaW5kcyEuaW5wdXQucmVtb3ZlTGlzdGVuZXIoXCJkYXRhXCIsIHRoaXMuYmluZHMhLl9pbnBDYik7XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdHRoaXMuYmluZHMgPSA8VHlwZXMuSU8+e1xyXG5cdFx0XHRcdGlucHV0OiBpbnAsXHJcblx0XHRcdFx0b3V0cHV0OiBvdXQsXHJcblx0XHRcdFx0ZXJyb3I6IGVyclxyXG5cdFx0XHR9O1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5iaW5kcyEuaW5wdXQuc2V0UmF3TW9kZSh0cnVlKTtcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMuYmluZHMhLmlucHV0Lm9uKFwiZGF0YVwiLCB0aGlzLmJpbmRzIS5faW5wQ2IgPSBkYXRhID0+IHtcclxuXHRcdFx0XHR0aGlzLmVtaXQoXCJyYXdrZXlcIiwgZGF0YSk7XHJcblx0XHRcdFx0dGhpcy5lbWl0KFwia2V5XCIsIGRhdGEudG9TdHJpbmcoKSk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0aWYgKHRoaXMuc2VjdXJlU3dpdGNoICYmIGRhdGEudG9TdHJpbmcoKSA9PT0gJ1xcdTAwMDMnKSB7XHJcblx0XHRcdFx0XHR0aGlzLmVtaXQoXCJfZXhpdFwiKTtcclxuXHRcdFx0XHRcdHByb2Nlc3MuZXhpdCgpO1xyXG5cdFx0XHRcdH1cclxuXHRcdFx0fSk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH0gLy9iaW5kXHJcblx0XHRcclxuXHRcdHVuYmluZCgpOiB0aGlzIHtcclxuXHRcdFx0ZGVidWcoYFJHTC51bmJpbmQ6ICR7dGhpcy5iaW5kc31gKTtcclxuXHRcdFx0XHJcblx0XHRcdGFzc2VydC5vayh0aGlzLmJpbmRzICYmIHRoaXMuYmluZHMuaW5wdXQuaXNUVFkgJiYgdGhpcy5iaW5kcy5vdXRwdXQuaXNUVFksIEVycm9ycy5FQkFEQklORCk7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmJpbmRzIS5pbnB1dC5zZXRSYXdNb2RlKGZhbHNlKTtcclxuXHRcdFx0aWYgKCEhdGhpcy5iaW5kcyEuX2lucENiKSB0aGlzLmJpbmRzIS5pbnB1dC5yZW1vdmVMaXN0ZW5lcihcImRhdGFcIiwgdGhpcy5iaW5kcyEuX2lucENiKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiB0aGlzO1xyXG5cdFx0fSAvL3VuYmluZFxyXG5cdFx0XHJcblx0XHRlbWl0KGV2ZW50OiBcImtleVwiLCBkYXRhOiBzdHJpbmcpOiBib29sZWFuO1xyXG5cdFx0ZW1pdChldmVudDogXCJyYXdrZXlcIiwgZGF0YTogQnVmZmVyKTogYm9vbGVhbjtcclxuXHRcdGVtaXQoZXZlbnQ6IFwiX2V4aXRcIik6IGJvb2xlYW47XHJcblx0XHRlbWl0KGV2ZW50OiBcIl9sb2FkQmFja2dyb3VuZFwiLCBkYXRhOiBzdHJpbmcgfCBSZWFkb25seTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4pOiBib29sZWFuO1xyXG5cdFx0ZW1pdChldmVudDogXCJfbG9hZENvbG9yc1wiLCBkYXRhOiBzdHJpbmcgfCBSZWFkb25seTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4pOiBib29sZWFuO1xyXG5cdFx0ZW1pdChldmVudDogc3RyaW5nIHwgc3ltYm9sLCAuLi5hcmdzOiBhbnlbXSk6IGJvb2xlYW47XHJcblx0XHRlbWl0KGV2ZW50OiBzdHJpbmcgfCBzeW1ib2wsIC4uLmFyZ3M6IGFueVtdKTogYm9vbGVhbiB7XHJcblx0XHRcdHJldHVybiBzdXBlci5lbWl0KGV2ZW50LCAuLi5hcmdzKTtcclxuXHRcdH0gLy9lbWl0XHJcblx0XHRcclxuXHRcdHB1YmxpYyBvbihldmVudDogXCJrZXlcIiwgbGlzdGVuZXI6IChkYXRhOiBzdHJpbmcpID0+IHZvaWQpOiB0aGlzO1xyXG5cdFx0cHVibGljIG9uKGV2ZW50OiBcInJhd2tleVwiLCBsaXN0ZW5lcjogKGRhdGE6IEJ1ZmZlcikgPT4gdm9pZCk6IHRoaXM7XHJcblx0XHRwdWJsaWMgb24oZXZlbnQ6IFwiX2V4aXRcIiwgbGlzdGVuZXI6ICgpID0+IHZvaWQpOiB0aGlzO1xyXG5cdFx0cHVibGljIG9uKGV2ZW50OiBcIl9sb2FkQmFja2dyb3VuZFwiLCBsaXN0ZW5lcjogKGRhdGE6IHN0cmluZyB8IFJlYWRvbmx5PE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PikgPT4gdm9pZCk6IHRoaXM7XHJcblx0XHRwdWJsaWMgb24oZXZlbnQ6IFwiX2xvYWRDb2xvcnNcIiwgbGlzdGVuZXI6IChkYXRhOiBzdHJpbmcgfCBSZWFkb25seTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4pID0+IHZvaWQpOiB0aGlzO1xyXG5cdFx0cHVibGljIG9uKGV2ZW50OiBzdHJpbmcgfCBzeW1ib2wsIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpOiB0aGlzO1xyXG5cdFx0cHVibGljIG9uKGV2ZW50OiBzdHJpbmcgfCBzeW1ib2wsIGxpc3RlbmVyOiAoLi4uYXJnczogYW55W10pID0+IHZvaWQpOiB0aGlzIHtcclxuXHRcdFx0cmV0dXJuIHN1cGVyLm9uKGV2ZW50LCBsaXN0ZW5lcik7XHJcblx0XHR9IC8vb25cclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdGFydCBhbiBpbnN0YW5jZSBvZiBSR0wuXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSB7YW55W119IHBhcmFtcyAtIE9wdGlvbnMgcGFzc2VkIHRvIGNvbnN0cnVjdG9yXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgY3JlYXRlKC4uLnBhcmFtczogUmVhZG9ubHlBcnJheTxhbnk+KTogUkdMIHtcclxuXHRcdFx0ZGVidWcoYFJHTC5jcmVhdGVgKTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBuZXcgUkdMKC4uLnBhcmFtcyk7XHJcblx0XHR9IC8vY3JlYXRlXHJcblx0XHRcclxuXHR9IC8vUkdMXHJcblx0XHJcbn0gLy9yZ2xcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHJnbDtcclxuIl19