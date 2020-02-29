
# RGL File-Formats

## RGLMap

This format has the extension `.rglmap`.  
The format is as follows:

* Three initial reserved bytes.
* The exact magic-word `RGL` and the byte `02`.
* The dimensions of the map.
* The chunks.
  * 4 bytes character (null-padded).
  * 1 byte color mapping.
  * 1 byte background color mapping.
  * 1 byte bitmask style mapping.
* Any trailing headings after the `03 00 00 00 01` chunk.

**Minimum size allowed is <u>_9_</u> bytes.**

### Example

```plaitext
00 00 00 52 47 4C 02 FF FF
00 00 00 53 01 02 03 00 00 00 54 01 02 03
03 00 00 00 01 01 02 03 04
```
