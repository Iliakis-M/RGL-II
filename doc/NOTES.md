
# Implementation

## General Structure

### Debuging

**RGL** uses `util.debuglog`.  
Three channels are available:

1. `RGL` - Common debuging
2. `RGLv` - Verbose debuging
3. `RGLe` - Error debuging

### Behaviour

* All _Convertables_ have an internal unique ID.
* **rgl** loads default mappings on startup.
* **RGLTile** precalculates the real output.
* **RGL** is event-oriented.

## Class Structure

### Namespaces

* `Errors` - Contains all custom errors.
* `Types` - Contains all custom types.

## Dependencies

1. Builtins

   * `util`
   * `assert`
   * `path`
   * `tty`
   * `events`
   * `string_decoder`

2. Third-Party

   * fs-extra
   * chalk
