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
        const ENOBIN: Error;
        const ENOBUF: Error;
        const EBADBUF: Error;
        const EBADTPYE: Error;
        const ENOTTY: Error;
        const EBADBIND: Error;
        const EBADPARAM: Error;
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
         * Nullable type.
         */
        type Nullable<T> = T | null | undefined;
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
    export namespace util {
        function idxToCrd(idx: number, sz: number): [number, number];
        function crdToIdx(crd: [number, number], sz: number): number;
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
        coords: [number, number];
        parent?: Readonly<RGLMap>;
        protected constructor(origin: Readonly<Buffer>);
        get serialize(): Buffer;
        /**
         * Parse data into a Convertable.
         *
         * @param {Readonly<Buffer>} chunk
         */
        static parse(chunk: Readonly<Buffer | RGLTile>, parent?: Readonly<RGLMap>): RGLTile;
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
        protected trans: [number, number];
        private static readonly MAGIC;
        private static readonly RGL;
        private static _idcntr;
        private readonly _id;
        protected constructor(reserved?: Buffer, size?: Buffer, tiles?: RGLTile[], trailing?: Buffer, _fromFile?: string, trans?: [number, number]);
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
        protected _sortTiles(tiles?: RGLTile[]): void;
        /**
         * Check validity of tile's coords.
         */
        checkValidity?(): boolean;
        toString(): string;
        [Symbol.toPrimitive](hint: string): string | this;
    }
    /**
     * Responsible for controlling assets and transitions.
     */
    export class RGLGround {
        protected maplist: Map<string, RGLMap>;
        protected foreground: Types.Nullable<RGLMap>;
        protected viewport: [number, number];
        constructor(maplist?: Map<string, RGLMap>, foreground?: Types.Nullable<RGLMap>, viewport?: [number, number]);
        /**
         * Sets the foreground or retrieves.
         */
        focus(fg?: RGLMap | string): Types.Nullable<RGLMap>;
        /**
         * Add or retrieve a map.
         */
        map(name?: string, mp?: RGLMap): IterableIterator<[string, RGLMap]>;
    }
    /**
     * Responsible for controlling events and settings.
     */
    export class RGL extends event.EventEmitter {
        protected secureSwitch: boolean;
        protected mappings_c: Map<number, Types.Mapping>;
        protected mappings_b: Map<number, Types.Mapping>;
        protected readonly _Map: typeof RGLMap;
        protected readonly _Tile: typeof RGLTile;
        ground: RGLGround;
        protected static mappings_s: Map<number, Types.Mapping>;
        protected binds: Types.Nullable<Types.IO>;
        protected constructor(autoconfig?: boolean, secureSwitch?: boolean, /* Unbind CTRL-C */ mappings_c?: Map<number, Types.Mapping>, mappings_b?: Map<number, Types.Mapping>, _Map?: typeof RGLMap, _Tile?: typeof RGLTile, ground?: RGLGround);
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
        unbind(): this;
        emit(event: "key", data: string): boolean;
        emit(event: "rawkey", data: Buffer): boolean;
        emit(event: "_exit"): boolean;
        emit(event: "_loadBackground", data: string | Readonly<Map<number, Types.Mapping>>): boolean;
        emit(event: "_loadColors", data: string | Readonly<Map<number, Types.Mapping>>): boolean;
        emit(event: string | symbol, ...args: any[]): boolean;
        on(event: "key", listener: (data: string) => void): this;
        on(event: "rawkey", listener: (data: Buffer) => void): this;
        on(event: "_exit", listener: () => void): this;
        on(event: "_loadBackground", listener: (data: string | Readonly<Map<number, Types.Mapping>>) => void): this;
        on(event: "_loadColors", listener: (data: string | Readonly<Map<number, Types.Mapping>>) => void): this;
        on(event: string | symbol, listener: (...args: any[]) => void): this;
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