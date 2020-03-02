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
const chalk_1 = tslib_1.__importDefault(require("chalk"));
const string_decoder_1 = require("string_decoder");
const debug = util.debuglog("RGL"), debug_v = util.debuglog("RGLv"), debug_e = util.debuglog("RGLe"), voidfn = () => { };
var rgl;
(function (rgl) {
    debug("RGL loaded.");
    const _mappings_c = require(path.resolve(__dirname, "..", "..", "RGLMappings_c.js")), _mappings_b = require(path.resolve(__dirname, "..", "..", "RGLMappings_b.js"));
    /**
     * Container of Errors.
     */
    let Errors;
    (function (Errors) {
        Errors.ENOBIN = new TypeError("Buffer is not binary.");
        Errors.ENOBUF = new TypeError("Not a Buffer.");
        Errors.EBADBUF = new RangeError("Bad data, Wrong size or format.");
        Errors.EBADTPYE = new TypeError("Bad parameter type.");
    })(Errors = rgl.Errors || (rgl.Errors = {})); //Errors
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile {
        constructor(origin) {
            this.origin = origin;
            this.precalc = "";
            assert.ok(origin.length == 8, Errors.EBADBUF);
            this.precalc = RGLTile.decoder.write(origin.slice(0, 4)).replace(RGLTile.trim, ''); // TODO: Colors!
        } //ctor
        serialize() {
            return Buffer.allocUnsafe(0);
        } //serialize
        static parse(chunk) {
            return new RGLTile(chunk);
        } //parse
    } //RGLTile
    RGLTile.decoder = new string_decoder_1.StringDecoder("utf8");
    RGLTile.trim = /\u0000/gim;
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
        } //ctor
        serialize() {
            return Buffer.allocUnsafe(0);
        } //serialize
        /**
         * Store 'T' to writable 'file'.
         *
         * @param {string} file - Target file
         */
        serializeFile(file = this._fromFile) {
            return Buffer.allocUnsafe(0);
        } //serializeFile
        static parse(data) {
            debug(`RGLMap.parse`);
            assert.ok(Buffer.isBuffer(data), Errors.ENOBUF);
            assert.ok(Buffer.isEncoding("binary"), Errors.ENOBIN);
            assert.ok(data.length >= 9, Errors.EBADBUF);
            const map = new RGLMap(data.slice(0, 3), data.slice(7, 9));
            let idx = 9;
            while (idx < data.length && !data.slice(idx, idx + 5).equals(RGLMap.MAGIC))
                map.tiles.push(RGLTile.parse(data.slice(idx, idx += 8)));
            if (idx != data.length)
                map.trailing = data.slice(idx + 5);
            return map;
        } //parse
        /**
         * Read Buffer from 'file'.
         *
         * @param {string} file - Target file
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
                            mode: fs.constants.S_IRUSR | fs.constants.S_IRGRP | fs.constants.S_IXUSR,
                            emitClose: true
                        })
                            .once("readable", async () => {
                            debug_v(`RGLMap.parseFile: ${file} -> Readable.`);
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
    } //RGLMap
    RGLMap.MAGIC = Buffer.from([0x03, 0x00, 0x00, 0x00, 0x01]);
    /**
     * Responsible for controlling transitions and settings.
     */
    class RGL {
        constructor(autoconfig = true, mappings_c = _mappings_c, mappings_b = _mappings_b, _Map = RGLMap, _Tile = RGLTile) {
            this.mappings_c = mappings_c;
            this.mappings_b = mappings_b;
            this._Map = _Map;
            this._Tile = _Tile;
            if (!chalk_1.default.supportsColor)
                console.warn("Terminal colors are not supported!");
            this.mappings_c = new Map(mappings_c);
            if (autoconfig) {
                Promise.all([
                    this.loadMappings_c(),
                    this.loadMappings_b()
                ]).catch(() => debug_e("RGL.autoconf: EMAPPING"));
            }
        } //ctor
        loadMappings_c(map = "RGLMappings_c.js") {
            return this.loadMappings(map, this.mappings_c);
        } //loadMappings_c
        loadMappings_b(map = "RGLMappings_b.js") {
            return this.loadMappings(map, this.mappings_b);
        } //loadMappings_c
        /**
         * Include custom mappings.
         *
         * @param {string | Map.<number, Mapping>} map - Load new mappings
         * @param {Map.<number, Mapping>} orig - Mappings to override
         */
        async loadMappings(map, orig) {
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
         * Start an instance of RGL.
         *
         * @param {any[]} params - Options passed to constructor
         */
        static create(...params) {
            return new RGL(...params);
        } //create
    } //RGL
    rgl.RGL = RGL;
})(rgl = exports.rgl || (exports.rgl = {})); //RGL
exports.default = rgl;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmdsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3JnbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUgsWUFBWSxDQUFDOzs7QUFFYixtREFBNkI7QUFDN0IscURBQStCO0FBQy9CLHVEQUFpQztBQUNqQyxtREFBNkI7QUFDN0IsMERBQTBCO0FBQzFCLG1EQUErQztBQUUvQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUNqQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFDL0IsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQy9CLE1BQU0sR0FBZSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFaEMsSUFBYyxHQUFHLENBeVBoQjtBQXpQRCxXQUFjLEdBQUc7SUFDaEIsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBR3JCLE1BQU0sV0FBVyxHQUF5QixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLEVBQ3pHLFdBQVcsR0FBeUIsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxDQUFDO0lBR3RHOztPQUVHO0lBQ0gsSUFBaUIsTUFBTSxDQUt0QjtJQUxELFdBQWlCLE1BQU07UUFDVCxhQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUNoRCxhQUFNLEdBQUcsSUFBSSxTQUFTLENBQUMsZUFBZSxDQUFDLENBQUM7UUFDeEMsY0FBTyxHQUFHLElBQUksVUFBVSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7UUFDNUQsZUFBUSxHQUFHLElBQUksU0FBUyxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFD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TUFBTSxJQUFJLEdBQXlCLE9BQU8sQ0FBQyxHQUFHLENBQUMsQ0FBQztnQkFFaEQsS0FBSyxJQUFJLEdBQUcsSUFBSSxJQUFJO29CQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQy9DO2lCQUFNLElBQUksR0FBRyxZQUFZLEdBQUcsRUFBRTtnQkFDOUIsS0FBSyxJQUFJLEdBQUcsSUFBSSxHQUFHO29CQUFFLElBQUksQ0FBQyxHQUFHLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2FBQzlDOztnQkFBTSxNQUFNLE1BQU0sQ0FBQyxRQUFRLENBQUM7WUFFN0IsT0FBTyxJQUFJLENBQUM7UUFDYixDQUFDLENBQUMsY0FBYztRQUVoQjs7OztXQUlHO1FBQ0ksTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQTBCO1lBQ2pELE9BQU8sSUFBSSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztRQUMzQixDQUFDLENBQUMsUUFBUTtLQUVWLENBQUMsS0FBSztJQWxFTSxPQUFHLE1Ba0VmLENBQUE7QUFFRixDQUFDLEVBelBhLEdBQUcsR0FBSCxXQUFHLEtBQUgsV0FBRyxRQXlQaEIsQ0FBQyxLQUFLO0FBRVAsa0JBQWUsR0FBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEBhdXRob3IgVi4gSC5cclxuICogQGZpbGUgcmdsLnRzXHJcbiAqIEBzaW5jZSAyMDIwXHJcbiAqL1xyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gXCJ1dGlsXCI7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gXCJmcy1leHRyYVwiO1xyXG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSBcImFzc2VydFwiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIjtcclxuaW1wb3J0IHsgU3RyaW5nRGVjb2RlciB9IGZyb20gXCJzdHJpbmdfZGVjb2RlclwiO1xyXG5cclxuY29uc3QgZGVidWcgPSB1dGlsLmRlYnVnbG9nKFwiUkdMXCIpLFxyXG5cdGRlYnVnX3YgPSB1dGlsLmRlYnVnbG9nKFwiUkdMdlwiKSxcclxuXHRkZWJ1Z19lID0gdXRpbC5kZWJ1Z2xvZyhcIlJHTGVcIiksXHJcblx0dm9pZGZuOiAoKSA9PiB2b2lkID0gKCkgPT4geyB9O1xyXG5cclxuZXhwb3J0IG1vZHVsZSByZ2wge1xyXG5cdGRlYnVnKFwiUkdMIGxvYWRlZC5cIik7XHJcblxyXG5cclxuXHRjb25zdCBfbWFwcGluZ3NfYzogTWFwPG51bWJlciwgTWFwcGluZz4gPSByZXF1aXJlKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi5cIiwgXCIuLlwiLCBcIlJHTE1hcHBpbmdzX2MuanNcIikpLFxyXG5cdFx0X21hcHBpbmdzX2I6IE1hcDxudW1iZXIsIE1hcHBpbmc+ID0gcmVxdWlyZShwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uXCIsIFwiLi5cIiwgXCJSR0xNYXBwaW5nc19iLmpzXCIpKTtcclxuXHRcclxuXHJcblx0LyoqXHJcblx0ICogQ29udGFpbmVyIG9mIEVycm9ycy5cclxuXHQgKi9cclxuXHRleHBvcnQgbmFtZXNwYWNlIEVycm9ycyB7XHJcblx0XHRleHBvcnQgY29uc3QgRU5PQklOID0gbmV3IFR5cGVFcnJvcihcIkJ1ZmZlciBpcyBub3QgYmluYXJ5LlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFTk9CVUYgPSBuZXcgVHlwZUVycm9yKFwiTm90IGEgQnVmZmVyLlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEQlVGID0gbmV3IFJhbmdlRXJyb3IoXCJCYWQgZGF0YSwgV3Jvbmcgc2l6ZSBvciBmb3JtYXQuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURUUFlFID0gbmV3IFR5cGVFcnJvcihcIkJhZCBwYXJhbWV0ZXIgdHlwZS5cIik7XHJcblx0fSAvL0Vycm9yc1xyXG5cclxuXHQvKipcclxuXHQgKiBDb250YWluZXIgb2YgQURUIGNvbnRyYWN0cy5cclxuXHQgKi9cclxuXHRleHBvcnQgbmFtZXNwYWNlIFR5cGVzIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFueXRoaW5nIHRoYXQgY2FuIGJlIHNlcmlhbGl6ZWQgYW5kIHBhcnNlZC5cclxuXHRcdCAqL1xyXG5cdFx0ZXhwb3J0IGludGVyZmFjZSBDb252ZXJ0YWJsZSB7XHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBDb252ZXJ0ICdUJyB0byB3cml0YWJsZSBCdWZmZXIuXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRzZXJpYWxpemUoKTogQnVmZmVyO1xyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogQ29udmVydCBCdWZmZXIgdG8gJ1QnLlxyXG5cdFx0XHQgKiBcclxuXHRcdFx0ICogQHBhcmFtIHshQnVmZmVyfSBkYXRhIC0gU3RyaWN0bHkgYSBiaW5hcnkgYnVmZmVyXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRwYXJzZT8oZGF0YTogUmVhZG9ubHk8QnVmZmVyPik6IENvbnZlcnRhYmxlO1xyXG5cdFx0fSAvL0NvbnZlcnRhYmxlXHJcblxyXG5cdH0gLy9UeXBlc1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogJ0NsYXNzJyB0eXBlLlxyXG5cdCAqL1xyXG5cdHR5cGUgQ2xhc3M8VD4gPSBuZXcgKC4uLmFyZ3M6IGFueVtdKSA9PiBUO1xyXG5cdC8qKlxyXG5cdCAqICdNYXBwaW5nJyB0eXBlLlxyXG5cdCAqL1xyXG5cdGV4cG9ydCB0eXBlIE1hcHBpbmcgPSAodGV4dDogc3RyaW5nKSA9PiBzdHJpbmc7XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBSZXNwb25zaWJsZSBmb3IgcmVwcmVzZW50aW5nIENodW5rcy5cclxuXHQgKi9cclxuXHRjbGFzcyBSR0xUaWxlIGltcGxlbWVudHMgVHlwZXMuQ29udmVydGFibGUge1xyXG5cclxuXHRcdHB1YmxpYyBzdGF0aWMgZGVjb2RlcjogU3RyaW5nRGVjb2RlciA9IG5ldyBTdHJpbmdEZWNvZGVyKFwidXRmOFwiKTtcclxuXHRcdHByaXZhdGUgc3RhdGljIHRyaW06IFJlZ0V4cCA9IC9cXHUwMDAwL2dpbTtcclxuXHJcblx0XHRwcm90ZWN0ZWQgcHJlY2FsYzogc3RyaW5nID0gXCJcIjtcclxuXHJcblxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKHByb3RlY3RlZCByZWFkb25seSBvcmlnaW46IFJlYWRvbmx5PEJ1ZmZlcj4pIHtcclxuXHRcdFx0YXNzZXJ0Lm9rKG9yaWdpbi5sZW5ndGggPT0gOCwgRXJyb3JzLkVCQURCVUYpO1xyXG5cclxuXHRcdFx0dGhpcy5wcmVjYWxjID0gUkdMVGlsZS5kZWNvZGVyLndyaXRlKG9yaWdpbi5zbGljZSgwLCA0KSkucmVwbGFjZShSR0xUaWxlLnRyaW0sICcnKTsgIC8vIFRPRE86IENvbG9ycyFcclxuXHRcdH0gLy9jdG9yXHJcblxyXG5cclxuXHRcdHB1YmxpYyBzZXJpYWxpemUoKTogQnVmZmVyIHtcclxuXHRcdFx0cmV0dXJuIEJ1ZmZlci5hbGxvY1Vuc2FmZSgwKTtcclxuXHRcdH0gLy9zZXJpYWxpemVcclxuXHJcblx0XHRwdWJsaWMgc3RhdGljIHBhcnNlKGNodW5rOiBSZWFkb25seTxCdWZmZXI+KTogUkdMVGlsZSB7XHJcblx0XHRcdHJldHVybiBuZXcgUkdMVGlsZShjaHVuayk7XHJcblx0XHR9IC8vcGFyc2VcclxuXHJcblx0fSAvL1JHTFRpbGVcclxuXHJcblx0LyoqXHJcblx0ICogUmVzcG9uc2libGUgZm9yIHBhcnNpbmcgYW5kIHN0cmlwcGluZyBDaHVua3MuXHJcblx0ICovXHJcblx0Y2xhc3MgUkdMTWFwIGltcGxlbWVudHMgVHlwZXMuQ29udmVydGFibGUge1xyXG5cclxuXHRcdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IE1BR0lDOiBCdWZmZXIgPSBCdWZmZXIuZnJvbShbMHgwMywgMHgwMCwgMHgwMCwgMHgwMCwgMHgwMV0pO1xyXG5cclxuXHJcblx0XHRwcm90ZWN0ZWQgY29uc3RydWN0b3IoXHJcblx0XHRcdHByb3RlY3RlZCByZXNlcnZlZDogQnVmZmVyID0gQnVmZmVyLmFsbG9jKDMsIDApLFxyXG5cdFx0XHRwcm90ZWN0ZWQgc2l6ZTogQnVmZmVyID0gQnVmZmVyLmFsbG9jKDIsIDApLFxyXG5cdFx0XHRwcm90ZWN0ZWQgdGlsZXM6IFJHTFRpbGVbXSA9IFtdLFxyXG5cdFx0XHRwcm90ZWN0ZWQgdHJhaWxpbmc6IEJ1ZmZlciA9IEJ1ZmZlci5hbGxvY1Vuc2FmZSgwKSxcclxuXHRcdFx0cHJvdGVjdGVkIF9mcm9tRmlsZTogc3RyaW5nID0gXCJcIlxyXG5cdFx0KSB7XHJcblxyXG5cdFx0fSAvL2N0b3JcclxuXHJcblxyXG5cdFx0cHVibGljIHNlcmlhbGl6ZSgpOiBCdWZmZXIge1xyXG5cdFx0XHRyZXR1cm4gQnVmZmVyLmFsbG9jVW5zYWZlKDApO1xyXG5cdFx0fSAvL3NlcmlhbGl6ZVxyXG5cdFx0LyoqXHJcblx0XHQgKiBTdG9yZSAnVCcgdG8gd3JpdGFibGUgJ2ZpbGUnLlxyXG5cdFx0ICpcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlIC0gVGFyZ2V0IGZpbGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHNlcmlhbGl6ZUZpbGUoZmlsZTogUmVhZG9ubHk8c3RyaW5nPiA9IHRoaXMuX2Zyb21GaWxlKTogQnVmZmVyIHtcclxuXHRcdFx0cmV0dXJuIEJ1ZmZlci5hbGxvY1Vuc2FmZSgwKTtcclxuXHRcdH0gLy9zZXJpYWxpemVGaWxlXHJcblx0XHRcclxuXHRcdHB1YmxpYyBzdGF0aWMgcGFyc2UoZGF0YTogUmVhZG9ubHk8QnVmZmVyPik6IFJHTE1hcCB7XHJcblx0XHRcdGRlYnVnKGBSR0xNYXAucGFyc2VgKTtcclxuXHJcblx0XHRcdGFzc2VydC5vayhCdWZmZXIuaXNCdWZmZXIoZGF0YSksIEVycm9ycy5FTk9CVUYpO1xyXG5cdFx0XHRhc3NlcnQub2soQnVmZmVyLmlzRW5jb2RpbmcoXCJiaW5hcnlcIiksIEVycm9ycy5FTk9CSU4pO1xyXG5cdFx0XHRhc3NlcnQub2soZGF0YS5sZW5ndGggPj0gOSwgRXJyb3JzLkVCQURCVUYpO1xyXG5cclxuXHRcdFx0Y29uc3QgbWFwOiBSR0xNYXAgPSBuZXcgUkdMTWFwKGRhdGEuc2xpY2UoMCwgMyksIGRhdGEuc2xpY2UoNywgOSkpO1xyXG5cclxuXHRcdFx0bGV0IGlkeDogbnVtYmVyID0gOTtcclxuXHJcblx0XHRcdHdoaWxlIChpZHggPCBkYXRhLmxlbmd0aCAmJiAhZGF0YS5zbGljZShpZHgsIGlkeCArIDUpLmVxdWFscyhSR0xNYXAuTUFHSUMpKVxyXG5cdFx0XHRcdG1hcC50aWxlcy5wdXNoKFJHTFRpbGUucGFyc2UoZGF0YS5zbGljZShpZHgsIGlkeCArPSA4KSkpO1xyXG5cclxuXHRcdFx0aWYgKGlkeCAhPSBkYXRhLmxlbmd0aCkgbWFwLnRyYWlsaW5nID0gZGF0YS5zbGljZShpZHggKyA1KTtcclxuXHJcblx0XHRcdHJldHVybiBtYXA7XHJcblx0XHR9IC8vcGFyc2VcclxuXHRcdC8qKlxyXG5cdFx0ICogUmVhZCBCdWZmZXIgZnJvbSAnZmlsZScuXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nfSBmaWxlIC0gVGFyZ2V0IGZpbGVcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBhc3luYyBwYXJzZUZpbGUoZmlsZTogUmVhZG9ubHk8c3RyaW5nPik6IFByb21pc2U8UkdMTWFwPiB7XHJcblx0XHRcdGRlYnVnKGBSR0xNYXAucGFyc2VGaWxlOiAke2ZpbGV9YCk7XHJcblxyXG5cdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoYXN5bmMgKHJlcywgcmVqKSA9PiB7XHJcblx0XHRcdFx0ZGVidWdfdihgUkdMTWFwLnBhcnNlRmlsZTogQUNDRVNTYCk7XHJcblxyXG5cdFx0XHRcdGZzLmFjY2VzcyhmaWxlLCBmcy5jb25zdGFudHMuRl9PSyB8IGZzLmNvbnN0YW50cy5SX09LLCBlcnIgPT4ge1xyXG5cdFx0XHRcdFx0aWYgKGVycikge1xyXG5cdFx0XHRcdFx0XHRkZWJ1Z19lKGBSR0xNYXAucGFyc2VGaWxlOiAke2ZpbGV9IC0+IEVBQ0NFU1NgKTtcclxuXHJcblx0XHRcdFx0XHRcdHJlaihlcnIpO1xyXG5cdFx0XHRcdFx0fSBlbHNlIHtcclxuXHRcdFx0XHRcdFx0ZGVidWdfdihgUkdMTWFwLnBhcnNlRmlsZTogUlNUUkVBTWApO1xyXG5cclxuXHRcdFx0XHRcdFx0Y29uc3Qgc3RyOiBmcy5SZWFkU3RyZWFtID0gZnMuY3JlYXRlUmVhZFN0cmVhbShmaWxlLCB7XHJcblx0XHRcdFx0XHRcdFx0ZmxhZ3M6IFwiclwiLFxyXG5cdFx0XHRcdFx0XHRcdGVuY29kaW5nOiBcImJpbmFyeVwiLFxyXG5cdFx0XHRcdFx0XHRcdG1vZGU6IGZzLmNvbnN0YW50cy5TX0lSVVNSIHwgZnMuY29uc3RhbnRzLlNfSVJHUlAgfCBmcy5jb25zdGFudHMuU19JWFVTUixcclxuXHRcdFx0XHRcdFx0XHRlbWl0Q2xvc2U6IHRydWVcclxuXHRcdFx0XHRcdFx0fSlcclxuXHRcdFx0XHRcdFx0Lm9uY2UoXCJyZWFkYWJsZVwiLCBhc3luYyAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0ZGVidWdfdihgUkdMTWFwLnBhcnNlRmlsZTogJHtmaWxlfSAtPiBSZWFkYWJsZS5gKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0bGV0IGRhdGE6IHN0cmluZyA9ICcnO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRzdHIuc2V0RW5jb2RpbmcoXCJiaW5hcnlcIik7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGZvciBhd2FpdCAobGV0IGNodW5rIG9mIHN0cikgZGF0YSArPSBjaHVuaztcclxuXHRcdFx0XHRcdFx0XHRcclxuXHRcdFx0XHRcdFx0XHRzdHIub25jZShcImNsb3NlXCIsICgpID0+IHtcclxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IG1hcDogUkdMTWFwID0gUkdMTWFwLnBhcnNlKEJ1ZmZlci5mcm9tKGRhdGEsIFwiYmluYXJ5XCIpKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRtYXAuX2Zyb21GaWxlID0gZmlsZTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRyZXMobWFwKTtcclxuXHRcdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSAvL3BhcnNlRmlsZVxyXG5cclxuXHR9IC8vUkdMTWFwXHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlc3BvbnNpYmxlIGZvciBjb250cm9sbGluZyB0cmFuc2l0aW9ucyBhbmQgc2V0dGluZ3MuXHJcblx0ICovXHJcblx0ZXhwb3J0IGNsYXNzIFJHTCB7XHJcblxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxyXG5cdFx0XHRhdXRvY29uZmlnOiBib29sZWFuID0gdHJ1ZSxcclxuXHRcdFx0cHVibGljIG1hcHBpbmdzX2M6IE1hcDxudW1iZXIsIE1hcHBpbmc+ID0gX21hcHBpbmdzX2MsXHJcblx0XHRcdHB1YmxpYyBtYXBwaW5nc19iOiBNYXA8bnVtYmVyLCBNYXBwaW5nPiA9IF9tYXBwaW5nc19iLFxyXG5cdFx0XHRwdWJsaWMgX01hcDogdHlwZW9mIFJHTE1hcCA9IFJHTE1hcCxcclxuXHRcdFx0cHVibGljIF9UaWxlOiB0eXBlb2YgUkdMVGlsZSA9IFJHTFRpbGVcclxuXHJcblx0XHQpIHtcclxuXHRcdFx0aWYgKCFjaGFsay5zdXBwb3J0c0NvbG9yKSBjb25zb2xlLndhcm4oXCJUZXJtaW5hbCBjb2xvcnMgYXJlIG5vdCBzdXBwb3J0ZWQhXCIpO1xyXG5cclxuXHRcdFx0dGhpcy5tYXBwaW5nc19jID0gbmV3IE1hcDxudW1iZXIsIE1hcHBpbmc+KG1hcHBpbmdzX2MpO1xyXG5cclxuXHRcdFx0aWYgKGF1dG9jb25maWcpIHtcclxuXHRcdFx0XHRQcm9taXNlLmFsbChbXHJcblx0XHRcdFx0XHR0aGlzLmxvYWRNYXBwaW5nc19jKCksXHJcblx0XHRcdFx0XHR0aGlzLmxvYWRNYXBwaW5nc19iKClcclxuXHRcdFx0XHRdKS5jYXRjaCgoKSA9PiBkZWJ1Z19lKFwiUkdMLmF1dG9jb25mOiBFTUFQUElOR1wiKSk7XHJcblx0XHRcdH1cclxuXHRcdH0gLy9jdG9yXHJcblxyXG5cclxuXHRcdHB1YmxpYyBhc3luYyBsb2FkTWFwcGluZ3NfYyhwYXRoPzogUmVhZG9ubHk8c3RyaW5nPik6IFByb21pc2U8TWFwPG51bWJlciwgTWFwcGluZz4+O1xyXG5cdFx0cHVibGljIGxvYWRNYXBwaW5nc19jKG1hcD86IFJlYWRvbmx5PE1hcDxudW1iZXIsIE1hcHBpbmc+Pik6IFByb21pc2U8TWFwPG51bWJlciwgTWFwcGluZz4+O1xyXG5cdFx0cHVibGljIGxvYWRNYXBwaW5nc19jKG1hcDogUmVhZG9ubHk8c3RyaW5nIHwgTWFwPG51bWJlciwgTWFwcGluZz4+ID0gXCJSR0xNYXBwaW5nc19jLmpzXCIpOiBQcm9taXNlPE1hcDxudW1iZXIsIE1hcHBpbmc+PiB7XHJcblx0XHRcdHJldHVybiB0aGlzLmxvYWRNYXBwaW5ncyhtYXAsIHRoaXMubWFwcGluZ3NfYyk7XHJcblx0XHR9IC8vbG9hZE1hcHBpbmdzX2NcclxuXHJcblx0XHRwdWJsaWMgYXN5bmMgbG9hZE1hcHBpbmdzX2IocGF0aD86IFJlYWRvbmx5PHN0cmluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIE1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYihtYXA/OiBSZWFkb25seTxNYXA8bnVtYmVyLCBNYXBwaW5nPj4pOiBQcm9taXNlPE1hcDxudW1iZXIsIE1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYihtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIE1hcHBpbmc+PiA9IFwiUkdMTWFwcGluZ3NfYi5qc1wiKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBNYXBwaW5nPj4ge1xyXG5cdFx0XHRyZXR1cm4gdGhpcy5sb2FkTWFwcGluZ3MobWFwLCB0aGlzLm1hcHBpbmdzX2IpO1xyXG5cdFx0fSAvL2xvYWRNYXBwaW5nc19jXHJcblx0XHRcclxuXHRcdC8qKlxyXG5cdFx0ICogSW5jbHVkZSBjdXN0b20gbWFwcGluZ3MuXHJcblx0XHQgKiBcclxuXHRcdCAqIEBwYXJhbSB7c3RyaW5nIHwgTWFwLjxudW1iZXIsIE1hcHBpbmc+fSBtYXAgLSBMb2FkIG5ldyBtYXBwaW5nc1xyXG5cdFx0ICogQHBhcmFtIHtNYXAuPG51bWJlciwgTWFwcGluZz59IG9yaWcgLSBNYXBwaW5ncyB0byBvdmVycmlkZVxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgYXN5bmMgbG9hZE1hcHBpbmdzKG1hcDogUmVhZG9ubHk8c3RyaW5nIHwgTWFwPG51bWJlciwgTWFwcGluZz4+LCBvcmlnOiBNYXA8bnVtYmVyLCBNYXBwaW5nPik6IFByb21pc2U8TWFwPG51bWJlciwgTWFwcGluZz4+IHtcclxuXHRcdFx0ZGVidWcoXCJSR0wubG9hZE1hcHBpbmdzOlwiLCB1dGlsLmluc3BlY3Qob3JpZywgeyBicmVha0xlbmd0aDogSW5maW5pdHkgfSkpO1xyXG5cclxuXHRcdFx0aWYgKHR5cGVvZiBtYXAgPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRkZWxldGUgcmVxdWlyZS5jYWNoZVtyZXF1aXJlLnJlc29sdmUobWFwKV07XHJcblxyXG5cdFx0XHRcdGNvbnN0IGRhdGE6IE1hcDxudW1iZXIsIE1hcHBpbmc+ID0gcmVxdWlyZShtYXApO1xyXG5cclxuXHRcdFx0XHRmb3IgKGxldCBzaWcgb2YgZGF0YSkgb3JpZy5zZXQoc2lnWzBdLCBzaWdbMV0pO1xyXG5cdFx0XHR9IGVsc2UgaWYgKG1hcCBpbnN0YW5jZW9mIE1hcCkge1xyXG5cdFx0XHRcdGZvciAobGV0IHNpZyBvZiBtYXApIG9yaWcuc2V0KHNpZ1swXSwgc2lnWzFdKTtcclxuXHRcdFx0fSBlbHNlIHRocm93IEVycm9ycy5FQkFEVFBZRTtcclxuXHJcblx0XHRcdHJldHVybiBvcmlnO1xyXG5cdFx0fSAvL2xvYWRNYXBwaW5nc1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RhcnQgYW4gaW5zdGFuY2Ugb2YgUkdMLlxyXG5cdFx0ICogXHJcblx0XHQgKiBAcGFyYW0ge2FueVtdfSBwYXJhbXMgLSBPcHRpb25zIHBhc3NlZCB0byBjb25zdHJ1Y3RvclxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGNyZWF0ZSguLi5wYXJhbXM6IFJlYWRvbmx5QXJyYXk8YW55Pik6IFJHTCB7XHJcblx0XHRcdHJldHVybiBuZXcgUkdMKC4uLnBhcmFtcyk7XHJcblx0XHR9IC8vY3JlYXRlXHJcblxyXG5cdH0gLy9SR0xcclxuXHJcbn0gLy9SR0xcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHJnbDtcclxuIl19