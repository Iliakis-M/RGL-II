/**
 * @author V. H.
 * @file rgl.ts
 * @since 2020
 */
/// <reference types="node" />
import * as tty from "tty";
import * as event from "events";
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
        const ENOTTY: TypeError;
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
             * Convert Convertable into a writable Buffer.
             */
            serialize: Buffer;
            /**
             * Returns a string representation of an object.
             */
            toString(): string;
        }
        /**
         * 'Class' type.
         */
        type Class<T> = new (...args: any[]) => T;
        /**
         * I/O binding type.
         */
        type IO = {
            input: NodeJS.ReadStream;
            output: NodeJS.WriteStream;
            error?: NodeJS.ReadWriteStream;
            _inpCb?: (data: Buffer) => void;
        };
        /**
         * 'Mapping' type.
         */
        type Mapping = (text: string) => string;
    }
    /**
     * Responsible for representing Chunks.
     */
    class RGLTile implements Types.Convertable {
        protected readonly origin: Readonly<Buffer>;
        private static readonly trim;
        private static _idcntr;
        protected static decoder: StringDecoder;
        static mappings_c: Map<number, Types.Mapping>;
        static mappings_b: Map<number, Types.Mapping>;
        static mappings_s: Map<number, Types.Mapping>;
        private readonly _id;
        protected readonly precalc: string;
        protected readonly reserved: number;
        protected constructor(origin: Readonly<Buffer>);
        get serialize(): Buffer;
        /**
         * Parse data into a Convertable.
         *
         * @param {Readonly<Buffer>} chunk
         */
        static parse(chunk: Readonly<Buffer>): RGLTile;
        toString(): string;
        [Symbol.toPrimitive](hint: string): string | this;
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
        private static readonly RGL;
        private static _idcntr;
        private readonly _id;
        protected constructor(reserved?: Buffer, size?: Buffer, tiles?: RGLTile[], trailing?: Buffer, _fromFile?: string);
        get serialize(): Buffer;
        /**
         * Store Convertable into a writable 'file'.
         *
         * @param file - Target file
         */
        serializeFile(file?: Readonly<string>): Promise<Buffer>;
        /**
         * Parse data into a Convertable.
         *
         * @param {Readonly<Buffer>} chunk
         */
        static parse(data: Readonly<Buffer>): RGLMap;
        /**
         * Read Buffer from 'file'.
         *
         * @param file - Target file
         */
        static parseFile(file: Readonly<string>): Promise<RGLMap>;
        toString(): string;
        [Symbol.toPrimitive](hint: string): string | this;
    }
    /**
     * Responsible for controlling transitions and settings.
     *
     * TODO: Add controls.
     */
    export class RGL extends event.EventEmitter {
        protected mappings_c: Map<number, Types.Mapping>;
        protected mappings_b: Map<number, Types.Mapping>;
        protected readonly _Map: typeof RGLMap;
        protected readonly _Tile: typeof RGLTile;
        protected static mappings_s: Map<number, Types.Mapping>;
        protected secureSwitch: boolean;
        protected binds: Types.IO | null;
        protected constructor(autoconfig?: boolean, mappings_c?: Map<number, Types.Mapping>, mappings_b?: Map<number, Types.Mapping>, _Map?: typeof RGLMap, _Tile?: typeof RGLTile);
        /**
         * Whether the TTY supports basic colors.
         */
        static get supportsColors(): boolean;
        loadMappings_c(path?: Readonly<string>): Promise<Map<number, Types.Mapping>>;
        loadMappings_c(map?: Readonly<Map<number, Types.Mapping>>): Promise<Map<number, Types.Mapping>>;
        loadMappings_b(path?: Readonly<string>): Promise<Map<number, Types.Mapping>>;
        loadMappings_b(map?: Readonly<Map<number, Types.Mapping>>): Promise<Map<number, Types.Mapping>>;
        /**
         * Include custom mappings.
         *
         * @param map - Load new mappings
         * @param orig - Mappings to override
         */
        static loadMappings(map: Readonly<string | Map<number, Types.Mapping>>, orig: Map<number, Types.Mapping>): Promise<Map<number, Types.Mapping>>;
        /**
         * Bind the RGL engine to I/O.
         *
         * @param inp - The target user-input stream to bind, must be a TTY
         * @param out - The target user-input stream to bind, must be a TTY
         */
        bind(inp?: tty.ReadStream, out?: tty.WriteStream, err?: NodeJS.ReadWriteStream): this;
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