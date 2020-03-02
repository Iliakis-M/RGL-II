/**
 * @author V. H.
 * @file rgl.ts
 * @since 2020
 */
/// <reference types="node" />
import { StringDecoder } from "string_decoder";
export declare module rgl {
    /**
     * Container of Errors.
     */
    export namespace Errors {
        const ENOBIN: TypeError;
        const ENOBUF: TypeError;
        const EBADBUF: RangeError;
        const EBADTPYE: TypeError;
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
     * 'Mapping' type.
     */
    export type Mapping = (text: string) => string;
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile implements Types.Convertable {
        protected readonly origin: Readonly<Buffer>;
        static decoder: StringDecoder;
        private static trim;
        protected precalc: string;
        protected constructor(origin: Readonly<Buffer>);
        serialize(): Buffer;
        static parse(chunk: Readonly<Buffer>): RGLTile;
    }
    /**
     * Responsible for parsing and stripping Chunks.
     */
    class RGLMap implements Types.Convertable {
        protected reserved: Buffer;
        protected size: Buffer;
        protected tiles: RGLTile[];
        protected trailing: Buffer;
        protected _fromFile: string;
        private static readonly MAGIC;
        protected constructor(reserved?: Buffer, size?: Buffer, tiles?: RGLTile[], trailing?: Buffer, _fromFile?: string);
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
        mappings_c: Map<number, Mapping>;
        mappings_b: Map<number, Mapping>;
        _Map: typeof RGLMap;
        _Tile: typeof RGLTile;
        protected constructor(autoconfig?: boolean, mappings_c?: Map<number, Mapping>, mappings_b?: Map<number, Mapping>, _Map?: typeof RGLMap, _Tile?: typeof RGLTile);
        loadMappings_c(path?: Readonly<string>): Promise<Map<number, Mapping>>;
        loadMappings_c(map?: Readonly<Map<number, Mapping>>): Promise<Map<number, Mapping>>;
        loadMappings_b(path?: Readonly<string>): Promise<Map<number, Mapping>>;
        loadMappings_b(map?: Readonly<Map<number, Mapping>>): Promise<Map<number, Mapping>>;
        /**
         * Include custom mappings.
         *
         * @param {string | Map.<number, Mapping>} map - Load new mappings
         * @param {Map.<number, Mapping>} orig - Mappings to override
         */
        loadMappings(map: Readonly<string | Map<number, Mapping>>, orig: Map<number, Mapping>): Promise<Map<number, Mapping>>;
        /**
         * Start an instance of RGL.
         *
         * @param {any[]} params - Options passed to constructor
         */
        static create(...params: ReadonlyArray<any>): RGL;
    }
    export {};
}
export default rgl;
//# sourceMappingURL=rgl.d.ts.map