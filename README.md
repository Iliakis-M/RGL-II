
# RGL

An engine for _RogueLike_ games.
Or colored console text.

## Restrictions

1) `RGL~_Tile` field manipulates the original `RGLTile`-like class, meaning that if you have multiple `RGL` instances using the same `RGL~_Tile` reference, you cannot have different mappings for each. Instead, reload the module or copy that class.

### Mappings

Color mappings can be customized, just make sure you always provide the _JSON_ to the end-user.  
**Style mappings cannot be customized!**

> Formatting instructions [here](./doc/FORMAT.md "Format")

### Identifying the Keys

Since `RGL#bind` turns the provided stream (`process.stdin` by default) into a RAW TTY stream, In order to identify keypress combinations like `CTRL - C` and use them in your codes, you can use the builtin `rgl keys` utility which will provide several info about the input.
