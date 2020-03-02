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
    })(Errors = rgl.Errors || (rgl.Errors = {})); //Errors
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile {
        constructor(origin) {
            this.origin = origin;
            this.precalc = "";
            assert.ok(origin.length == 8, Errors.EBADBUF);
            this.precalc = (RGLTile.mappings_s.get(origin[6]) || (t => t))((RGLTile.mappings_b.get(origin[5]) || (t => t))((RGLTile.mappings_c.get(origin[4]) || (t => t))(RGLTile.decoder.write(origin.slice(0, 4)).replace(RGLTile.trim, ''))));
            this.reserved = origin[7];
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
                ]).catch(() => debug_e("RGL.autoconf: EMAPPING")).then(() => {
                    this._Tile.mappings_c = this.mappings_c;
                    this._Tile.mappings_b = this.mappings_b;
                    debug("RGL.ctor deffered mappings.");
                });
            }
            this._Tile.mappings_c = this.mappings_c;
            this._Tile.mappings_b = this.mappings_b;
            this._Tile.mappings_s = RGL.mappings_s;
        } //ctor
        loadMappings_c(map = "RGLMappings_c.js") {
            return RGL.loadMappings(map, this.mappings_c);
        } //loadMappings_c
        loadMappings_b(map = "RGLMappings_b.js") {
            return RGL.loadMappings(map, this.mappings_b);
        } //loadMappings_c
        /**
         * Include custom mappings.
         *
         * @param {string | Map.<number, Mapping>} map - Load new mappings
         * @param {Map.<number, Mapping>} orig - Mappings to override
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
         * Start an instance of RGL.
         *
         * @param {any[]} params - Options passed to constructor
         */
        static create(...params) {
            return new RGL(...params);
        } //create
    } //RGL
    RGL.mappings_s = _mappings_s;
    rgl.RGL = RGL;
})(rgl = exports.rgl || (exports.rgl = {})); //rgl
exports.default = rgl;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmdsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3JnbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUgsWUFBWSxDQUFDOzs7QUFFYixtREFBNkI7QUFDN0IscURBQStCO0FBQy9CLHVEQUFpQztBQUNqQyxtREFBNkI7QUFDN0IsMERBQTBCO0FBQzFCLG1EQUErQztBQUUvQyxNQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUNqQyxPQUFPLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFDL0IsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQy9CLE1BQU0sR0FBZSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7QUFFaEMsSUFBYyxHQUFHLENBMlFoQjtBQTNRRCxXQUFjLEdBQUc7SUFDaEIsS0FBSyxDQUFDLGFBQWEsQ0FBQyxDQUFDO0lBR3JCLE1BQU0sV0FBVyxHQUF5QixPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLEVBQ3pHLFdBQVcsR0FBeUIsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLElBQUksRUFBRSxJQUFJLEVBQUUsa0JBQWtCLENBQUMsQ0FBQyxFQUNwRyxXQUFXLEdBQTRCLE9BQU8sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixDQUFDLENBQUMsQ0FBQztJQUd6Rzs7T0FFRztJQUNILElBQWlCLE1BQU0sQ0FLdEI7SUFMRCxXQUFpQixNQUFNO1FBQ1QsYUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDaEQsYUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3hD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QUksR0FBRyxJQUFJLElBQUk7b0JBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDL0M7aUJBQU0sSUFBSSxHQUFHLFlBQVksR0FBRyxFQUFFO2dCQUM5QixLQUFLLElBQUksR0FBRyxJQUFJLEdBQUc7b0JBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7YUFDOUM7O2dCQUFNLE1BQU0sTUFBTSxDQUFDLFFBQVEsQ0FBQztZQUU3QixPQUFPLElBQUksQ0FBQztRQUNiLENBQUMsQ0FBQyxjQUFjO1FBRWhCOzs7O1dBSUc7UUFDSSxNQUFNLENBQUMsTUFBTSxDQUFDLEdBQUcsTUFBMEI7WUFDakQsT0FBTyxJQUFJLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDO1FBQzNCLENBQUMsQ0FBQyxRQUFRO01BRVQsS0FBSztJQTVFVyxjQUFVLEdBQXlCLFdBQVcsQ0FBQztJQUZwRCxPQUFHLE1BOEVmLENBQUE7QUFFRixDQUFDLEVBM1FhLEdBQUcsR0FBSCxXQUFHLEtBQUgsV0FBRyxRQTJRaEIsQ0FBQyxLQUFLO0FBRVAsa0JBQWUsR0FBRyxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyoqXHJcbiAqIEBhdXRob3IgVi4gSC5cclxuICogQGZpbGUgcmdsLnRzXHJcbiAqIEBzaW5jZSAyMDIwXHJcbiAqL1xyXG5cclxuXCJ1c2Ugc3RyaWN0XCI7XHJcblxyXG5pbXBvcnQgKiBhcyB1dGlsIGZyb20gXCJ1dGlsXCI7XHJcbmltcG9ydCAqIGFzIGZzIGZyb20gXCJmcy1leHRyYVwiO1xyXG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSBcImFzc2VydFwiO1xyXG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gXCJwYXRoXCI7XHJcbmltcG9ydCBjaGFsayBmcm9tIFwiY2hhbGtcIjtcclxuaW1wb3J0IHsgU3RyaW5nRGVjb2RlciB9IGZyb20gXCJzdHJpbmdfZGVjb2RlclwiO1xyXG5cclxuY29uc3QgZGVidWcgPSB1dGlsLmRlYnVnbG9nKFwiUkdMXCIpLFxyXG5cdGRlYnVnX3YgPSB1dGlsLmRlYnVnbG9nKFwiUkdMdlwiKSxcclxuXHRkZWJ1Z19lID0gdXRpbC5kZWJ1Z2xvZyhcIlJHTGVcIiksXHJcblx0dm9pZGZuOiAoKSA9PiB2b2lkID0gKCkgPT4geyB9O1xyXG5cclxuZXhwb3J0IG1vZHVsZSByZ2wge1xyXG5cdGRlYnVnKFwiUkdMIGxvYWRlZC5cIik7XHJcblxyXG5cclxuXHRjb25zdCBfbWFwcGluZ3NfYzogTWFwPG51bWJlciwgTWFwcGluZz4gPSByZXF1aXJlKHBhdGgucmVzb2x2ZShfX2Rpcm5hbWUsIFwiLi5cIiwgXCIuLlwiLCBcIlJHTE1hcHBpbmdzX2MuanNcIikpLFxyXG5cdFx0X21hcHBpbmdzX2I6IE1hcDxudW1iZXIsIE1hcHBpbmc+ID0gcmVxdWlyZShwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4uXCIsIFwiLi5cIiwgXCJSR0xNYXBwaW5nc19iLmpzXCIpKSxcclxuXHRcdF9tYXBwaW5nc19zOiBNYXAgPCBudW1iZXIsIE1hcHBpbmcgPiA9IHJlcXVpcmUocGF0aC5yZXNvbHZlKF9fZGlybmFtZSwgXCIuLlwiLCBcIi4uXCIsIFwiUkdMTWFwcGluZ3Nfcy5qc1wiKSk7XHJcblx0XHJcblxyXG5cdC8qKlxyXG5cdCAqIENvbnRhaW5lciBvZiBFcnJvcnMuXHJcblx0ICovXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBFcnJvcnMge1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVOT0JJTiA9IG5ldyBUeXBlRXJyb3IoXCJCdWZmZXIgaXMgbm90IGJpbmFyeS5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRU5PQlVGID0gbmV3IFR5cGVFcnJvcihcIk5vdCBhIEJ1ZmZlci5cIik7XHJcblx0XHRleHBvcnQgY29uc3QgRUJBREJVRiA9IG5ldyBSYW5nZUVycm9yKFwiQmFkIGRhdGEsIFdyb25nIHNpemUgb3IgZm9ybWF0LlwiKTtcclxuXHRcdGV4cG9ydCBjb25zdCBFQkFEVFBZRSA9IG5ldyBUeXBlRXJyb3IoXCJCYWQgcGFyYW1ldGVyIHR5cGUuXCIpO1xyXG5cdH0gLy9FcnJvcnNcclxuXHJcblx0LyoqXHJcblx0ICogQ29udGFpbmVyIG9mIEFEVCBjb250cmFjdHMuXHJcblx0ICovXHJcblx0ZXhwb3J0IG5hbWVzcGFjZSBUeXBlcyB7XHJcblxyXG5cdFx0LyoqXHJcblx0XHQgKiBBbnl0aGluZyB0aGF0IGNhbiBiZSBzZXJpYWxpemVkIGFuZCBwYXJzZWQuXHJcblx0XHQgKi9cclxuXHRcdGV4cG9ydCBpbnRlcmZhY2UgQ29udmVydGFibGUge1xyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogQ29udmVydCAnVCcgdG8gd3JpdGFibGUgQnVmZmVyLlxyXG5cdFx0XHQgKi9cclxuXHRcdFx0c2VyaWFsaXplKCk6IEJ1ZmZlcjtcclxuXHRcdFx0LyoqXHJcblx0XHRcdCAqIENvbnZlcnQgQnVmZmVyIHRvICdUJy5cclxuXHRcdFx0ICogXHJcblx0XHRcdCAqIEBwYXJhbSB7IUJ1ZmZlcn0gZGF0YSAtIFN0cmljdGx5IGEgYmluYXJ5IGJ1ZmZlclxyXG5cdFx0XHQgKi9cclxuXHRcdFx0cGFyc2U/KGRhdGE6IFJlYWRvbmx5PEJ1ZmZlcj4pOiBDb252ZXJ0YWJsZTtcclxuXHRcdH0gLy9Db252ZXJ0YWJsZVxyXG5cclxuXHR9IC8vVHlwZXNcclxuXHJcblxyXG5cdC8qKlxyXG5cdCAqICdDbGFzcycgdHlwZS5cclxuXHQgKi9cclxuXHR0eXBlIENsYXNzPFQ+ID0gbmV3ICguLi5hcmdzOiBhbnlbXSkgPT4gVDtcclxuXHQvKipcclxuXHQgKiAnTWFwcGluZycgdHlwZS5cclxuXHQgKi9cclxuXHRleHBvcnQgdHlwZSBNYXBwaW5nID0gKHRleHQ6IHN0cmluZykgPT4gc3RyaW5nO1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogUmVzcG9uc2libGUgZm9yIHJlcHJlc2VudGluZyBDaHVua3MuXHJcblx0ICovXHJcblx0Y2xhc3MgUkdMVGlsZSBpbXBsZW1lbnRzIFR5cGVzLkNvbnZlcnRhYmxlIHtcclxuXHJcblx0XHRwdWJsaWMgc3RhdGljIGRlY29kZXI6IFN0cmluZ0RlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihcInV0ZjhcIik7XHJcblx0XHRzdGF0aWMgbWFwcGluZ3NfYzogTWFwPG51bWJlciwgTWFwcGluZz47XHJcblx0XHRzdGF0aWMgbWFwcGluZ3NfYjogTWFwPG51bWJlciwgTWFwcGluZz47XHJcblx0XHRzdGF0aWMgbWFwcGluZ3NfczogTWFwPG51bWJlciwgTWFwcGluZz47XHJcblx0XHRwcml2YXRlIHN0YXRpYyB0cmltOiBSZWdFeHAgPSAvXFx1MDAwMC9naW07XHJcblxyXG5cdFx0cHJvdGVjdGVkIHByZWNhbGM6IHN0cmluZyA9IFwiXCI7XHJcblx0XHRwcml2YXRlIHJlc2VydmVkOiBudW1iZXI7XHJcblxyXG5cclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgcmVhZG9ubHkgb3JpZ2luOiBSZWFkb25seTxCdWZmZXI+KSB7XHJcblx0XHRcdGFzc2VydC5vayhvcmlnaW4ubGVuZ3RoID09IDgsIEVycm9ycy5FQkFEQlVGKTtcclxuXHJcblx0XHRcdHRoaXMucHJlY2FsYyA9IChSR0xUaWxlLm1hcHBpbmdzX3MuZ2V0KG9yaWdpbls2XSkgfHwgKHQgPT4gdCkpKChSR0xUaWxlLm1hcHBpbmdzX2IuZ2V0KG9yaWdpbls1XSkgfHwgKHQgPT4gdCkpKChSR0xUaWxlLm1hcHBpbmdzX2MuZ2V0KG9yaWdpbls0XSkgfHwgKHQgPT4gdCkpKFJHTFRpbGUuZGVjb2Rlci53cml0ZShvcmlnaW4uc2xpY2UoMCwgNCkpLnJlcGxhY2UoUkdMVGlsZS50cmltLCAnJykpKSk7XHJcblx0XHRcdHRoaXMucmVzZXJ2ZWQgPSBvcmlnaW5bN107XHJcblx0XHR9IC8vY3RvclxyXG5cclxuXHJcblx0XHRwdWJsaWMgc2VyaWFsaXplKCk6IEJ1ZmZlciB7XHJcblx0XHRcdHJldHVybiBCdWZmZXIuYWxsb2NVbnNhZmUoMCk7XHJcblx0XHR9IC8vc2VyaWFsaXplXHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyBwYXJzZShjaHVuazogUmVhZG9ubHk8QnVmZmVyPik6IFJHTFRpbGUge1xyXG5cdFx0XHRyZXR1cm4gbmV3IFJHTFRpbGUoY2h1bmspO1xyXG5cdFx0fSAvL3BhcnNlXHJcblxyXG5cdH0gLy9SR0xUaWxlXHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlc3BvbnNpYmxlIGZvciBwYXJzaW5nIGFuZCBzdHJpcHBpbmcgQ2h1bmtzLlxyXG5cdCAqL1xyXG5cdGNsYXNzIFJHTE1hcCBpbXBsZW1lbnRzIFR5cGVzLkNvbnZlcnRhYmxlIHtcclxuXHJcblx0XHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBNQUdJQzogQnVmZmVyID0gQnVmZmVyLmZyb20oWzB4MDMsIDB4MDAsIDB4MDAsIDB4MDAsIDB4MDFdKTtcclxuXHJcblxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKFxyXG5cdFx0XHRwcm90ZWN0ZWQgcmVzZXJ2ZWQ6IEJ1ZmZlciA9IEJ1ZmZlci5hbGxvYygzLCAwKSxcclxuXHRcdFx0cHJvdGVjdGVkIHNpemU6IEJ1ZmZlciA9IEJ1ZmZlci5hbGxvYygyLCAwKSxcclxuXHRcdFx0cHJvdGVjdGVkIHRpbGVzOiBSR0xUaWxlW10gPSBbXSxcclxuXHRcdFx0cHJvdGVjdGVkIHRyYWlsaW5nOiBCdWZmZXIgPSBCdWZmZXIuYWxsb2NVbnNhZmUoMCksXHJcblx0XHRcdHByb3RlY3RlZCBfZnJvbUZpbGU6IHN0cmluZyA9IFwiXCJcclxuXHRcdCkge1xyXG5cclxuXHRcdH0gLy9jdG9yXHJcblxyXG5cclxuXHRcdHB1YmxpYyBzZXJpYWxpemUoKTogQnVmZmVyIHtcclxuXHRcdFx0cmV0dXJuIEJ1ZmZlci5hbGxvY1Vuc2FmZSgwKTtcclxuXHRcdH0gLy9zZXJpYWxpemVcclxuXHRcdC8qKlxyXG5cdFx0ICogU3RvcmUgJ1QnIHRvIHdyaXRhYmxlICdmaWxlJy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmlsZSAtIFRhcmdldCBmaWxlXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzZXJpYWxpemVGaWxlKGZpbGU6IFJlYWRvbmx5PHN0cmluZz4gPSB0aGlzLl9mcm9tRmlsZSk6IEJ1ZmZlciB7XHJcblx0XHRcdHJldHVybiBCdWZmZXIuYWxsb2NVbnNhZmUoMCk7XHJcblx0XHR9IC8vc2VyaWFsaXplRmlsZVxyXG5cdFx0XHJcblx0XHRwdWJsaWMgc3RhdGljIHBhcnNlKGRhdGE6IFJlYWRvbmx5PEJ1ZmZlcj4pOiBSR0xNYXAge1xyXG5cdFx0XHRkZWJ1ZyhgUkdMTWFwLnBhcnNlYCk7XHJcblxyXG5cdFx0XHRhc3NlcnQub2soQnVmZmVyLmlzQnVmZmVyKGRhdGEpLCBFcnJvcnMuRU5PQlVGKTtcclxuXHRcdFx0YXNzZXJ0Lm9rKEJ1ZmZlci5pc0VuY29kaW5nKFwiYmluYXJ5XCIpLCBFcnJvcnMuRU5PQklOKTtcclxuXHRcdFx0YXNzZXJ0Lm9rKGRhdGEubGVuZ3RoID49IDksIEVycm9ycy5FQkFEQlVGKTtcclxuXHJcblx0XHRcdGNvbnN0IG1hcDogUkdMTWFwID0gbmV3IFJHTE1hcChkYXRhLnNsaWNlKDAsIDMpLCBkYXRhLnNsaWNlKDcsIDkpKTtcclxuXHJcblx0XHRcdGxldCBpZHg6IG51bWJlciA9IDk7XHJcblxyXG5cdFx0XHR3aGlsZSAoaWR4IDwgZGF0YS5sZW5ndGggJiYgIWRhdGEuc2xpY2UoaWR4LCBpZHggKyA1KS5lcXVhbHMoUkdMTWFwLk1BR0lDKSlcclxuXHRcdFx0XHRtYXAudGlsZXMucHVzaChSR0xUaWxlLnBhcnNlKGRhdGEuc2xpY2UoaWR4LCBpZHggKz0gOCkpKTtcclxuXHJcblx0XHRcdGlmIChpZHggIT0gZGF0YS5sZW5ndGgpIG1hcC50cmFpbGluZyA9IGRhdGEuc2xpY2UoaWR4ICsgNSk7XHJcblxyXG5cdFx0XHRyZXR1cm4gbWFwO1xyXG5cdFx0fSAvL3BhcnNlXHJcblx0XHQvKipcclxuXHRcdCAqIFJlYWQgQnVmZmVyIGZyb20gJ2ZpbGUnLlxyXG5cdFx0ICogXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmlsZSAtIFRhcmdldCBmaWxlXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgYXN5bmMgcGFyc2VGaWxlKGZpbGU6IFJlYWRvbmx5PHN0cmluZz4pOiBQcm9taXNlPFJHTE1hcD4ge1xyXG5cdFx0XHRkZWJ1ZyhgUkdMTWFwLnBhcnNlRmlsZTogJHtmaWxlfWApO1xyXG5cclxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKGFzeW5jIChyZXMsIHJlaikgPT4ge1xyXG5cdFx0XHRcdGRlYnVnX3YoYFJHTE1hcC5wYXJzZUZpbGU6IEFDQ0VTU2ApO1xyXG5cclxuXHRcdFx0XHRmcy5hY2Nlc3MoZmlsZSwgZnMuY29uc3RhbnRzLkZfT0sgfCBmcy5jb25zdGFudHMuUl9PSywgZXJyID0+IHtcclxuXHRcdFx0XHRcdGlmIChlcnIpIHtcclxuXHRcdFx0XHRcdFx0ZGVidWdfZShgUkdMTWFwLnBhcnNlRmlsZTogJHtmaWxlfSAtPiBFQUNDRVNTYCk7XHJcblxyXG5cdFx0XHRcdFx0XHRyZWooZXJyKTtcclxuXHRcdFx0XHRcdH0gZWxzZSB7XHJcblx0XHRcdFx0XHRcdGRlYnVnX3YoYFJHTE1hcC5wYXJzZUZpbGU6IFJTVFJFQU1gKTtcclxuXHJcblx0XHRcdFx0XHRcdGNvbnN0IHN0cjogZnMuUmVhZFN0cmVhbSA9IGZzLmNyZWF0ZVJlYWRTdHJlYW0oZmlsZSwge1xyXG5cdFx0XHRcdFx0XHRcdGZsYWdzOiBcInJcIixcclxuXHRcdFx0XHRcdFx0XHRlbmNvZGluZzogXCJiaW5hcnlcIixcclxuXHRcdFx0XHRcdFx0XHRtb2RlOiBmcy5jb25zdGFudHMuU19JUlVTUiB8IGZzLmNvbnN0YW50cy5TX0lSR1JQIHwgZnMuY29uc3RhbnRzLlNfSVhVU1IsXHJcblx0XHRcdFx0XHRcdFx0ZW1pdENsb3NlOiB0cnVlXHJcblx0XHRcdFx0XHRcdH0pXHJcblx0XHRcdFx0XHRcdC5vbmNlKFwicmVhZGFibGVcIiwgYXN5bmMgKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdGRlYnVnX3YoYFJHTE1hcC5wYXJzZUZpbGU6ICR7ZmlsZX0gLT4gUmVhZGFibGUuYCk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdGxldCBkYXRhOiBzdHJpbmcgPSAnJztcclxuXHJcblx0XHRcdFx0XHRcdFx0c3RyLnNldEVuY29kaW5nKFwiYmluYXJ5XCIpO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRmb3IgYXdhaXQgKGxldCBjaHVuayBvZiBzdHIpIGRhdGEgKz0gY2h1bms7XHJcblx0XHRcdFx0XHRcdFx0XHJcblx0XHRcdFx0XHRcdFx0c3RyLm9uY2UoXCJjbG9zZVwiLCAoKSA9PiB7XHJcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBtYXA6IFJHTE1hcCA9IFJHTE1hcC5wYXJzZShCdWZmZXIuZnJvbShkYXRhLCBcImJpbmFyeVwiKSk7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0bWFwLl9mcm9tRmlsZSA9IGZpbGU7XHJcblxyXG5cdFx0XHRcdFx0XHRcdFx0cmVzKG1hcCk7XHJcblx0XHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHRcdH0pO1xyXG5cdFx0XHRcdFx0fVxyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9KTtcclxuXHRcdH0gLy9wYXJzZUZpbGVcclxuXHJcblx0fSAvL1JHTE1hcFxyXG5cclxuXHQvKipcclxuXHQgKiBSZXNwb25zaWJsZSBmb3IgY29udHJvbGxpbmcgdHJhbnNpdGlvbnMgYW5kIHNldHRpbmdzLlxyXG5cdCAqL1xyXG5cdGV4cG9ydCBjbGFzcyBSR0wge1xyXG5cclxuXHRcdHByb3RlY3RlZCBzdGF0aWMgbWFwcGluZ3NfczogTWFwPG51bWJlciwgTWFwcGluZz4gPSBfbWFwcGluZ3NfczsgXHJcblxyXG5cclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3RvcihcclxuXHRcdFx0YXV0b2NvbmZpZzogYm9vbGVhbiA9IHRydWUsXHJcblx0XHRcdHB1YmxpYyBtYXBwaW5nc19jOiBNYXA8bnVtYmVyLCBNYXBwaW5nPiA9IF9tYXBwaW5nc19jLFxyXG5cdFx0XHRwdWJsaWMgbWFwcGluZ3NfYjogTWFwPG51bWJlciwgTWFwcGluZz4gPSBfbWFwcGluZ3NfYixcclxuXHRcdFx0cHVibGljIF9NYXA6IHR5cGVvZiBSR0xNYXAgPSBSR0xNYXAsXHJcblx0XHRcdHB1YmxpYyBfVGlsZTogdHlwZW9mIFJHTFRpbGUgPSBSR0xUaWxlXHJcblxyXG5cdFx0KSB7XHJcblx0XHRcdGlmICghY2hhbGsuc3VwcG9ydHNDb2xvcikgY29uc29sZS53YXJuKFwiVGVybWluYWwgY29sb3JzIGFyZSBub3Qgc3VwcG9ydGVkIVwiKTtcclxuXHJcblx0XHRcdHRoaXMubWFwcGluZ3NfYyA9IG5ldyBNYXA8bnVtYmVyLCBNYXBwaW5nPihtYXBwaW5nc19jKTtcclxuXHJcblx0XHRcdGlmIChhdXRvY29uZmlnKSB7XHJcblx0XHRcdFx0UHJvbWlzZS5hbGwoW1xyXG5cdFx0XHRcdFx0dGhpcy5sb2FkTWFwcGluZ3NfYygpLFxyXG5cdFx0XHRcdFx0dGhpcy5sb2FkTWFwcGluZ3NfYigpXHJcblx0XHRcdFx0XSkuY2F0Y2goKCkgPT4gZGVidWdfZShcIlJHTC5hdXRvY29uZjogRU1BUFBJTkdcIikpLnRoZW4oKCkgPT4ge1xyXG5cdFx0XHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19jID0gdGhpcy5tYXBwaW5nc19jO1xyXG5cdFx0XHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19iID0gdGhpcy5tYXBwaW5nc19iO1xyXG5cclxuXHRcdFx0XHRcdGRlYnVnKFwiUkdMLmN0b3IgZGVmZmVyZWQgbWFwcGluZ3MuXCIpO1xyXG5cdFx0XHRcdH0pO1xyXG5cdFx0XHR9XHJcblxyXG5cdFx0XHR0aGlzLl9UaWxlLm1hcHBpbmdzX2MgPSB0aGlzLm1hcHBpbmdzX2M7XHJcblx0XHRcdHRoaXMuX1RpbGUubWFwcGluZ3NfYiA9IHRoaXMubWFwcGluZ3NfYjtcclxuXHRcdFx0dGhpcy5fVGlsZS5tYXBwaW5nc19zID0gUkdMLm1hcHBpbmdzX3M7XHJcblx0XHR9IC8vY3RvclxyXG5cclxuXHJcblx0XHRwdWJsaWMgYXN5bmMgbG9hZE1hcHBpbmdzX2MocGF0aD86IFJlYWRvbmx5PHN0cmluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIE1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYyhtYXA/OiBSZWFkb25seTxNYXA8bnVtYmVyLCBNYXBwaW5nPj4pOiBQcm9taXNlPE1hcDxudW1iZXIsIE1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYyhtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIE1hcHBpbmc+PiA9IFwiUkdMTWFwcGluZ3NfYy5qc1wiKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBNYXBwaW5nPj4ge1xyXG5cdFx0XHRyZXR1cm4gUkdMLmxvYWRNYXBwaW5ncyhtYXAsIHRoaXMubWFwcGluZ3NfYyk7XHJcblx0XHR9IC8vbG9hZE1hcHBpbmdzX2NcclxuXHJcblx0XHRwdWJsaWMgYXN5bmMgbG9hZE1hcHBpbmdzX2IocGF0aD86IFJlYWRvbmx5PHN0cmluZz4pOiBQcm9taXNlPE1hcDxudW1iZXIsIE1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYihtYXA/OiBSZWFkb25seTxNYXA8bnVtYmVyLCBNYXBwaW5nPj4pOiBQcm9taXNlPE1hcDxudW1iZXIsIE1hcHBpbmc+PjtcclxuXHRcdHB1YmxpYyBsb2FkTWFwcGluZ3NfYihtYXA6IFJlYWRvbmx5PHN0cmluZyB8IE1hcDxudW1iZXIsIE1hcHBpbmc+PiA9IFwiUkdMTWFwcGluZ3NfYi5qc1wiKTogUHJvbWlzZTxNYXA8bnVtYmVyLCBNYXBwaW5nPj4ge1xyXG5cdFx0XHRyZXR1cm4gUkdMLmxvYWRNYXBwaW5ncyhtYXAsIHRoaXMubWFwcGluZ3NfYik7XHJcblx0XHR9IC8vbG9hZE1hcHBpbmdzX2NcclxuXHRcdFxyXG5cdFx0LyoqXHJcblx0XHQgKiBJbmNsdWRlIGN1c3RvbSBtYXBwaW5ncy5cclxuXHRcdCAqIFxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmcgfCBNYXAuPG51bWJlciwgTWFwcGluZz59IG1hcCAtIExvYWQgbmV3IG1hcHBpbmdzXHJcblx0XHQgKiBAcGFyYW0ge01hcC48bnVtYmVyLCBNYXBwaW5nPn0gb3JpZyAtIE1hcHBpbmdzIHRvIG92ZXJyaWRlXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzdGF0aWMgYXN5bmMgbG9hZE1hcHBpbmdzKG1hcDogUmVhZG9ubHk8c3RyaW5nIHwgTWFwPG51bWJlciwgTWFwcGluZz4+LCBvcmlnOiBNYXA8bnVtYmVyLCBNYXBwaW5nPik6IFByb21pc2U8TWFwPG51bWJlciwgTWFwcGluZz4+IHtcclxuXHRcdFx0ZGVidWcoXCJSR0wubG9hZE1hcHBpbmdzOlwiLCB1dGlsLmluc3BlY3Qob3JpZywgeyBicmVha0xlbmd0aDogSW5maW5pdHkgfSkpO1xyXG5cclxuXHRcdFx0aWYgKHR5cGVvZiBtYXAgPT09IFwic3RyaW5nXCIpIHtcclxuXHRcdFx0XHRkZWxldGUgcmVxdWlyZS5jYWNoZVtyZXF1aXJlLnJlc29sdmUobWFwKV07XHJcblxyXG5cdFx0XHRcdGNvbnN0IGRhdGE6IE1hcDxudW1iZXIsIE1hcHBpbmc+ID0gcmVxdWlyZShtYXApO1xyXG5cclxuXHRcdFx0XHRmb3IgKGxldCBzaWcgb2YgZGF0YSkgb3JpZy5zZXQoc2lnWzBdLCBzaWdbMV0pO1xyXG5cdFx0XHR9IGVsc2UgaWYgKG1hcCBpbnN0YW5jZW9mIE1hcCkge1xyXG5cdFx0XHRcdGZvciAobGV0IHNpZyBvZiBtYXApIG9yaWcuc2V0KHNpZ1swXSwgc2lnWzFdKTtcclxuXHRcdFx0fSBlbHNlIHRocm93IEVycm9ycy5FQkFEVFBZRTtcclxuXHJcblx0XHRcdHJldHVybiBvcmlnO1xyXG5cdFx0fSAvL2xvYWRNYXBwaW5nc1xyXG5cclxuXHRcdC8qKlxyXG5cdFx0ICogU3RhcnQgYW4gaW5zdGFuY2Ugb2YgUkdMLlxyXG5cdFx0ICogXHJcblx0XHQgKiBAcGFyYW0ge2FueVtdfSBwYXJhbXMgLSBPcHRpb25zIHBhc3NlZCB0byBjb25zdHJ1Y3RvclxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGNyZWF0ZSguLi5wYXJhbXM6IFJlYWRvbmx5QXJyYXk8YW55Pik6IFJHTCB7XHJcblx0XHRcdHJldHVybiBuZXcgUkdMKC4uLnBhcmFtcyk7XHJcblx0XHR9IC8vY3JlYXRlXHJcblxyXG5cdH0gLy9SR0xcclxuXHJcbn0gLy9yZ2xcclxuXHJcbmV4cG9ydCBkZWZhdWx0IHJnbDtcclxuIl19