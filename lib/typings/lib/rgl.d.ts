/**
 * @author V. H.
 * @file rgl.ts
 * @since 2020
 */
/// <reference types="node" />
export declare module RGL {
    /**
     * Container of Errors.
     */
    export namespace Errors {
        const ENOBIN: TypeError;
        const ENOBUF: TypeError;
        const EBADBUF: RangeError;
    }
    /**
     * Container of ADT contracts.
     */
    export namespace Types {
        /**
         * Anything that can be serialized and parsed.
         */
        interface Convertable {
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
        }
    }
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile implements Types.Convertable {
        protected constructor();
        serialize(): Buffer;
        static parse(chunk: Readonly<Buffer>): RGLTile;
    }
    /**
     * Responsible for parsing and stripping Chunks.
     */
    class RGLMap implements Types.Convertable {
        protected _fromFile: Readonly<string>;
        protected constructor(_fromFile?: Readonly<string>);
        serialize(): Buffer;
        /**
         * Store 'T' to writable 'file'.
         *
         * @param {string} file - Target file
         */
        serializeFile(file?: Readonly<string>): Buffer;
        static parse(data: Readonly<Buffer>): RGLMap;
        /**
         * Read Buffer from 'file'.
         *
         * @param {string} file - Target file
         */
        static parseFile(file: Readonly<string>): Promise<RGLMap>;
    }
    /**
     * Responsible for controlling transitions and settings.
     */
    export class RGL {
        static readonly Tile: typeof RGLTile;
        static readonly Map: typeof RGLMap;
        protected constructor(...params: any[]);
        /**
         * Start an instance of RGL.
         *
         * @param {any[]} params - Options passed to constructor
         */
        static create(...params: ReadonlyArray<any>): RGL;
    }
    export {};
}
export default RGL;
//# sourceMappingURL=rgl.d.ts.map