
# TODOs

- [x] Implement Serialization.
- [x] Reconsider Class structure(?)
- [ ] Implement Binary help Utility (Map Builder, Execution Framework, Graphical Web Interface)
- [ ] Implement calculated coordinate-mapped printing based on size
- [x] Implement coord-to-idx converting functions and tile sorting util

## Specifications

All data captured from designated user-input stream is emitted back as raw.
Helper overridable callbacks are provided for up/down/left/right keys for ease of access.
All emitted keys shall be handled by a single or separate callback.

### Bugs

1) _NodeJS_: Calling `tty.setRawMode(true)` on `process.stdin` right after setting it to `false` blocks the process.
