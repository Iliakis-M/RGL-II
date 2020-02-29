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
const string_decoder_1 = require("string_decoder");
const debug = util.debuglog("RGL"), debug_v = util.debuglog("RGLv"), debug_e = util.debuglog("RGLe"), decoder = new string_decoder_1.StringDecoder("utf8"); // Variable type??
var RGL;
(function (RGL_1) {
    debug("RGL loaded.");
    /**
     * Container of Errors.
     */
    let Errors;
    (function (Errors) {
        Errors.ENOBIN = new TypeError("Buffer is not binary.");
        Errors.ENOBUF = new TypeError("Not a Buffer.");
        Errors.EBADBUF = new RangeError("Bad data, Wrong size or format.");
    })(Errors = RGL_1.Errors || (RGL_1.Errors = {})); //Errors
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile {
        constructor() {
        } //ctor
        serialize() {
            return Buffer.allocUnsafe(0);
        } //serialize
        static parse(chunk) {
            return new RGLTile;
        } //parse
    } //Tile
    /**
     * Responsible for parsing and stripping Chunks.
     */
    class RGLMap {
        constructor(_fromFile = "") {
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
            return new RGL.Map;
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
                                const map = RGL.Map.parse(Buffer.from(data, "binary"));
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
    class RGL {
        constructor(...params) {
        } //ctor
        /**
         * Start an instance of RGL.
         *
         * @param {any[]} params - Options passed to constructor
         */
        static create(...params) {
            return new RGL(...params);
        } //create
    } //RGL
    RGL.Tile = RGLTile;
    RGL.Map = RGLMap;
    RGL_1.RGL = RGL;
})(RGL = exports.RGL || (exports.RGL = {})); //RGL
exports.default = RGL;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmdsLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3JnbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUgsWUFBWSxDQUFDOzs7QUFFYixtREFBNkI7QUFDN0IscURBQStCO0FBQy9CLHVEQUFpQztBQUNqQyxtREFBK0M7QUFFL0MsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFDakMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLEVBQy9CLE9BQU8sR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxFQUMvQixPQUFPLEdBQUcsSUFBSSw4QkFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUUsa0JBQWtCO0FBRXpELElBQWMsR0FBRyxDQXdLaEI7QUF4S0QsV0FBYyxLQUFHO0lBQ2hCLEtBQUssQ0FBQyxhQUFhLENBQUMsQ0FBQztJQUdyQjs7T0FFRztJQUNILElBQWlCLE1BQU0sQ0FJdEI7SUFKRCxXQUFpQixNQUFNO1FBQ1QsYUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLHVCQUF1QixDQUFDLENBQUM7UUFDaEQsYUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBQ3hDLGNBQU8sR0FBRyxJQUFJLFVBQVUsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0lBQzFFLENBQUMsRUFKZ0IsTUFBTSxHQUFOLFlBQU0sS0FBTixZQUFNLFFBSXRCLENBQUMsUUFBUTtJQWdDVjs7T0FFRztJQUNILE1BQU0sT0FBTztRQUVaO1FBRUEsQ0FBQyxDQUFDLE1BQU07UUFHRCxTQUFTO1lBQ2YsT0FBTyxNQUFNLENBQUMsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQzlCLENBQUMsQ0FBQyxXQUFXO1FBRU4sTUFBTSxDQUFDLEtBQUssQ0FBQyxLQUF1QjtZQUMxQyxPQUFPLElBQUksT0FBTyxDQUFDO1FBQ3BCLENBQUMsQ0FB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LENBQUM7NEJBQ1YsQ0FBQyxDQUFDLENBQUM7d0JBQ0osQ0FBQyxDQUFDLENBQUM7cUJBQ0g7Z0JBQ0YsQ0FBQyxDQUFDLENBQUM7WUFDSixDQUFDLENBQUMsQ0FBQztRQUNKLENBQUMsQ0FBQyxXQUFXO0tBRWIsQ0FBQyxLQUFLO0lBRVA7O09BRUc7SUFDSCxNQUFhLEdBQUc7UUFNZixZQUFzQixHQUFHLE1BQWE7UUFFdEMsQ0FBQyxDQUFDLE1BQU07UUFHUjs7OztXQUlHO1FBQ0ksTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLE1BQTBCO1lBQ2pELE9BQU8sSUFBSSxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQztRQUMzQixDQUFDLENBQUMsUUFBUTtNQUVULEtBQUs7SUFsQmlCLFFBQUksR0FBbUIsT0FBTyxDQUFDO0lBQy9CLE9BQUcsR0FBa0IsTUFBTSxDQUFDO0lBSHZDLFNBQUcsTUFvQmYsQ0FBQTtBQUVGLENBQUMsRUF4S2EsR0FBRyxHQUFILFdBQUcsS0FBSCxXQUFHLFFBd0toQixDQUFDLEtBQUs7QUFFUCxrQkFBZSxHQUFHLENBQUMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcclxuICogQGF1dGhvciBWLiBILlxyXG4gKiBAZmlsZSByZ2wudHNcclxuICogQHNpbmNlIDIwMjBcclxuICovXHJcblxyXG5cInVzZSBzdHJpY3RcIjtcclxuXHJcbmltcG9ydCAqIGFzIHV0aWwgZnJvbSBcInV0aWxcIjtcclxuaW1wb3J0ICogYXMgZnMgZnJvbSBcImZzLWV4dHJhXCI7XHJcbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tIFwiYXNzZXJ0XCI7XHJcbmltcG9ydCB7IFN0cmluZ0RlY29kZXIgfSBmcm9tIFwic3RyaW5nX2RlY29kZXJcIjtcclxuXHJcbmNvbnN0IGRlYnVnID0gdXRpbC5kZWJ1Z2xvZyhcIlJHTFwiKSxcclxuXHRkZWJ1Z192ID0gdXRpbC5kZWJ1Z2xvZyhcIlJHTHZcIiksXHJcblx0ZGVidWdfZSA9IHV0aWwuZGVidWdsb2coXCJSR0xlXCIpLFxyXG5cdGRlY29kZXIgPSBuZXcgU3RyaW5nRGVjb2RlcihcInV0ZjhcIik7ICAvLyBWYXJpYWJsZSB0eXBlPz9cclxuXHJcbmV4cG9ydCBtb2R1bGUgUkdMIHtcclxuXHRkZWJ1ZyhcIlJHTCBsb2FkZWQuXCIpO1xyXG5cdFxyXG5cclxuXHQvKipcclxuXHQgKiBDb250YWluZXIgb2YgRXJyb3JzLlxyXG5cdCAqL1xyXG5cdGV4cG9ydCBuYW1lc3BhY2UgRXJyb3JzIHtcclxuXHRcdGV4cG9ydCBjb25zdCBFTk9CSU4gPSBuZXcgVHlwZUVycm9yKFwiQnVmZmVyIGlzIG5vdCBiaW5hcnkuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVOT0JVRiA9IG5ldyBUeXBlRXJyb3IoXCJOb3QgYSBCdWZmZXIuXCIpO1xyXG5cdFx0ZXhwb3J0IGNvbnN0IEVCQURCVUYgPSBuZXcgUmFuZ2VFcnJvcihcIkJhZCBkYXRhLCBXcm9uZyBzaXplIG9yIGZvcm1hdC5cIik7XHJcblx0fSAvL0Vycm9yc1xyXG5cclxuXHQvKipcclxuXHQgKiBDb250YWluZXIgb2YgQURUIGNvbnRyYWN0cy5cclxuXHQgKi9cclxuXHRleHBvcnQgbmFtZXNwYWNlIFR5cGVzIHtcclxuXHJcblx0XHQvKipcclxuXHRcdCAqIEFueXRoaW5nIHRoYXQgY2FuIGJlIHNlcmlhbGl6ZWQgYW5kIHBhcnNlZC5cclxuXHRcdCAqL1xyXG5cdFx0ZXhwb3J0IGludGVyZmFjZSBDb252ZXJ0YWJsZSB7XHJcblx0XHRcdC8qKlxyXG5cdFx0XHQgKiBDb252ZXJ0ICdUJyB0byB3cml0YWJsZSBCdWZmZXIuXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRzZXJpYWxpemUoKTogQnVmZmVyO1xyXG5cdFx0XHQvKipcclxuXHRcdFx0ICogQ29udmVydCBCdWZmZXIgdG8gJ1QnLlxyXG5cdFx0XHQgKiBcclxuXHRcdFx0ICogQHBhcmFtIHshQnVmZmVyfSBkYXRhIC0gU3RyaWN0bHkgYSBiaW5hcnkgYnVmZmVyXHJcblx0XHRcdCAqL1xyXG5cdFx0XHRwYXJzZT8oZGF0YTogUmVhZG9ubHk8QnVmZmVyPik6IENvbnZlcnRhYmxlO1xyXG5cdFx0fSAvL0NvbnZlcnRhYmxlXHJcblxyXG5cdH0gLy9UeXBlc1xyXG5cclxuXHJcblx0LyoqXHJcblx0ICogJ0NsYXNzJyB0eXBlLlxyXG5cdCAqL1xyXG5cdHR5cGUgQ2xhc3M8VD4gPSBuZXcoLi4uYXJnczogYW55W10pID0+IFQ7XHJcblxyXG5cclxuXHQvKipcclxuXHQgKiBSZXNwb25zaWJsZSBmb3IgcmVwcmVzZW50aW5nIENodW5rcy5cclxuXHQgKi9cclxuXHRjbGFzcyBSR0xUaWxlIGltcGxlbWVudHMgVHlwZXMuQ29udmVydGFibGUge1xyXG5cclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3RvcigpIHtcclxuXHJcblx0XHR9IC8vY3RvclxyXG5cclxuXHJcblx0XHRwdWJsaWMgc2VyaWFsaXplKCk6IEJ1ZmZlciB7XHJcblx0XHRcdHJldHVybiBCdWZmZXIuYWxsb2NVbnNhZmUoMCk7XHJcblx0XHR9IC8vc2VyaWFsaXplXHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyBwYXJzZShjaHVuazogUmVhZG9ubHk8QnVmZmVyPik6IFJHTFRpbGUge1xyXG5cdFx0XHRyZXR1cm4gbmV3IFJHTFRpbGU7XHJcblx0XHR9IC8vcGFyc2VcclxuXHJcblx0fSAvL1RpbGVcclxuXHJcblx0LyoqXHJcblx0ICogUmVzcG9uc2libGUgZm9yIHBhcnNpbmcgYW5kIHN0cmlwcGluZyBDaHVua3MuXHJcblx0ICovXHJcblx0Y2xhc3MgUkdMTWFwIGltcGxlbWVudHMgVHlwZXMuQ29udmVydGFibGUge1xyXG5cclxuXHRcdHByb3RlY3RlZCBjb25zdHJ1Y3Rvcihwcm90ZWN0ZWQgX2Zyb21GaWxlOiBSZWFkb25seTxzdHJpbmc+ID0gXCJcIikge1xyXG5cclxuXHRcdH0gLy9jdG9yXHJcblxyXG5cclxuXHRcdHB1YmxpYyBzZXJpYWxpemUoKTogQnVmZmVyIHtcclxuXHRcdFx0cmV0dXJuIEJ1ZmZlci5hbGxvY1Vuc2FmZSgwKTtcclxuXHRcdH0gLy9zZXJpYWxpemVcclxuXHRcdC8qKlxyXG5cdFx0ICogU3RvcmUgJ1QnIHRvIHdyaXRhYmxlICdmaWxlJy5cclxuXHRcdCAqXHJcblx0XHQgKiBAcGFyYW0ge3N0cmluZ30gZmlsZSAtIFRhcmdldCBmaWxlXHJcblx0XHQgKi9cclxuXHRcdHB1YmxpYyBzZXJpYWxpemVGaWxlKGZpbGU6IFJlYWRvbmx5PHN0cmluZz4gPSB0aGlzLl9mcm9tRmlsZSk6IEJ1ZmZlciB7XHJcblx0XHRcdHJldHVybiBCdWZmZXIuYWxsb2NVbnNhZmUoMCk7XHJcblx0XHR9IC8vc2VyaWFsaXplRmlsZVxyXG5cdFx0XHJcblx0XHRwdWJsaWMgc3RhdGljIHBhcnNlKGRhdGE6IFJlYWRvbmx5PEJ1ZmZlcj4pOiBSR0xNYXAge1xyXG5cdFx0XHRkZWJ1ZyhgUkdMTWFwLnBhcnNlYCk7XHJcblxyXG5cdFx0XHRhc3NlcnQub2soQnVmZmVyLmlzQnVmZmVyKGRhdGEpLCBFcnJvcnMuRU5PQlVGKTtcclxuXHRcdFx0YXNzZXJ0Lm9rKEJ1ZmZlci5pc0VuY29kaW5nKFwiYmluYXJ5XCIpLCBFcnJvcnMuRU5PQklOKTtcclxuXHRcdFx0YXNzZXJ0Lm9rKGRhdGEubGVuZ3RoID49IDksIEVycm9ycy5FQkFEQlVGKTtcclxuXHJcblx0XHRcdHJldHVybiBuZXcgUkdMLk1hcDtcclxuXHRcdH0gLy9wYXJzZVxyXG5cdFx0LyoqXHJcblx0XHQgKiBSZWFkIEJ1ZmZlciBmcm9tICdmaWxlJy5cclxuXHRcdCAqIFxyXG5cdFx0ICogQHBhcmFtIHtzdHJpbmd9IGZpbGUgLSBUYXJnZXQgZmlsZVxyXG5cdFx0ICovXHJcblx0XHRwdWJsaWMgc3RhdGljIGFzeW5jIHBhcnNlRmlsZShmaWxlOiBSZWFkb25seTxzdHJpbmc+KTogUHJvbWlzZTxSR0xNYXA+IHtcclxuXHRcdFx0ZGVidWcoYFJHTE1hcC5wYXJzZUZpbGU6ICR7ZmlsZX1gKTtcclxuXHJcblx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShhc3luYyAocmVzLCByZWopID0+IHtcclxuXHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2VGaWxlOiBBQ0NFU1NgKTtcclxuXHJcblx0XHRcdFx0ZnMuYWNjZXNzKGZpbGUsIGZzLmNvbnN0YW50cy5GX09LIHwgZnMuY29uc3RhbnRzLlJfT0ssIGVyciA9PiB7XHJcblx0XHRcdFx0XHRpZiAoZXJyKSB7XHJcblx0XHRcdFx0XHRcdGRlYnVnX2UoYFJHTE1hcC5wYXJzZUZpbGU6ICR7ZmlsZX0gLT4gRUFDQ0VTU2ApO1xyXG5cclxuXHRcdFx0XHRcdFx0cmVqKGVycik7XHJcblx0XHRcdFx0XHR9IGVsc2Uge1xyXG5cdFx0XHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2VGaWxlOiBSU1RSRUFNYCk7XHJcblxyXG5cdFx0XHRcdFx0XHRjb25zdCBzdHI6IGZzLlJlYWRTdHJlYW0gPSBmcy5jcmVhdGVSZWFkU3RyZWFtKGZpbGUsIHtcclxuXHRcdFx0XHRcdFx0XHRmbGFnczogXCJyXCIsXHJcblx0XHRcdFx0XHRcdFx0ZW5jb2Rpbmc6IFwiYmluYXJ5XCIsXHJcblx0XHRcdFx0XHRcdFx0bW9kZTogZnMuY29uc3RhbnRzLlNfSVJVU1IgfCBmcy5jb25zdGFudHMuU19JUkdSUCB8IGZzLmNvbnN0YW50cy5TX0lYVVNSLFxyXG5cdFx0XHRcdFx0XHRcdGVtaXRDbG9zZTogdHJ1ZVxyXG5cdFx0XHRcdFx0XHR9KVxyXG5cdFx0XHRcdFx0XHQub25jZShcInJlYWRhYmxlXCIsIGFzeW5jICgpID0+IHtcclxuXHRcdFx0XHRcdFx0XHRkZWJ1Z192KGBSR0xNYXAucGFyc2VGaWxlOiAke2ZpbGV9IC0+IFJlYWRhYmxlLmApO1xyXG5cclxuXHRcdFx0XHRcdFx0XHRsZXQgZGF0YTogc3RyaW5nID0gJyc7XHJcblxyXG5cdFx0XHRcdFx0XHRcdHN0ci5zZXRFbmNvZGluZyhcImJpbmFyeVwiKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0Zm9yIGF3YWl0IChsZXQgY2h1bmsgb2Ygc3RyKSBkYXRhICs9IGNodW5rO1xyXG5cdFx0XHRcdFx0XHRcdFxyXG5cdFx0XHRcdFx0XHRcdHN0ci5vbmNlKFwiY2xvc2VcIiwgKCkgPT4ge1xyXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgbWFwOiBSR0xNYXAgPSBSR0wuTWFwLnBhcnNlKEJ1ZmZlci5mcm9tKGRhdGEsIFwiYmluYXJ5XCIpKTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRtYXAuX2Zyb21GaWxlID0gZmlsZTtcclxuXHJcblx0XHRcdFx0XHRcdFx0XHRyZXMobWFwKTtcclxuXHRcdFx0XHRcdFx0XHR9KTtcclxuXHRcdFx0XHRcdFx0fSk7XHJcblx0XHRcdFx0XHR9XHJcblx0XHRcdFx0fSk7XHJcblx0XHRcdH0pO1xyXG5cdFx0fSAvL3BhcnNlRmlsZVxyXG5cclxuXHR9IC8vTWFwXHJcblxyXG5cdC8qKlxyXG5cdCAqIFJlc3BvbnNpYmxlIGZvciBjb250cm9sbGluZyB0cmFuc2l0aW9ucyBhbmQgc2V0dGluZ3MuXHJcblx0ICovXHJcblx0ZXhwb3J0IGNsYXNzIFJHTCB7XHJcblxyXG5cdFx0cHVibGljIHN0YXRpYyByZWFkb25seSBUaWxlOiB0eXBlb2YgUkdMVGlsZSA9IFJHTFRpbGU7XHJcblx0XHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IE1hcDogdHlwZW9mIFJHTE1hcCA9IFJHTE1hcDtcclxuXHJcblxyXG5cdFx0cHJvdGVjdGVkIGNvbnN0cnVjdG9yKC4uLnBhcmFtczogYW55W10pIHtcclxuXHJcblx0XHR9IC8vY3RvclxyXG5cclxuXHJcblx0XHQvKipcclxuXHRcdCAqIFN0YXJ0IGFuIGluc3RhbmNlIG9mIFJHTC5cclxuXHRcdCAqIFxyXG5cdFx0ICogQHBhcmFtIHthbnlbXX0gcGFyYW1zIC0gT3B0aW9ucyBwYXNzZWQgdG8gY29uc3RydWN0b3JcclxuXHRcdCAqL1xyXG5cdFx0cHVibGljIHN0YXRpYyBjcmVhdGUoLi4ucGFyYW1zOiBSZWFkb25seUFycmF5PGFueT4pOiBSR0wge1xyXG5cdFx0XHRyZXR1cm4gbmV3IFJHTCguLi5wYXJhbXMpO1xyXG5cdFx0fSAvL2NyZWF0ZVxyXG5cclxuXHR9IC8vUkdMXHJcblxyXG59IC8vUkdMXHJcblxyXG5leHBvcnQgZGVmYXVsdCBSR0w7XHJcbiJdfQ==