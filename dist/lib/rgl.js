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
        Errors.EBADPARAM = new assert.AssertionError({ message: "Bad parameters size", actual: 1, expected: 2 });
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
            this.precalc = (RGLTile.mappings_s.get(origin[6]) ?? (t => t))((RGLTile.mappings_b.get(origin[5]) ?? (t => t))((RGLTile.mappings_c.get(origin[4]) ?? (t => t))(RGLTile.decoder.write(origin.slice(0, 4)).replace(RGLTile.trim, ''))));
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
        constructor(reserved = Buffer.alloc(3, 0), size = Buffer.alloc(2, 0), tiles = [], trailing = Buffer.allocUnsafe(0), _fromFile = "", trans = [0, 0]) {
            this.reserved = reserved;
            this.size = size;
            this.tiles = tiles;
            this.trailing = trailing;
            this._fromFile = _fromFile;
            this.trans = trans;
            this._id = RGLMap._idcntr++;
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
     * Responsible for controlling assets and transitions.
     */
    class RGLGround {
        constructor(maplist = new Map(), foreground = null, viewport = [0, 0]) {
            this.maplist = maplist;
            this.foreground = foreground;
            this.viewport = viewport;
        } //ctor
        /**
         * Sets the foreground or retrieves.
         */
        focus(fg) {
            if (!!fg) {
                if (typeof fg === "string")
                    this.foreground = this.maplist.get(fg);
                else
                    this.foreground = fg;
            }
            return this.foreground;
        } //focus
        /**
         * Add or retrieve a map.
         */
        map(name, mp) {
            if (!!mp)
                this.maplist.set(name, mp);
            else if (!!name)
                assert.fail(Errors.EBADPARAM);
            return this.maplist.entries();
        } //map
    } //RGLGround
    rgl.RGLGround = RGLGround;
    /**
     * Responsible for controlling events and settings.
     */
    class RGL extends event.EventEmitter {
        constructor(autoconfig = true, secureSwitch = true, /* Unbind CTRL-C */ mappings_c = _mappings_c, mappings_b = _mappings_b, _Map = RGLMap, _Tile = RGLTile, ground = new RGLGround()) {
            super();
            this.secureSwitch = secureSwitch;
            this.mappings_c = mappings_c;
            this.mappings_b = mappings_b;
            this._Map = _Map;
            this._Tile = _Tile;
            this.ground = ground;
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
                let data;
                delete require.cache[require.resolve(map)];
                try {
                    data = require(map);
                }
                catch (e) {
                    data = new Map([]);
                }
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
        bind(inp = (this.binds ? this.binds.input : process.stdin) ?? process.stdin, out = (this.binds ? this.binds.output : process.stdout) ?? process.stdout, err = (this.binds ? this.binds.error : process.stderr) ?? process.stderr) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmdsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3JnbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUgsWUFBWSxDQUFDOzs7O0FBRWIscURBQStCO0FBQy9CLHVEQUFpQztBQUNqQyxtREFBNkI7QUFFN0Isc0RBQWdDO0FBQ2hDLCtCQUF5QztBQUN6QyxtREFBK0M7QUFDL0MsMERBQTBCO0FBRTFCLE1BQU0sS0FBSyxHQUFHLGVBQVEsQ0FBQyxLQUFLLENBQUMsRUFDNUIsT0FBTyxHQUFHLGVBQVEsQ0FBQyxNQUFNLENBQUMsRUFDMUIsT0FBTyxHQUFHLGVBQVEsQ0FBQyxNQUFNLENBQUMsRUFDMUIsTUFBTSxHQUFlLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQztBQUVoQyxJQUFjLEdBQUcsQ0E0Z0JoQjtBQTVnQkQsV0FBYyxHQUFHO0lBQ2hCLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUdyQixNQUFNLFdBQVcsR0FBK0IsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxFQUMvRyxXQUFXLEdBQStCLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUMsRUFDMUcsV0FBVyxHQUErQixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7SUFHNUc7O09BRUc7SUFDSCxJQUFpQixNQUFNLENBUXRCO0lBUkQsV0FBaUIsTUFBTTtRQUNULGFBQU0sR0FBVSxJQUFJLFNBQVMsQ0FBQyx1QkFBdUIsQ0FBQyxDQUFDO1FBQ3ZELGFBQU0sR0FBVSxJQUFJLFNBQVMsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUMvQyxjQUFPLEdBQVUsSUFB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b250ZW50IjpbIi8qKlxyXG4gKiBAYXV0aG9yIFYuIEguXHJcbiAqIEBmaWxlIHJnbC50c1xyXG4gKiBAc2luY2UgMjAyMFxyXG4gKi9cclxuXHJcblwidXNlIHN0cmljdFwiO1xyXG5cclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzLWV4dHJhXCI7XHJcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tIFwiYXNzZXJ0XCI7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0ICogYXMgdHR5IGZyb20gXCJ0dHlcIjtcclxuaW1wb3J0ICogYXMgZXZlbnQgZnJvbSBcImV2ZW50c1wiO1xyXG5pbXBvcnQgeyBpbnNwZWN0LCBkZWJ1Z2xvZyB9IGZyb20gXCJ1dGlsXCI7XHJcbmltcG9ydCB7IFN0cmluZ0RlY29kZXIgfSBmcm9tIFwic3RyaW5nX2RlY29kZXJcIjtcclxuaW1wb3J0IGNoYWxrIGZyb20gXCJjaGFsa1wiO1xyXG5cclxuY29uc3QgZGVidWcgPSBkZWJ1Z2xvZyhcIlJHTFwiKSxcclxuXHRkZWJ1Z192ID0gZGVidWdsb2coXCJSR0x2XCIpLFxyXG5cdGRlYnVnX2UgPSBkZWJ1Z2xvZyhcIlJHTGVcIiksXHJcblx0dm9pZGZuOiAoKSA9PiB2b2lkID0gKCkgPT4geyB9O1xyXG5cclxuZXhwb3J0IG1vZHVsZSByZ2wge1xyXG5cdGRlYnVnKFwicmdsIGxvYWRlZC5cIik7XHJcblx0XHJcblx0XHJcblx0Y29uc3QgX21hcHBpbmdzX2M6IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+ID0gcmVxdWlyZShwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uXCIsIFwiLi5cIiwgXCJSR0xNYXBwaW5nc19jLmpzXCIpKSxcclxuXHRcdF9tYXBwaW5nc19iOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPiA9IHJlcXVpcmUocGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLlwiLCBcIi4uXCIsIFwiUkdMTWFwcGluZ3NfYi5qc1wiKSksXHJcblx0XHRfbWFwcGluZ3NfczogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4gPSByZXF1aXJlKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi5cIiwgXCIuLlwiLCBcIlJHTE1hcHBpbmdzX3MuanNcIikpO1xyXG5cdFxyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIENvbnRhaW5lciBvZiBFcnJvcnMuXHJcblx0ICovXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBFcnJvcnMge1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVOT0JJTjogRXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQnVmZmVyIGlzIG5vdCBiaW5hcnkuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVOT0JVRjogRXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiTm90IGEgQnVmZmVyLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEQlVGOiBFcnJvciA9IG5ldyBSYW5nZUVycm9yKFwiQmFkIGRhdGEsIFdyb25nIHNpemUgb3IgZm9ybWF0LlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEVFBZRTogRXJyb3IgPSBuZXcgVHlwZUVycm9yKFwiQmFkIHBhcmFtZXRlciB0eXBlLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFTk9UVFk6IEVycm9yID0gbmV3IFR5cGVFcnJvcihcIk5vdCBhIFRUWS5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBREJJTkQ6IEVycm9yID0gbmV3IFJlZmVyZW5jZUVycm9yKFwiQmFkIGJpbmRpbmdzLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEUEFSQU06IEVycm9yID0gbmV3IGFzc2VydC5Bc3NlcnRpb25FcnJvcih7IG1lc3NhZ2U6IFwiQmFkIHBhcmFtZXRlcnMgc2l6ZVwiLCBhY3R1YWw6IDEsIGV4cGVjdGVkOiAyIH0pO1xyXG5cdH0gLy9FcnJvcnNcclxuXHRcclxuXHQvKipcclxuXHQgKiBDb250YWluZXIgb2YgQURUIGNvbnRyYWN0cy5cclxuXHQgKi9cclxuXHRleHBvcnQgbmFtZXNwYWNlIFR5cGVzIHtcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbnl0aGluZyB0aGF0IGNhbiBiZSBzZXJpYWxpemVkIGFuZCBwYXJzZWQuXHJcblx0XHQgKi9cclxuXHRcdGV4cG9ydCBpbnRlcmZhY2UgQ29udmVydGFibGUge1xyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogQ29udmVydCBDb252ZXJ0YWJsZSBpbnRvIGEgd3JpdGFibGUgQnVmZmVyLlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0c2VyaWFsaXplOiBCdWZmZXI7XHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBSZXR1cm5zIGEgc3RyaW5nIHJlcHJlc2VudGF0aW9uIG9mIGFuIG9iamVjdC5cclxuXHRcdFx0ICovXHJcblx0XHRcdHRvU3RyaW5nKCk6IHN0cmluZztcclxuXHRcdH0gLy9Db252ZXJ0YWJsZVxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqICdDbGFzcycgdHlwZS5cclxuXHRcdCAqL1xyXG5cdFx0ZXhwb3J0IHR5cGUgQ2xhc3M8VD4gPSBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUO1xyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIE51bGxhYmxlIHR5cGUuXHJcblx0XHQgKi9cclxuXHRcdGV4cG9ydCB0eXBlIE51bGxhYmxlPFQ+ID0gVCB8IG51bGwgfCB1bmRlZmluZWQ7XHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogSS9PIGJpbmRpbmcgdHlwZS5cclxuXHRcdCAqL1xyXG5cdFx0ZXhwb3J0IHR5cGUgSU8gPSB7XHJcblx0XHRcdGlucHV0OiBOb2RlSlMuUmVhZFN0cmVhbTtcclxuXHRcdFx0b3V0cHV0OiBOb2RlSlMuV3JpdGVTdHJlYW07XHJcblx0XHRcdGVycm9yPzogTm9kZUpTLlJlYWRXcml0ZVN0cmVhbTtcclxuXHRcdFx0X2lucENiPzogKGRhdGE6IEJ1ZmZlcikgPT4gdm9pZDtcclxuXHRcdH07XHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogJ01hcHBpbmcnIHR5cGUuXHJcblx0XHQgKi9cclxuXHRcdGV4cG9ydCB0eXBlIE1hcHBpbmcgPSAodGV4dDogc3RyaW5nKSA9PiBzdHJpbmc7XHJcblx0fSAvL1R5cGVzXHJcblx0XHJcblx0ZXhwb3J0IG5hbWVzcGFjZSB1dGlsIHtcclxuXHRcdFxyXG5cdFx0ZXhwb3J0IGZ1bmN0aW9uIGlkeFRvQ3JkKGlkeDogbnVtYmVyLCBzejogbnVtYmVyKTogW251bWJlciwgbnVtYmVyXSB7XHJcblx0XHRcdHJldHVybiBbIGlkeCAlIHN6LCBNYXRoLmZsb29yKGlkeCAvIHN6KSBdO1xyXG5cdFx0fSAvL2lkeFRvQ3JkXHJcblx0XHRleHBvcnQgZnVuY3Rpb24gY3JkVG9JZHgoY3JkOiBbbnVtYmVyLCBudW1iZXJdLCBzejogbnVtYmVyKTogbnVtYmVyIHtcclxuXHRcdFx0cmV0dXJuIGNyZFsxXSAqIHN6ICsgY3JkWzBdO1xyXG5cdFx0fSAvL2NyZFRvSWR4XHJcblx0XHRcclxuXHR9IC8vdXRpbFxyXG5cdFxyXG5cdFxyXG5cdC8qKlxyXG5cdCAqIFJlc3BvbnNpYmxlIGZvciByZXByZXNlbnRpbmcgQ2h1bmtzLlxyXG5cdCAqL1xyXG5cdGNsYXNzIFJHTFRpbGUgaW1wbGVtZW50cyBUeXBlcy5Db252ZXJ0YWJsZSB7XHJcblx0XHRcclxuXHRcdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IHRyaW06IFJlZ0V4cCA9IC9cXHUwMDAwL2dpbTtcclxuXHRcdHByaXZhdGUgc3RhdGljIF9pZGNudHI6IG51bWJlciA9IDA7XHJcblx0XHRwcm90ZWN0ZWQgc3RhdGljIGRlY29kZXI6IFN0cmluZ0RlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihcInV0ZjhcIik7XHJcblx0XHRzdGF0aWMgbWFwcGluZ3NfYzogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz47XHJcblx0XHRzdGF0aWMgbWFwcGluZ3NfYjogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz47XHJcblx0XHRzdGF0aWMgbWFwcGluZ3NfczogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz47XHJcblx0XHRcclxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lkOiBudW1iZXIgPSBSR0xUaWxlLl9pZGNudHIrKztcclxuXHRcdHByb3RlY3RlZCByZWFkb25seSBwcmVjYWxjOiBzdHJpbmcgPSBcIlwiO1xyXG5cdFx0cHJvdGVjdGVkIHJlYWRvbmx5IHJlc2VydmVkOiBudW1iZXI7XHJcblx0XHRjb29yZHM6IFtudW1iZXIsIG51bWJlcl0gPSBbIDAsIDAgXTtcclxuXHRcdHBhcmVudD86IFJlYWRvbmx5PFJHTE1hcD47XHJcblx0XHRcclxuXHRcdFxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVhZG9ubHkgb3JpZ2luOiBSZWFkb25seTxCdWZmZXI+XHJcblx0XHQpIHtcclxuXHRcdFx0YXNzZXJ0Lm9rKG9yaWdpbi5sZW5ndGggPT0gOCwgRXJyb3JzLkVCQURCVUYpO1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5vcmlnaW4gPSBCdWZmZXIuZnJvbShvcmlnaW4pO1xyXG5cdFx0XHR0aGlzLnByZWNhbGMgPSAoUkdMVGlsZS5tYXBwaW5nc19zLmdldChvcmlnaW5bNl0pID8/ICh0ID0+IHQpKSgoUkdMVGlsZS5tYXBwaW5nc19iLmdldChvcmlnaW5bNV0pID8/ICh0ID0+IHQpKSgoUkdMVGlsZS5tYXBwaW5nc19jLmdldChvcmlnaW5bNF0pID8/ICh0ID0+IHQpKShSR0xUaWxlLmRlY29kZXIud3JpdGUob3JpZ2luLnNsaWNlKDAsIDQpKS5yZXBsYWNlKFJHTFRpbGUudHJpbSwgJycpKSkpO1xyXG5cdFx0XHR0aGlzLnJlc2VydmVkID0gb3JpZ2luWzddO1xyXG5cdFx0fSAvL2N0b3JcclxuXHRcdFxyXG5cdFx0XHJcblx0XHRwdWJsaWMgZ2V0IHNlcmlhbGl6ZSgpOiBCdWZmZXIge1xyXG5cdFx0XHQvL2RlYnVnKGBSR0xUaWxlLnNlcmlhbGl6ZWApO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIEJ1ZmZlci5mcm9tKHRoaXMub3JpZ2luKTtcclxuXHRcdH0gLy9zZXJpYWxpemVcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBkYXRhIGludG8gYSBDb252ZXJ0YWJsZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1JlYWRvbmx5PEJ1ZmZlcj59IGNodW5rXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgcGFyc2UoY2h1bms6IFJlYWRvbmx5PEJ1ZmZlciB8IFJHTFRpbGU+LCBwYXJlbnQ/OiBSZWFkb25seTxSR0xNYXA+KTogUkdMVGlsZSB7XHJcblx0XHRcdC8vZGVidWcoYFJHTFRpbGUucGFyc2VgKTtcclxuXHRcdFx0bGV0IHJldDogUkdMVGlsZTtcclxuXHRcdFx0XHJcblx0XHRcdGlmIChjaHVuayBpbnN0YW5jZW9mIFJHTFRpbGUpIHtcclxuXHRcdFx0XHRyZXQgPSBuZXcgUkdMVGlsZShjaHVuay5vcmlnaW4pO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdHJldC5jb29yZHMgPSA8W251bWJlciwgbnVtYmVyXT5BcnJheS5mcm9tKGNodW5rLmNvb3Jkcyk7XHJcblx0XHRcdH0gZWxzZSByZXQgPSBuZXcgUkdMVGlsZSg8UmVhZG9ubHk8QnVmZmVyPj5jaHVuayk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXQucGFyZW50ID0gcGFyZW50O1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIHJldDtcclxuXHRcdH0gLy9wYXJzZVxyXG5cdFx0XHJcblx0XHRcclxuXHRcdHB1YmxpYyB0b1N0cmluZygpOiBzdHJpbmcge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5wcmVjYWxjO1xyXG5cdFx0fSAvL3RvU3RyaW5nXHJcblxyXG5cdFx0cHVibGljIFtTeW1ib2wudG9QcmltaXRpdmVdKGhpbnQ6IHN0cmluZykge1xyXG5cdFx0XHRpZiAoaGludCA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIHRoaXMudG9TdHJpbmcoKTtcclxuXHRcdFx0ZWxzZSByZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHRcdFxyXG5cdH0gLy9SR0xUaWxlXHJcblx0XHJcblx0LyoqXHJcblx0ICogUmVzcG9uc2libGUgZm9yIHBhcnNpbmcgYW5kIHN0cmlwcGluZyBDaHVua3MuXHJcblx0ICovXHJcblx0Y2xhc3MgUkdMTWFwIGltcGxlbWVudHMgVHlwZXMuQ29udmVydGFibGUge1xyXG5cdFx0XHJcblx0XHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQUdJQzogQnVmZmVyID0gQnVmZmVyLmZyb20oWzB4MDMsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTtcclxuXHRcdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFJHTDogQnVmZmVyID0gQnVmZmVyLmZyb20oWzB4NTIsIDB4NDcsIDB4NEMsIDB4MDJdKTtcclxuXHRcdHByaXZhdGUgc3RhdGljIF9pZGNudHI6IG51bWJlciA9IDA7XHJcblx0XHRcclxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lkOiBudW1iZXIgPSBSR0xNYXAuX2lkY250cisrO1xyXG5cdFx0XHJcblx0XHRcclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3RvcihcclxuXHRcdFx0cHJvdGVjdGVkIHJlc2VydmVkOiBCdWZmZXIgPSBCdWZmZXIuYWxsb2MoMywgMCksXHJcblx0XHRcdHByb3RlY3RlZCBzaXplOiBCdWZmZXIgPSBCdWZmZXIuYWxsb2MoMiwgMCksXHJcblx0XHRcdHByb3RlY3RlZCB0aWxlczogUkdMVGlsZVtdID0gWyBdLFxyXG5cdFx0XHRwcm90ZWN0ZWQgdHJhaWxpbmc6IEJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZSgwKSxcclxuXHRcdFx0cHJvdGVjdGVkIF9mcm9tRmlsZTogc3RyaW5nID0gXCJcIixcclxuXHRcdFx0cHJvdGVjdGVkIHRyYW5zOiBbbnVtYmVyLCBudW1iZXJdID0gWyAwLCAwIF1cclxuXHRcdCkge1xyXG5cdFx0XHR0aGlzLl9mcm9tRmlsZSA9IHBhdGgucmVzb2x2ZShwYXRoLm5vcm1hbGl6ZShfZnJvbUZpbGUpKTtcclxuXHRcdH0gLy9jdG9yXHJcblx0XHRcclxuXHRcdFxyXG5cdFx0cHVibGljIGdldCBzZXJpYWxpemUoKTogQnVmZmVyIHtcclxuXHRcdFx0ZGVidWcoYFJHTE1hcC5zZXJpYWxpemVgKTtcclxuXHRcdFx0XHJcblx0XHRcdGxldCByZXQ6IEJ1ZmZlciA9IEJ1ZmZlci5jb25jYXQoW3RoaXMucmVzZXJ2ZWQsIFJHTE1hcC5SR0wsIHRoaXMuc2l6ZV0pO1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5fc29ydFRpbGVzKCk7XHJcblx0XHRcdFxyXG5cdFx0XHRmb3IgKGNvbnN0IHRpbGUgb2YgdGhpcy50aWxlcykgcmV0ID0gQnVmZmVyLmNvbmNhdChbIHJldCwgdGlsZS5zZXJpYWxpemUgXSk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gQnVmZmVyLmNvbmNhdChbIHJldCwgUkdMTWFwLk1BR0lDLCB0aGlzLnRyYWlsaW5nIF0pO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZVxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdG9yZSBDb252ZXJ0YWJsZSBpbnRvIGEgd3JpdGFibGUgJ2ZpbGUnLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSBmaWxlIC0gVGFyZ2V0IGZpbGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIGFzeW5jIHNlcmlhbGl6ZUZpbGUoZmlsZTogUmVhZG9ubHk8c3RyaW5nPiA9IHRoaXMuX2Zyb21GaWxlKTogUHJvbWlzZTxCdWZmZXI+IHtcclxuXHRcdFx0ZGVidWcoYFJHTE1hcC5zZXJpYWxpemVGaWxlOiAke2ZpbGV9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRsZXQgZGF0YTogQnVmZmVyO1xyXG5cdFx0XHRcclxuXHRcdFx0YXdhaXQgZnMub3V0cHV0RmlsZShmaWxlLCBkYXRhID0gdGhpcy5zZXJpYWxpemUsIHtcclxuXHRcdFx0XHRtb2RlOiAwbzc1MSxcclxuXHRcdFx0XHRlbmNvZGluZzogXCJiaW5hcnlcIixcclxuXHRcdFx0XHRmbGFnOiBcIndcIlxyXG5cdFx0XHR9KTtcclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBkYXRhO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZUZpbGVcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBQYXJzZSBkYXRhIGludG8gYSBDb252ZXJ0YWJsZS5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge1JlYWRvbmx5PEJ1ZmZlcj59IGNodW5rXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgcGFyc2UoZGF0YTogUmVhZG9ubHk8QnVmZmVyPik6IFJHTE1hcCB7XHJcblx0XHRcdGRlYnVnKGBSR0xNYXAucGFyc2VgKTtcclxuXHRcdFx0XHJcblx0XHRcdGFzc2VydC5vayhCdWZmZXIuaXNCdWZmZXIoZGF0YSksIEVycm9ycy5FTk9CVUYpO1xyXG5cdFx0XHRhc3NlcnQub2soQnVmZmVyLmlzRW5jb2RpbmcoXCJiaW5hcnlcIiksIEVycm9ycy5FTk9CSU4pO1xyXG5cdFx0XHRhc3NlcnQub2soZGF0YS5sZW5ndGggPj0gOSwgRXJyb3JzLkVCQURCVUYpO1xyXG5cdFx0XHRcclxuXHRcdFx0Y29uc3QgbWFwOiBSR0xNYXAgPSBuZXcgUkdMTWFwKGRhdGEuc2xpY2UoMCwgMyksIGRhdGEuc2xpY2UoNywgOSkpO1xyXG5cdFx0XHRcclxuXHRcdFx0bGV0IGlkeDogbnVtYmVyID0gOSxcclxuXHRcdFx0XHRjbnRyOiBudW1iZXIgPSAwO1xyXG5cdFx0XHRcclxuXHRcdFx0d2hpbGUgKGlkeCA8IGRhdGEubGVuZ3RoICYmICFkYXRhLnNsaWNlKGlkeCwgaWR4ICsgNSkuZXF1YWxzKFJHTE1hcC5NQUdJQykpIHtcclxuXHRcdFx0XHRsZXQgdGlsZTogUkdMVGlsZTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRtYXAudGlsZXMucHVzaCh0aWxlID0gUkdMVGlsZS5wYXJzZShkYXRhLnNsaWNlKGlkeCwgaWR4ICs9IDgpKSk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0dGlsZS5wYXJlbnQgPSBtYXA7XHJcblx0XHRcdFx0dGlsZS5jb29yZHMgPSBbIGNudHIgJSBtYXAuc2l6ZVswXSwgTWF0aC5mbG9vcihjbnRyIC8gbWFwLnNpemVbMF0pIF07XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdGlmIChpZHggIT0gZGF0YS5sZW5ndGgpIHtcclxuXHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2U6IGhhcyB0cmFpbGluZ2ApO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdG1hcC50cmFpbGluZyA9IGRhdGEuc2xpY2UoaWR4ICsgNSk7XHJcblx0XHRcdH1cclxuXHRcdFx0XHJcblx0XHRcdHJldHVybiBtYXA7XHJcblx0XHR9IC8vcGFyc2VcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVhZCBCdWZmZXIgZnJvbSAnZmlsZScuXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSBmaWxlIC0gVGFyZ2V0IGZpbGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBhc3luYyBwYXJzZUZpbGUoZmlsZTogUmVhZG9ubHk8c3RyaW5nPik6IFByb21pc2U8UkdMTWFwPiB7XHJcblx0XHRcdGRlYnVnKGBSR0xNYXAucGFyc2VGaWxlOiAke2ZpbGV9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlcywgcmVqKSA9PiB7XHJcblx0XHRcdFx0ZGVidWdfdihgUkdMTWFwLnBhcnNlRmlsZTogQUNDRVNTYCk7XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0ZnMuYWNjZXNzKGZpbGUsIGZzLmNvbnN0YW50cy5GX09LIHwgZnMuY29uc3RhbnRzLlJfT0ssIGVyciA9PiB7XHJcblx0XHRcdFx0XHRpZiAoZXJyKSB7XHJcblx0XHRcdFx0XHRcdGRlYnVnX2UoYFJHTE1hcC5wYXJzZUZpbGU6ICR7ZmlsZX0gLT4gRUFDQ0VTU2ApO1xyXG5cdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2VGaWxlOiBSU1RSRUFNYCk7XHJcblx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRjb25zdCBzdHI6IGZzLlJlYWRTdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGUsIHtcclxuXHRcdFx0XHRcdFx0XHRmbGFnczogXCJyXCIsXHJcblx0XHRcdFx0XHRcdFx0ZW5jb2Rpbmc6IFwiYmluYXJ5XCIsXHJcblx0XHRcdFx0XHRcdFx0bW9kZTogZnMuY29uc3RhbnRzLlNfSVJVU1IgfCBmcy5jb25zdGFudHMuU19JWEdSUCxcclxuXHRcdFx0XHRcdFx0XHRlbWl0Q2xvc2U6IHRydWVcclxuXHRcdFx0XHRcdFx0fSlcclxuXHRcdFx0XHRcdFx0Lm9uY2UoXCJyZWFkYWJsZVwiLCBhc3luYyAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0ZGVidWdfdihgUkdMTWFwLnBhcnNlRmlsZTogJHtmaWxlfSAtPiBSZWFkYWJsZWApO1xyXG5cdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdGxldCBkYXRhOiBzdHJpbmcgPSAnJztcclxuXHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRzdHIuc2V0RW5jb2RpbmcoXCJiaW5hcnlcIik7XHJcblx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0Zm9yIGF3YWl0IChsZXQgY2h1bmsgb2Ygc3RyKSBkYXRhICs9IGNodW5rO1xyXG5cdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdHN0ci5vbmNlKFwiY2xvc2VcIiwgKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgbWFwOiBSR0xNYXAgPSBSR0xNYXAucGFyc2UoQnVmZmVyLmZyb20oZGF0YSwgXCJiaW5hcnlcIikpO1xyXG5cdFx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0XHRtYXAuX2Zyb21GaWxlID0gZmlsZTtcclxuXHRcdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdFx0cmVzKG1hcCk7XHJcblx0XHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0gLy9wYXJzZUZpbGVcclxuXHRcdFxyXG5cdFx0cHJvdGVjdGVkIF9zb3J0VGlsZXModGlsZXM6IFJHTFRpbGVbXSA9IHRoaXMudGlsZXMpOiB2b2lkIHtcclxuXHRcdFx0dGlsZXMuc29ydCgoYTogUmVhZG9ubHk8UkdMVGlsZT4sIGI6IFJlYWRvbmx5PFJHTFRpbGU+KTogbnVtYmVyID0+IHV0aWwuY3JkVG9JZHgoYS5jb29yZHMsIHRoaXMuc2l6ZVswXSkgLSB1dGlsLmNyZFRvSWR4KGIuY29vcmRzLCB0aGlzLnNpemVbMF0pKTtcclxuXHRcdH0gLy9fc29ydFRpbGVzXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQ2hlY2sgdmFsaWRpdHkgb2YgdGlsZSdzIGNvb3Jkcy5cclxuXHRcdCAqL1xyXG5cdFx0Y2hlY2tWYWxpZGl0eT8oKTogYm9vbGVhbiB7XHJcblx0XHRcdHJldHVybiB0cnVlO1xyXG5cdFx0fSAvL2NoZWNrVmFsaWRpdHlcclxuXHRcdFxyXG5cdFx0XHJcblx0XHRwdWJsaWMgdG9TdHJpbmcoKTogc3RyaW5nIHtcclxuXHRcdFx0cmV0dXJuIHRoaXMudGlsZXMubWFwKCh0aWxlOiBSR0xUaWxlKTogc3RyaW5nID0+IHRpbGUudG9TdHJpbmcoKSkuam9pbignJyk7XHJcblx0XHR9IC8vdG9TdHJpbmdcclxuXHRcdFxyXG5cdFx0cHVibGljIFtTeW1ib2wudG9QcmltaXRpdmVdKGhpbnQ6IHN0cmluZykge1xyXG5cdFx0XHRpZiAoaGludCA9PT0gXCJzdHJpbmdcIikgcmV0dXJuIHRoaXMudG9TdHJpbmcoKTtcclxuXHRcdFx0ZWxzZSByZXR1cm4gdGhpcztcclxuXHRcdH1cclxuXHRcdFxyXG5cdH0gLy9SR0xNYXBcclxuXHRcclxuXHQvKipcclxuXHQgKiBSZXNwb25zaWJsZSBmb3IgY29udHJvbGxpbmcgYXNzZXRzIGFuZCB0cmFuc2l0aW9ucy5cclxuXHQgKi9cclxuXHRleHBvcnQgY2xhc3MgUkdMR3JvdW5kIHtcclxuXHRcdFxyXG5cdFx0XHJcblx0XHRjb25zdHJ1Y3RvcihcclxuXHRcdFx0cHJvdGVjdGVkIG1hcGxpc3Q6IE1hcDxzdHJpbmcsIFJHTE1hcD4gPSBuZXcgTWFwKCksXHJcblx0XHRcdHByb3RlY3RlZCBmb3JlZ3JvdW5kOiBUeXBlcy5OdWxsYWJsZTxSR0xNYXA+ID0gbnVsbCxcclxuXHRcdFx0cHJvdGVjdGVkIHZpZXdwb3J0OiBbbnVtYmVyLCBudW1iZXJdID0gWyAwLCAwIF1cclxuXHRcdCkge1xyXG5cdFx0XHRcclxuXHRcdH0gLy9jdG9yXHJcblx0XHRcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBTZXRzIHRoZSBmb3JlZ3JvdW5kIG9yIHJldHJpZXZlcy5cclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIGZvY3VzKGZnPzogUkdMTWFwIHwgc3RyaW5nKTogVHlwZXMuTnVsbGFibGU8UkdMTWFwPiB7XHJcblx0XHRcdGlmICghIWZnKSB7XHJcblx0XHRcdFx0aWYgKHR5cGVvZiBmZyA9PT0gXCJzdHJpbmdcIikgdGhpcy5mb3JlZ3JvdW5kID0gdGhpcy5tYXBsaXN0LmdldChmZyk7XHJcblx0XHRcdFx0ZWxzZSB0aGlzLmZvcmVncm91bmQgPSBmZztcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIHRoaXMuZm9yZWdyb3VuZDtcclxuXHRcdH0gLy9mb2N1c1xyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIEFkZCBvciByZXRyaWV2ZSBhIG1hcC5cclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIG1hcChuYW1lPzogc3RyaW5nLCBtcD86IFJHTE1hcCk6IEl0ZXJhYmxlSXRlcmF0b3I8W3N0cmluZywgUkdMTWFwXT4ge1xyXG5cdFx0XHRpZiAoISFtcCkgdGhpcy5tYXBsaXN0LnNldChuYW1lISwgbXApO1xyXG5cdFx0XHRlbHNlIGlmICghIW5hbWUpIGFzc2VydC5mYWlsKEVycm9ycy5FQkFEUEFSQU0pO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIHRoaXMubWFwbGlzdC5lbnRyaWVzKCk7XHJcblx0XHR9IC8vbWFwXHJcblx0XHRcclxuXHR9IC8vUkdMR3JvdW5kXHJcblx0XHJcblx0LyoqXHJcblx0ICogUmVzcG9uc2libGUgZm9yIGNvbnRyb2xsaW5nIGV2ZW50cyBhbmQgc2V0dGluZ3MuXHJcblx0ICovXHJcblx0ZXhwb3J0IGNsYXNzIFJHTCBleHRlbmRzIGV2ZW50LkV2ZW50RW1pdHRlciB7XHJcblx0XHRcclxuXHRcdHByb3RlY3RlZCBzdGF0aWMgbWFwcGluZ3NfczogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4gPSBuZXcgTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4oX21hcHBpbmdzX3MpO1xyXG5cdFx0XHJcblx0XHRwcm90ZWN0ZWQgYmluZHM6IFR5cGVzLk51bGxhYmxlPFR5cGVzLklPPiA9IG51bGw7XHJcblx0XHRcclxuXHRcdFxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxyXG5cdFx0XHRhdXRvY29uZmlnOiBib29sZWFuID0gdHJ1ZSxcclxuXHRcdFx0cHJvdGVjdGVkIHNlY3VyZVN3aXRjaDogYm9vbGVhbiA9IHRydWUsICAvKiBVbmJpbmQgQ1RSTC1DICovXHJcblx0XHRcdHByb3RlY3RlZCBtYXBwaW5nc19jOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPiA9IF9tYXBwaW5nc19jLFxyXG5cdFx0XHRwcm90ZWN0ZWQgbWFwcGluZ3NfYjogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4gPSBfbWFwcGluZ3NfYixcclxuXHRcdFx0cHJvdGVjdGVkIHJlYWRvbmx5IF9NYXA6IHR5cGVvZiBSR0xNYXAgPSBSR0xNYXAsXHJcblx0XHRcdHByb3RlY3RlZCByZWFkb25seSBfVGlsZTogdHlwZW9mIFJHTFRpbGUgPSBSR0xUaWxlLFxyXG5cdFx0XHRwdWJsaWMgZ3JvdW5kOiBSR0xHcm91bmQgPSBuZXcgUkdMR3JvdW5kKClcclxuXHRcdCkge1xyXG5cdFx0XHRzdXBlcigpO1xyXG5cdFx0XHRcclxuXHRcdFx0aWYgKCFSR0wuc3VwcG9ydHNDb2xvcnMpIGNvbnNvbGUud2FybihcIlRlcm1pbmFsIGNvbG9ycyBhcmUgbm90IHN1cHBvcnRlZCFcIik7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLm1hcHBpbmdzX2MgPSBuZXcgTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4obWFwcGluZ3NfYyk7XHJcblx0XHRcdHRoaXMubWFwcGluZ3NfYiA9IG5ldyBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPihtYXBwaW5nc19iKTtcclxuXHRcdFx0XHJcblx0XHRcdGlmIChhdXRvY29uZmlnKSB7XHJcblx0XHRcdFx0UHJvbWlzZS5hbGwoW1xyXG5cdFx0XHRcdFx0dGhpcy5sb2FkTWFwcGluZ3NfYygpLFxyXG5cdFx0XHRcdFx0dGhpcy5sb2FkTWFwcGluZ3NfYigpXHJcblx0XHRcdFx0XSkuY2F0Y2goKCkgPT4gZGVidWdfZShcIlJHTC5hdXRvY29uZjogRU1BUFBJTkdcIikpLnRoZW4oKCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19jID0gdGhpcy5tYXBwaW5nc19jO1xyXG5cdFx0XHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19iID0gdGhpcy5tYXBwaW5nc19iO1xyXG5cdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRkZWJ1ZyhcIlJHTC5jdG9yIGRlZmZlcmVkIG1hcHBpbmdzLlwiKTtcclxuXHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR0aGlzLmJpbmQoKTtcclxuXHRcdFx0fVxyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19jID0gdGhpcy5tYXBwaW5nc19jO1xyXG5cdFx0XHR0aGlzLl9UaWxlLm1hcHBpbmdzX2IgPSB0aGlzLm1hcHBpbmdzX2I7XHJcblx0XHRcdHRoaXMuX1RpbGUubWFwcGluZ3NfcyA9IFJHTC5tYXBwaW5nc19zO1xyXG5cdFx0fSAvL2N0b3JcclxuXHRcdFxyXG5cdFx0XHJcblx0XHQvKipcclxuXHRcdCAqIFdoZXRoZXIgdGhlIFRUWSBzdXBwb3J0cyBiYXNpYyBjb2xvcnMuXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgZ2V0IHN1cHBvcnRzQ29sb3JzKCk6IGJvb2xlYW4ge1xyXG5cdFx0XHRyZXR1cm4gISFjaGFsay5sZXZlbDtcclxuXHRcdH0gLy9zdXBwb3J0c0NvbG9yc1xyXG5cdFx0XHJcblx0XHRwdWJsaWMgYXN5bmMgbG9hZE1hcHBpbmdzX2MocGF0aD86IFJlYWRvbmx5PHN0cmluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYyhtYXA/OiBSZWFkb25seTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYyhtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PiA9IFwiUkdMTWFwcGluZ3NfYy5qc1wiKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4ge1xyXG5cdFx0XHR0aGlzLmVtaXQoXCJfbG9hZENvbG9yc1wiLCBtYXApO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIFJHTC5sb2FkTWFwcGluZ3MobWFwLCB0aGlzLm1hcHBpbmdzX2MpO1xyXG5cdFx0fSAvL2xvYWRNYXBwaW5nc19jXHJcblx0XHRcclxuXHRcdHB1YmxpYyBhc3luYyBsb2FkTWFwcGluZ3NfYihwYXRoPzogUmVhZG9ubHk8c3RyaW5nPik6IFByb21pc2U8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+O1xyXG5cdFx0cHVibGljIGxvYWRNYXBwaW5nc19iKG1hcD86IFJlYWRvbmx5PE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+Pik6IFByb21pc2U8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+O1xyXG5cdFx0cHVibGljIGxvYWRNYXBwaW5nc19iKG1hcDogUmVhZG9ubHk8c3RyaW5nIHwgTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+ID0gXCJSR0xNYXBwaW5nc19iLmpzXCIpOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PiB7XHJcblx0XHRcdHRoaXMuZW1pdChcIl9sb2FkQmFja2dyb3VuZFwiLCBtYXApO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIFJHTC5sb2FkTWFwcGluZ3MobWFwLCB0aGlzLm1hcHBpbmdzX2IpO1xyXG5cdFx0fSAvL2xvYWRNYXBwaW5nc19jXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogSW5jbHVkZSBjdXN0b20gbWFwcGluZ3MuXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSBtYXAgLSBMb2FkIG5ldyBtYXBwaW5nc1xyXG5cdFx0ICogQHBhcmFtIG9yaWcgLSBNYXBwaW5ncyB0byBvdmVycmlkZVxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGFzeW5jIGxvYWRNYXBwaW5ncyhtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+Piwgb3JpZzogTWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+PiB7XHJcblx0XHRcdGRlYnVnKFwiUkdMLmxvYWRNYXBwaW5nczpcIiwgaW5zcGVjdChvcmlnLCB7IGJyZWFrTGVuZ3RoOiBJbmZpbml0eSB9KSk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAodHlwZW9mIG1hcCA9PT0gXCJzdHJpbmdcIikge1xyXG5cdFx0XHRcdGxldCBkYXRhOiBNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPjtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHRkZWxldGUgcmVxdWlyZS5jYWNoZVtyZXF1aXJlLnJlc29sdmUobWFwKV07XHJcblx0XHRcdFx0XHJcblx0XHRcdFx0dHJ5IHtcclxuXHRcdFx0XHRcdGRhdGEgPSByZXF1aXJlKG1hcCk7XHJcblx0XHRcdFx0fSBjYXRjaChlKSB7XHJcblx0XHRcdFx0XHRkYXRhID0gbmV3IE1hcDxudW1iZXIsIFR5cGVzLk1hcHBpbmc+KFsgXSk7XHJcblx0XHRcdFx0fVxyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGZvciAobGV0IHNpZyBvZiBkYXRhKSBvcmlnLnNldChzaWdbMF0sIHNpZ1sxXSk7XHJcblx0XHRcdH0gZWxzZSBpZiAobWFwIGluc3RhbmNlb2YgTWFwKSB7XHJcblx0XHRcdFx0Zm9yIChsZXQgc2lnIG9mIG1hcCkgb3JpZy5zZXQoc2lnWzBdLCBzaWdbMV0pO1xyXG5cdFx0XHR9IGVsc2UgdGhyb3cgRXJyb3JzLkVCQURUUFlFO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIG9yaWc7XHJcblx0XHR9IC8vbG9hZE1hcHBpbmdzXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogQmluZCB0aGUgUkdMIGVuZ2luZSB0byBJL08uXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSBpbnAgLSBUaGUgdGFyZ2V0IHVzZXItaW5wdXQgc3RyZWFtIHRvIGJpbmQsIG11c3QgYmUgYSBUVFlcclxuXHRcdCAqIEBwYXJhbSBvdXQgLSBUaGUgdGFyZ2V0IHVzZXItaW5wdXQgc3RyZWFtIHRvIGJpbmQsIG11c3QgYmUgYSBUVFlcclxuXHRcdCAqL1xyXG5cdFx0YmluZChpbnA6IHR0eS5SZWFkU3RyZWFtID0gKHRoaXMuYmluZHMgPyB0aGlzLmJpbmRzLmlucHV0IDogcHJvY2Vzcy5zdGRpbikgPz8gcHJvY2Vzcy5zdGRpbiwgb3V0OiB0dHkuV3JpdGVTdHJlYW0gPSAodGhpcy5iaW5kcyA/IHRoaXMuYmluZHMub3V0cHV0IDogcHJvY2Vzcy5zdGRvdXQpID8/IHByb2Nlc3Muc3Rkb3V0LCBlcnI6IE5vZGVKUy5SZWFkV3JpdGVTdHJlYW0gPSAodGhpcy5iaW5kcyA/IHRoaXMuYmluZHMuZXJyb3IgOiBwcm9jZXNzLnN0ZGVycikgPz8gcHJvY2Vzcy5zdGRlcnIpOiB0aGlzIHtcclxuXHRcdFx0ZGVidWcoYFJHTC5iaW5kOiAke3RoaXMuYmluZHN9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRhc3NlcnQub2soaW5wLmlzVFRZICYmIG91dC5pc1RUWSwgRXJyb3JzLkVOT1RUWSk7XHJcblx0XHRcdFxyXG5cdFx0XHRpZiAoISF0aGlzLmJpbmRzICYmICEhdGhpcy5iaW5kcyEuaW5wdXQpIHtcclxuXHRcdFx0XHRkZWJ1ZyhgUkdMLmJpbmQ6IHVuYm91bmRgKTtcclxuXHRcdFx0XHRcclxuXHRcdFx0XHR0aGlzLmJpbmRzIS5pbnB1dC5zZXRSYXdNb2RlKGZhbHNlKTtcclxuXHRcdFx0XHRpZiAoISF0aGlzLmJpbmRzIS5faW5wQ2IpIHRoaXMuYmluZHMhLmlucHV0LnJlbW92ZUxpc3RlbmVyKFwiZGF0YVwiLCB0aGlzLmJpbmRzIS5faW5wQ2IpO1xyXG5cdFx0XHR9XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmJpbmRzID0gPFR5cGVzLklPPntcclxuXHRcdFx0XHRpbnB1dDogaW5wLFxyXG5cdFx0XHRcdG91dHB1dDogb3V0LFxyXG5cdFx0XHRcdGVycm9yOiBlcnJcclxuXHRcdFx0fTtcclxuXHRcdFx0XHJcblx0XHRcdHRoaXMuYmluZHMhLmlucHV0LnNldFJhd01vZGUodHJ1ZSk7XHJcblx0XHRcdFxyXG5cdFx0XHR0aGlzLmJpbmRzIS5pbnB1dC5vbihcImRhdGFcIiwgdGhpcy5iaW5kcyEuX2lucENiID0gZGF0YSA9PiB7XHJcblx0XHRcdFx0dGhpcy5lbWl0KFwicmF3a2V5XCIsIGRhdGEpO1xyXG5cdFx0XHRcdHRoaXMuZW1pdChcImtleVwiLCBkYXRhLnRvU3RyaW5nKCkpO1xyXG5cdFx0XHRcdFxyXG5cdFx0XHRcdGlmICh0aGlzLnNlY3VyZVN3aXRjaCAmJiBkYXRhLnRvU3RyaW5nKCkgPT09ICdcXHUwMDAzJykge1xyXG5cdFx0XHRcdFx0dGhpcy5lbWl0KFwiX2V4aXRcIik7XHJcblx0XHRcdFx0XHRwcm9jZXNzLmV4aXQoKTtcclxuXHRcdFx0XHR9XHJcblx0XHRcdH0pO1xyXG5cdFx0XHRcclxuXHRcdFx0cmV0dXJuIHRoaXM7XHJcblx0XHR9IC8vYmluZFxyXG5cdFx0XHJcblx0XHR1bmJpbmQoKTogdGhpcyB7XHJcblx0XHRcdGRlYnVnKGBSR0wudW5iaW5kOiAke3RoaXMuYmluZHN9YCk7XHJcblx0XHRcdFxyXG5cdFx0XHRhc3NlcnQub2sodGhpcy5iaW5kcyAmJiB0aGlzLmJpbmRzLmlucHV0LmlzVFRZICYmIHRoaXMuYmluZHMub3V0cHV0LmlzVFRZLCBFcnJvcnMuRUJBREJJTkQpO1xyXG5cdFx0XHRcclxuXHRcdFx0dGhpcy5iaW5kcyEuaW5wdXQuc2V0UmF3TW9kZShmYWxzZSk7XHJcblx0XHRcdGlmICghIXRoaXMuYmluZHMhLl9pbnBDYikgdGhpcy5iaW5kcyEuaW5wdXQucmVtb3ZlTGlzdGVuZXIoXCJkYXRhXCIsIHRoaXMuYmluZHMhLl9pbnBDYik7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gdGhpcztcclxuXHRcdH0gLy91bmJpbmRcclxuXHRcdFxyXG5cdFx0ZW1pdChldmVudDogXCJrZXlcIiwgZGF0YTogc3RyaW5nKTogYm9vbGVhbjtcclxuXHRcdGVtaXQoZXZlbnQ6IFwicmF3a2V5XCIsIGRhdGE6IEJ1ZmZlcik6IGJvb2xlYW47XHJcblx0XHRlbWl0KGV2ZW50OiBcIl9leGl0XCIpOiBib29sZWFuO1xyXG5cdFx0ZW1pdChldmVudDogXCJfbG9hZEJhY2tncm91bmRcIiwgZGF0YTogc3RyaW5nIHwgUmVhZG9ubHk8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+KTogYm9vbGVhbjtcclxuXHRcdGVtaXQoZXZlbnQ6IFwiX2xvYWRDb2xvcnNcIiwgZGF0YTogc3RyaW5nIHwgUmVhZG9ubHk8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+KTogYm9vbGVhbjtcclxuXHRcdGVtaXQoZXZlbnQ6IHN0cmluZyB8IHN5bWJvbCwgLi4uYXJnczogYW55W10pOiBib29sZWFuO1xyXG5cdFx0ZW1pdChldmVudDogc3RyaW5nIHwgc3ltYm9sLCAuLi5hcmdzOiBhbnlbXSk6IGJvb2xlYW4ge1xyXG5cdFx0XHRyZXR1cm4gc3VwZXIuZW1pdChldmVudCwgLi4uYXJncyk7XHJcblx0XHR9IC8vZW1pdFxyXG5cdFx0XHJcblx0XHRwdWJsaWMgb24oZXZlbnQ6IFwia2V5XCIsIGxpc3RlbmVyOiAoZGF0YTogc3RyaW5nKSA9PiB2b2lkKTogdGhpcztcclxuXHRcdHB1YmxpYyBvbihldmVudDogXCJyYXdrZXlcIiwgbGlzdGVuZXI6IChkYXRhOiBCdWZmZXIpID0+IHZvaWQpOiB0aGlzO1xyXG5cdFx0cHVibGljIG9uKGV2ZW50OiBcIl9leGl0XCIsIGxpc3RlbmVyOiAoKSA9PiB2b2lkKTogdGhpcztcclxuXHRcdHB1YmxpYyBvbihldmVudDogXCJfbG9hZEJhY2tncm91bmRcIiwgbGlzdGVuZXI6IChkYXRhOiBzdHJpbmcgfCBSZWFkb25seTxNYXA8bnVtYmVyLCBUeXBlcy5NYXBwaW5nPj4pID0+IHZvaWQpOiB0aGlzO1xyXG5cdFx0cHVibGljIG9uKGV2ZW50OiBcIl9sb2FkQ29sb3JzXCIsIGxpc3RlbmVyOiAoZGF0YTogc3RyaW5nIHwgUmVhZG9ubHk8TWFwPG51bWJlciwgVHlwZXMuTWFwcGluZz4+KSA9PiB2b2lkKTogdGhpcztcclxuXHRcdHB1YmxpYyBvbihldmVudDogc3RyaW5nIHwgc3ltYm9sLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKTogdGhpcztcclxuXHRcdHB1YmxpYyBvbihldmVudDogc3RyaW5nIHwgc3ltYm9sLCBsaXN0ZW5lcjogKC4uLmFyZ3M6IGFueVtdKSA9PiB2b2lkKTogdGhpcyB7XHJcblx0XHRcdHJldHVybiBzdXBlci5vbihldmVudCwgbGlzdGVuZXIpO1xyXG5cdFx0fSAvL29uXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogU3RhcnQgYW4gaW5zdGFuY2Ugb2YgUkdMLlxyXG5cdFx0ICogXHJcblx0XHQgKiBAcGFyYW0ge2FueVtdfSBwYXJhbXMgLSBPcHRpb25zIHBhc3NlZCB0byBjb25zdHJ1Y3RvclxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGNyZWF0ZSguLi5wYXJhbXM6IFJlYWRvbmx5QXJyYXk8YW55Pik6IFJHTCB7XHJcblx0XHRcdGRlYnVnKGBSR0wuY3JlYXRlYCk7XHJcblx0XHRcdFxyXG5cdFx0XHRyZXR1cm4gbmV3IFJHTCguLi5wYXJhbXMpO1xyXG5cdFx0fSAvL2NyZWF0ZVxyXG5cdFx0XHJcblx0fSAvL1JHTFxyXG5cdFxyXG59IC8vcmdsXHJcblxyXG5leHBvcnQgZGVmYXVsdCByZ2w7XHJcbiJdfQ==